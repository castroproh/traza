"""Prototipo experimental de plausibilidad bayesiana por hipótesis.

ESTE MÓDULO NO ES EL MOTOR DE PRODUCCIÓN. Es un prototipo aislado del
simulador para evaluar si una actualización bayesiana es viable antes de
cualquier decisión de integración en src/.

Supuestos explícitos (no prevalencias reales ni certezas sobre estudiantes):
- Prior uniforme configurable sobre las hipótesis de un patrón.
- Verosimilitud declarada desde las firmas públicas del banco:
    * respuesta coincide con la firma de h y no es la correcta: 0.9
    * respuesta es la correcta y h predice la correcta: 0.5 (compatible,
      pero no distintiva de la comprensión correcta)
    * respuesta es la correcta y h predice otra cosa: 0.05
    * respuesta ambigua/incierta: 1 / n_opciones (no informa)
    * cualquier otra: ruido uniforme epsilon sobre las opciones restantes.
- Actualización Bayesiana secuencial y normalizada; reproducible con semilla.
- Una hipótesis con plausibilidad cercana a cero se considera contradictada.
- Varias hipótesis pueden conservar plausibilidad; no se emite un diagnóstico
  mientras el máximo esté por debajo del umbral (default 0.70).
- Los resultados son plausibilidades sobre perfiles artificiales, nunca
  probabilidades sobre estudiantes reales ni evidencias de prevalencia.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import isfinite
from typing import Mapping

from .evidence import is_uncertain_response, same_response
from .models import Bank, Microtest, Profile, SessionResult
from .responses import generate_response
from .selection import select_adaptive, MAX_MICROTESTS_PER_SESSION
DEFAULT_PRIOR_WEIGHT = 1.0
LIKELY_SIGNATURE = 0.90
LIKELY_CORRECT_SILENT = 0.50
UNLIKELY_CORRECT = 0.05
EPSILON = 0.01
DIAGNOSIS_THRESHOLD = 0.70


@dataclass
class BayesianUpdate:
    hypothesis_id: str
    microtest_id: str
    response: str
    likelihood: float
    prior: float
    posterior: float
    note: str


@dataclass
class BayesianDiagnosis:
    plausibilities: dict[str, float]
    most_plausible: str | None
    max_plausibility: float
    threshold: float
    diagnosis: str | None
    contradictory: list[str]
    updates: list[BayesianUpdate] = field(default_factory=list)

    @property
    def identified(self) -> bool:
        return self.diagnosis is not None and self.diagnosis != "multiple"

    @property
    def multiple(self) -> bool:
        return self.diagnosis == "multiple"

    @property
    def insufficient(self) -> bool:
        return self.diagnosis is None


def _options(microtest: Microtest) -> list[str]:
    return microtest.options()


def _likelihood(
    bank: Bank,
    microtest: Microtest,
    hypothesis_id: str,
    response: str,
) -> float:
    options = _options(microtest)
    n = max(1, len(options))
    hypotheses = bank.hypotheses
    h = hypotheses.get(hypothesis_id)
    if h is None:
        return EPSILON / max(1, n - 1)
    if is_uncertain_response(response) or any(
        same_response(response, ambiguous)
        for ambiguous in microtest.ambiguity_cases
    ):
        return 1.0 / n
    predicted = microtest.signatures.get(hypothesis_id, ())
    predicted_matches = any(same_response(v, response) for v in predicted)
    is_correct = same_response(response, microtest.expected_outcome)
    if predicted_matches:
        if is_correct:
            return LIKELY_CORRECT_SILENT
        return LIKELY_SIGNATURE
    if is_correct:
        # The synthetic response generator answers correctly when a hypothesis
        # has no signature for this microtest; treat that as compatible, not as
        # evidence against the hypothesis.
        return LIKELY_CORRECT_SILENT if not predicted else UNLIKELY_CORRECT
    return EPSILON / max(1, n - 1)


def bayesian_diagnosis(
    bank: Bank,
    pattern_id: str,
    answers: list[tuple[str, str]],
    prior: Mapping[str, float] | None = None,
    threshold: float = DIAGNOSIS_THRESHOLD,
) -> BayesianDiagnosis:
    if not isfinite(threshold) or not 0 < threshold <= 1:
        raise ValueError("threshold debe ser un número mayor que 0 y menor o igual que 1.")
    hypotheses = bank.hypotheses_for(pattern_id)
    if not hypotheses:
        return BayesianDiagnosis(
            plausibilities={},
            most_plausible=None,
            max_plausibility=0.0,
            threshold=threshold,
            diagnosis=None,
            contradictory=[],
        )
    ids = [h.id for h in hypotheses]
    if prior is None:
        weights = {h_id: DEFAULT_PRIOR_WEIGHT for h_id in ids}
    else:
        weights = {h_id: float(prior.get(h_id, DEFAULT_PRIOR_WEIGHT)) for h_id in ids}
    if any(not isfinite(weight) or weight < 0 for weight in weights.values()):
        raise ValueError("Los pesos del prior deben ser finitos y no negativos.")
    total = sum(weights.values())
    if total <= 0:
        raise ValueError("El prior debe asignar peso positivo al menos a una hipótesis.")
    plausibility = {h_id: weights[h_id] / total for h_id in ids}
    updates: list[BayesianUpdate] = []

    for microtest_id, response in answers:
        microtest = bank.microtests.get(microtest_id)
        if microtest is None or microtest.pattern_id != pattern_id:
            continue
        likelihoods = {
            h_id: _likelihood(bank, microtest, h_id, response) for h_id in ids
        }
        unnormalized = {
            h_id: plausibility[h_id] * likelihoods[h_id] for h_id in ids
        }
        norm = sum(unnormalized.values())
        if norm <= 0:
            # Todas las verosimilitudes nulas: la respuesta no informa;
            # se mantienen las plausibilidades previas.
            for h_id in ids:
                updates.append(
                    BayesianUpdate(
                        hypothesis_id=h_id,
                        microtest_id=microtest_id,
                        response=response,
                        likelihood=likelihoods[h_id],
                        prior=plausibility[h_id],
                        posterior=plausibility[h_id],
                        note="Sin verosimilitud positiva; plausibilidad sin cambios.",
                    )
                )
            continue
        for h_id in ids:
            posterior = unnormalized[h_id] / norm
            updates.append(
                BayesianUpdate(
                    hypothesis_id=h_id,
                    microtest_id=microtest_id,
                    response=response,
                    likelihood=likelihoods[h_id],
                    prior=plausibility[h_id],
                    posterior=posterior,
                    note="",
                )
            )
            plausibility[h_id] = posterior

    sorted_hyps = sorted(plausibility.items(), key=lambda item: item[1], reverse=True)
    most_plausible, max_plausibility = sorted_hyps[0]
    above = [
        h_id
        for h_id, value in plausibility.items()
        if value >= threshold and value > 0
    ]
    contradictory = [
        h_id for h_id, value in plausibility.items() if value <= 1e-9
    ]
    if len(above) == 1:
        diagnosis = above[0]
    elif len(above) > 1:
        diagnosis = "multiple"
    else:
        diagnosis = None

    return BayesianDiagnosis(
        plausibilities=plausibility,
        most_plausible=most_plausible,
        max_plausibility=max_plausibility,
        threshold=threshold,
        diagnosis=diagnosis,
        contradictory=contradictory,
        updates=updates,
    )


def run_bayesian_session(
    bank: Bank,
    *,
    pattern_id: str,
    profile: Profile,
    seed: int,
    max_per_session: int = MAX_MICROTESTS_PER_SESSION,
    session_id: int = 0,
    prior: Mapping[str, float] | None = None,
    threshold: float = DIAGNOSIS_THRESHOLD,
) -> tuple[SessionResult, BayesianDiagnosis]:
    """Ejecuta una sesión idéntica a la de producción (mismo selector y
    respuestas para la misma semilla) y aplica el diagnóstico bayesiano
    sobre las mismas respuestas observadas."""
    from .simulation import run_session

    session = run_session(
        bank,
        pattern_id=pattern_id,
        profile=profile,
        seed=seed,
        selection_mode="adaptive",
        max_per_session=max_per_session,
        session_id=session_id,
    )
    answers = [(r.microtest_id, r.response) for r in session.answers]
    diagnosis = bayesian_diagnosis(bank, pattern_id, answers, prior=prior, threshold=threshold)
    return session, diagnosis


def comparison_experiment(
    bank: Bank,
    sessions_per_profile: int = 20,
    seed: int = 2026,
) -> dict:
    """Compara el diagnóstico de producción (reglas deterministas) con el
    prototipo bayesiano sobre las MISMAS sesiones sintéticas, semillas y
    perfiles. El selector y las respuestas son idénticos; solo difiere la
    regla de decisión final."""
    from .profiles import profiles_for
    from .simulation import run_session, run_experiment

    patterns = ("RANGE", "ACUMULADORES", "CONDICIONALES", "FUNCIONES")
    sessions: list[SessionResult] = []
    session_id = 0
    for pattern_index, pattern_id in enumerate(patterns):
        profiles = profiles_for(bank, pattern_id, noise=0.0)
        for profile_index, profile in enumerate(profiles):
            for session_index in range(sessions_per_profile):
                seed_value = _session_seed(seed, pattern_index, profile_index, session_index)
                session = run_session(
                    bank,
                    pattern_id=pattern_id,
                    profile=profile,
                    seed=seed_value,
                    selection_mode="adaptive",
                    session_id=session_id,
                )
                sessions.append(session)
                session_id += 1

    from .metrics import identification_accuracy, confusion_matrix, _diagnosis_label

    rules_targets = [s for s in sessions if s.target_hypothesis]
    rules_correct = sum(1 for s in rules_targets if s.diagnosis == s.target_hypothesis)

    bayesian_correct = 0
    bayesian_targets = 0
    agreements = 0
    both_insufficient = 0
    for session in sessions:
        if not session.target_hypothesis:
            continue
        bayesian = bayesian_diagnosis(
            bank, session.pattern_id, [(r.microtest_id, r.response) for r in session.answers]
        )
        bayesian_targets += 1
        if bayesian.diagnosis == session.target_hypothesis:
            bayesian_correct += 1
        rules_label = _diagnosis_label(session)
        bayes_label = (
            bayesian.diagnosis
            if bayesian.diagnosis is not None
            else ("insufficient" if not session.resolved else "none")
        )
        if rules_label == bayes_label:
            agreements += 1
        if rules_label == "insufficient" and bayes_label == "insufficient":
            both_insufficient += 1

    return {
        "sessions": len(sessions),
        "targeted_sessions": len(rules_targets),
        "agreement_rate": round(agreements / len(rules_targets), 4) if rules_targets else 0.0,
        "both_insufficient": both_insufficient,
        "rules": {
            "identification_accuracy": round(rules_correct / len(rules_targets), 4)
            if rules_targets
            else 0.0,
            "confusion_matrix": confusion_matrix([s for s in sessions if s.target_hypothesis]),
        },
        "bayesian": {
            "identification_accuracy": round(bayesian_correct / bayesian_targets, 4)
            if bayesian_targets
            else 0.0,
        },
        "caveats": [
            "El prototipo bayesiano no es el motor de producción.",
            "Priors y verosimilitudes son supuestos declarados, no parámetros estimados con datos.",
            "La comparación usa las mismas sesiones, semillas y perfiles para ambos diagnósticos.",
            "No hay prevalencias reales de concepciones erróneas; las probabilidades son plausibilidades de simulación.",
        ],
    }
