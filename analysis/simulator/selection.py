"""Selectores de micropruebas.

- ``adaptive``: replica la selección determinista de TRAZA 0.8.0.
- ``fixed``: línea base que recorre el banco en su orden.
- ``information_gain``: selector experimental; no se usa en producción.

El selector experimental solo recibe el patrón, las respuestas ya observadas y
las firmas públicas del banco. Nunca recibe la hipótesis que generó las
respuestas.
"""

from __future__ import annotations

import math

from .evidence import evaluate_microtest, evaluate_pattern, same_response
from .models import Bank, DiscriminationPair, Microtest, Selection

MAX_MICROTESTS_PER_SESSION = 8


def _pair_resolved(bank: Bank, pair: DiscriminationPair, answers: list[tuple[str, str]]) -> bool:
    lookup = dict(answers)
    for microtest_id in pair.microtest_ids:
        response = lookup.get(microtest_id)
        microtest = bank.microtests.get(microtest_id)
        if response is None or microtest is None:
            continue
        evaluations = {e.hypothesis_id: e for e in evaluate_microtest(bank, microtest, response)}
        left = evaluations.get(pair.hypothesis_a_id)
        right = evaluations.get(pair.hypothesis_b_id)
        if (left and left.state == "contradicts") or (right and right.state == "contradicts"):
            return True
    return False


def _decided_hypotheses(bank: Bank, answers: list[tuple[str, str]]) -> set[str]:
    decided: set[str] = set()
    for microtest_id, response in answers:
        microtest = bank.microtests.get(microtest_id)
        if microtest is None:
            continue
        for evaluation in evaluate_microtest(bank, microtest, response):
            if evaluation.state in ("supports", "contradicts"):
                decided.add(evaluation.hypothesis_id)
    return decided


def _can_challenge(microtest: Microtest, hypothesis_id: str) -> bool:
    return any(
        response.strip() != microtest.expected_outcome.strip()
        for response in microtest.signatures.get(hypothesis_id, ())
    )


def select_adaptive(
    bank: Bank,
    pattern_id: str,
    answers: list[tuple[str, str]],
    max_per_session: int = MAX_MICROTESTS_PER_SESSION,
) -> Selection:
    """Selección determinista equivalente a ``src/domain/diagnosis/selection.ts``."""
    if len(answers) >= max_per_session:
        return Selection(
            action="limit",
            reason=f"Se alcanzó el límite de micropruebas por sesión ({max_per_session}).",
        )

    answered_ids = {microtest_id for microtest_id, _ in answers}
    decided = _decided_hypotheses(bank, answers)
    uncovered = [h for h in bank.hypotheses_for(pattern_id) if h.id not in decided]

    if uncovered:
        candidates = [
            microtest
            for microtest in bank.microtests_for(pattern_id)
            if microtest.id not in answered_ids
            and any(
                hypothesis.id in microtest.target_hypotheses and _can_challenge(microtest, hypothesis.id)
                for hypothesis in uncovered
            )
        ]
        if candidates:
            chosen = sorted(candidates, key=lambda item: item.id)[0]
            targeted = next(
                (
                    hypothesis.id
                    for hypothesis in uncovered
                    if hypothesis.id in chosen.target_hypotheses and _can_challenge(chosen, hypothesis.id)
                ),
                "una hipótesis pendiente",
            )
            return Selection(
                action="selected",
                microtest_id=chosen.id,
                reason=(
                    f"Se seleccionó {chosen.id} porque permite distinguir explicaciones rivales "
                    f"y todavía no hay evidencia concluyente sobre {targeted}."
                ),
            )

    pairs = bank.pairs_for(pattern_id)
    unresolved_pairs = [pair for pair in pairs if not _pair_resolved(bank, pair, answers)]
    if not unresolved_pairs:
        return Selection(
            action="sufficient",
            reason="La evidencia ya separa las hipótesis rivales del patrón.",
        )

    candidates = [
        microtest
        for microtest in bank.microtests_for(pattern_id)
        if microtest.id not in answered_ids
        and any(
            microtest.id in pair.microtest_ids and not _pair_resolved(bank, pair, answers)
            for pair in pairs
        )
    ]
    if not candidates:
        pair = unresolved_pairs[0]
        return Selection(
            action="insufficient",
            reason=(
                "Ninguna microprueba pendiente resuelve la ambigüedad entre "
                f"{pair.hypothesis_a_id} y {pair.hypothesis_b_id}."
            ),
        )

    chosen = sorted(candidates, key=lambda item: item.id)[0]
    target_pair = next(
        (
            pair
            for pair in pairs
            if chosen.id in pair.microtest_ids and not _pair_resolved(bank, pair, answers)
        ),
        None,
    )
    pair_label = (
        f"{target_pair.hypothesis_a_id} y {target_pair.hypothesis_b_id}"
        if target_pair
        else "las hipótesis pendientes"
    )
    return Selection(
        action="selected",
        microtest_id=chosen.id,
        reason=f"Se seleccionó {chosen.id} porque permite distinguir entre {pair_label}.",
    )


def select_fixed(
    bank: Bank,
    pattern_id: str,
    answers: list[tuple[str, str]],
    max_per_session: int = MAX_MICROTESTS_PER_SESSION,
    order: list[str] | None = None,
) -> Selection:
    """Línea base: mismas micropruebas, en un orden fijo, sin adaptación."""
    if len(answers) >= max_per_session:
        return Selection(action="limit", reason="Se alcanzó el límite de micropruebas.")
    answered_ids = {microtest_id for microtest_id, _ in answers}
    sequence = order or [microtest.id for microtest in bank.microtests_for(pattern_id)]
    for microtest_id in sequence:
        if microtest_id not in answered_ids and microtest_id in bank.microtests:
            return Selection(
                action="selected",
                microtest_id=microtest_id,
                reason="Orden fijo del banco, sin adaptación.",
            )
    return Selection(action="insufficient", reason="No quedan micropruebas en el orden fijo.")


def _entropy(probabilities: list[float]) -> float:
    return -sum(p * math.log2(p) for p in probabilities if p > 0)


def _likelihood(
    microtest: Microtest,
    hypothesis_id: str,
    response: str,
    options: list[str],
    epsilon: float = 0.05,
) -> float:
    predicted = microtest.signatures.get(hypothesis_id, ())
    if any(same_response(response, value) for value in predicted):
        return 0.9
    if same_response(response, microtest.expected_outcome):
        # Una hipótesis sin firma en esta prueba se considera que acierta.
        return 0.8 if not predicted else 0.05
    return epsilon / max(1, len(options) - 1)


def select_information_gain(
    bank: Bank,
    pattern_id: str,
    answers: list[tuple[str, str]],
    max_per_session: int = MAX_MICROTESTS_PER_SESSION,
) -> Selection:
    """Selector experimental por ganancia de información esperada.

    Supuestos explícitos (no probabilidades de estudiantes reales):
    - Prior uniforme sobre las hipótesis aún no contradichas.
    - Verosimilitud alta (0.9) si la respuesta coincide con la firma;
      0.8 para la respuesta correcta cuando la hipótesis no tiene firma;
      0.05 para la respuesta correcta cuando la hipótesis predice otra cosa;
      ruido uniforme ``epsilon`` en el resto.
    """
    if len(answers) >= max_per_session:
        return Selection(action="limit", reason="Se alcanzó el límite de micropruebas.")

    statuses, _, _, _ = evaluate_pattern(bank, pattern_id, answers)
    open_hypotheses = [
        hypothesis.id
        for hypothesis in bank.hypotheses_for(pattern_id)
        if statuses.get(hypothesis.id) != "contradicted"
    ]
    if not open_hypotheses:
        return Selection(action="sufficient", reason="Todas las hipótesis fueron contradichas.")

    answered_ids = {microtest_id for microtest_id, _ in answers}
    candidates = [
        microtest for microtest in bank.microtests_for(pattern_id) if microtest.id not in answered_ids
    ]
    if not candidates:
        return Selection(action="insufficient", reason="No quedan micropruebas disponibles.")

    prior = {hypothesis_id: 1.0 / len(open_hypotheses) for hypothesis_id in open_hypotheses}
    best: tuple[float, str, str] | None = None
    for microtest in sorted(candidates, key=lambda item: item.id):
        options = microtest.options()
        expected_entropy = 0.0
        for response in options:
            likelihoods = {
                hypothesis_id: _likelihood(microtest, hypothesis_id, response, options)
                for hypothesis_id in open_hypotheses
            }
            total = sum(prior[h] * likelihoods[h] for h in open_hypotheses)
            if total <= 0:
                continue
            expected_entropy += total * _entropy([prior[h] * likelihoods[h] / total for h in open_hypotheses])
        candidate = (expected_entropy, microtest.id, microtest.objective)
        if best is None or candidate[0] < best[0] - 1e-12:
            best = candidate

    if best is None:
        return Selection(action="insufficient", reason="No se pudo calcular ganancia de información.")
    return Selection(
        action="selected",
        microtest_id=best[1],
        reason=(
            f"Se seleccionó {best[1]} porque minimiza la entropía esperada sobre "
            f"{len(open_hypotheses)} hipótesis todavía abiertas (criterio experimental)."
        ),
    )


SELECTORS = {
    "adaptive": select_adaptive,
    "fixed": select_fixed,
    "information_gain": select_information_gain,
}
