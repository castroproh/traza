"""Comparación controlada del banco y los métodos de selección/decisión."""

from __future__ import annotations

from dataclasses import replace
from math import isfinite

from .bayesian import DIAGNOSIS_THRESHOLD, bayesian_diagnosis
from .experiments import PATTERNS
from .metrics import compute_metrics
from .models import Bank, ExperimentConfig, ExperimentResult
from .simulation import run_experiment

NEW_MICROTEST_IDS = ("range-un-argumento-01", "acc-inicial-cero-02")
DEFAULT_NOISE_LEVELS = (0.0, 0.1, 0.2, 0.4)


def _with_new_microtests(bank: Bank, included: tuple[str, ...]) -> Bank:
    missing = [microtest_id for microtest_id in NEW_MICROTEST_IDS if microtest_id not in bank.microtests]
    if missing:
        raise ValueError(f"Faltan micropruebas requeridas para la ablación: {missing}")

    excluded = set(NEW_MICROTEST_IDS) - set(included)
    microtests = {
        microtest_id: microtest
        for microtest_id, microtest in bank.microtests.items()
        if microtest_id not in excluded
    }
    pairs = tuple(
        replace(
            pair,
            microtest_ids=tuple(
                microtest_id for microtest_id in pair.microtest_ids if microtest_id not in excluded
            ),
        )
        for pair in bank.pairs
    )
    return replace(bank, microtests=microtests, pairs=pairs)


def _config(
    name: str,
    sessions_per_profile: int,
    seed: int,
    noise_levels: tuple[float, ...],
    selection_mode: str,
) -> ExperimentConfig:
    return ExperimentConfig(
        name=name,
        seed=seed,
        sessions_per_profile=sessions_per_profile,
        patterns=PATTERNS,
        noise_levels=noise_levels,
        selection_modes=(selection_mode,),
    )


def _bayesian_result(
    bank: Bank,
    adaptive_result: ExperimentResult,
    threshold: float,
) -> ExperimentResult:
    sessions = []
    for session in adaptive_result.sessions:
        answers = [(answer.microtest_id, answer.response) for answer in session.answers]
        diagnosis = bayesian_diagnosis(
            bank,
            session.pattern_id,
            answers,
            threshold=threshold,
        )
        chosen = diagnosis.diagnosis
        normative = bool(chosen and bank.hypotheses.get(chosen) and bank.hypotheses[chosen].normative)
        statuses: dict[str, str] = {}
        for hypothesis in bank.hypotheses_for(session.pattern_id):
            if hypothesis.id in diagnosis.contradictory:
                status = "contradicted"
            elif chosen == hypothesis.id or (
                chosen == "multiple" and diagnosis.plausibilities[hypothesis.id] >= threshold
            ):
                status = "supported"
            else:
                status = "insufficient"
            statuses[hypothesis.id] = status

        unresolved = [hypothesis_id for hypothesis_id, status in statuses.items() if status == "insufficient"]
        sessions.append(
            replace(
                session,
                selection_mode="adaptive+bayesian",
                statuses=statuses,
                unresolved=unresolved,
                resolved=chosen is not None,
                end_action="sufficient" if chosen is not None else "insufficient",
                diagnosis=chosen,
                identification=(
                    "multiple"
                    if chosen == "multiple"
                    else "normative"
                    if normative
                    else "identified"
                    if chosen
                    else "insufficient"
                ),
                true_hypothesis_contradicted=bool(
                    session.target_hypothesis
                    and session.target_hypothesis in diagnosis.contradictory
                ),
                normative_diagnosis=normative,
            )
        )

    config = replace(
        adaptive_result.config,
        name="D_26_bayesian_threshold",
        selection_modes=("adaptive+bayesian",),
    )
    notes = [
        "Se reutilizan exactamente las respuestas y micropruebas de B_26_adaptive.",
        f"La decisión final usa el umbral experimental configurable {threshold:.2f}.",
        "La selección sigue siendo adaptive; el prototipo Bayes solo cambia la decisión final.",
        "No se usan hipótesis generadoras para seleccionar micropruebas.",
    ]
    return ExperimentResult(
        name=config.name,
        config=config,
        sessions=sessions,
        metrics=compute_metrics(bank, sessions),
        notes=notes,
    )


def ablation_experiment(
    bank: Bank,
    *,
    sessions_per_profile: int = 20,
    seed: int = 2026,
    noise_levels: tuple[float, ...] = DEFAULT_NOISE_LEVELS,
    threshold: float = DIAGNOSIS_THRESHOLD,
) -> list[ExperimentResult]:
    """Compara 24/25/26 ítems, ganancia de información y decisión bayesiana.

    A-D corresponden al contraste solicitado; E/F dejan cada ítem nuevo por
    separado para poder atribuir su contribución. Todos comparten patrones,
    perfiles, niveles de ruido, semillas por sesión y límite. D reutiliza las
    selecciones y respuestas de B y cambia solo la decisión final.
    """
    if sessions_per_profile < 1:
        raise ValueError("sessions_per_profile debe ser al menos 1.")
    if not isfinite(threshold) or not 0 < threshold <= 1:
        raise ValueError("threshold debe ser un número mayor que 0 y menor o igual que 1.")
    if not noise_levels or any(
        not isfinite(level) or level < 0 or level > 1 for level in noise_levels
    ):
        raise ValueError("noise_levels debe contener valores entre 0 y 1.")

    bank_24 = _with_new_microtests(bank, ())
    bank_25_range = _with_new_microtests(bank, ("range-un-argumento-01",))
    bank_25_accumulator = _with_new_microtests(bank, ("acc-inicial-cero-02",))
    arm_a = run_experiment(
        bank_24,
        _config("A_24_adaptive", sessions_per_profile, seed, noise_levels, "adaptive"),
    )
    arm_b = run_experiment(
        bank,
        _config("B_26_adaptive", sessions_per_profile, seed, noise_levels, "adaptive"),
    )
    arm_c = run_experiment(
        bank,
        _config("C_26_information_gain", sessions_per_profile, seed, noise_levels, "information_gain"),
    )
    arm_d = _bayesian_result(bank, arm_b, threshold)
    arm_e = run_experiment(
        bank_25_range,
        _config("E_25_range_only", sessions_per_profile, seed, noise_levels, "adaptive"),
    )
    arm_f = run_experiment(
        bank_25_accumulator,
        _config("F_25_accumulator_only", sessions_per_profile, seed, noise_levels, "adaptive"),
    )
    return [
        arm_a,
        arm_b,
        arm_c,
        arm_d,
        arm_e,
        arm_f,
    ]
