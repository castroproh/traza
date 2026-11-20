"""Reglas de interpretación de evidencias, replicadas del motor TypeScript.

Estas reglas son deliberadamente deterministas y no probabilísticas. Cualquier
cambio en ``src/domain/diagnosis/evidence.ts`` debe reflejarse aquí y en las
pruebas de consistencia.
"""

from __future__ import annotations

import re
import unicodedata

from .models import Bank, Evaluation, Microtest

UNCERTAIN_RESPONSES = {
    "noestoyseguro",
    "noestoysegura",
    "noseguro",
    "nosegura",
    "nose",
    "nolose",
    "nolase",
}


def normalize_response(response: str) -> str:
    """Misma normalización que el motor web: recorta y elimina espacios."""
    return re.sub(r"\s+", "", response.strip())


def same_response(left: str, right: str) -> bool:
    return normalize_response(left) == normalize_response(right)


def is_uncertain_response(response: str) -> bool:
    normalized = unicodedata.normalize("NFD", normalize_response(response).lower())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return normalized in UNCERTAIN_RESPONSES


def interpret_response(
    bank: Bank,
    microtest: Microtest,
    hypothesis_id: str,
    observed_response: str,
) -> Evaluation:
    hypothesis = bank.hypotheses.get(hypothesis_id)
    predicted = tuple(microtest.signatures.get(hypothesis_id, ()))
    observed = observed_response.strip()
    predicted_matches = any(same_response(value, observed) for value in predicted)
    includes_expected = any(same_response(value, microtest.expected_outcome) for value in predicted)
    is_correct = same_response(observed, microtest.expected_outcome)
    ambiguous = any(same_response(value, observed) for value in microtest.ambiguity_cases)
    all_predicted = [value for values in microtest.signatures.values() for value in values]
    has_distinct_wrong_prediction = any(
        not same_response(value, microtest.expected_outcome) for value in all_predicted
    )

    if ambiguous or is_uncertain_response(observed):
        state = "insufficient"
        reason = "La respuesta expresa ambigüedad o incertidumbre; se mantiene la evidencia sin resolver."
    elif predicted_matches and is_correct and not (hypothesis and hypothesis.normative) and has_distinct_wrong_prediction:
        state = "insufficient"
        reason = (
            "La respuesta coincide con el resultado correcto y también sería compatible con esta "
            "explicación; la prueba no permite distinguirla de una comprensión correcta."
        )
    elif predicted_matches:
        state = "supports"
        reason = "La respuesta observada coincide con una predicción de la hipótesis."
    elif includes_expected:
        state = "contradicts"
        reason = "La hipótesis predecía el resultado correcto; la respuesta observada no la respalda."
    elif is_correct:
        state = "contradicts"
        reason = "La respuesta coincide con el resultado correcto y la hipótesis predice otra cosa."
    else:
        state = "insufficient"
        reason = "La respuesta no coincide con la predicción ni con el resultado correcto; no permite distinguir."

    return Evaluation(
        hypothesis_id=hypothesis_id,
        microtest_id=microtest.id,
        state=state,
        observed_response=observed,
        predicted_responses=predicted,
        reason=reason,
    )


def evaluate_microtest(bank: Bank, microtest: Microtest, observed_response: str) -> list[Evaluation]:
    return [
        interpret_response(bank, microtest, hypothesis_id, observed_response)
        for hypothesis_id in microtest.target_hypotheses
    ]


def evaluate_pattern(
    bank: Bank,
    pattern_id: str,
    answers: list[tuple[str, str]],
) -> tuple[dict[str, str], list[str], bool, list[Evaluation]]:
    """Devuelve estados, hipótesis sin resolver, si quedó resuelto y evaluaciones."""
    statuses: dict[str, str] = {}
    evaluations: list[Evaluation] = []
    by_hypothesis: dict[str, list[str]] = {}
    for microtest_id, response in answers:
        microtest = bank.microtests.get(microtest_id)
        if microtest is None or microtest.pattern_id != pattern_id:
            continue
        for evaluation in evaluate_microtest(bank, microtest, response):
            evaluations.append(evaluation)
            by_hypothesis.setdefault(evaluation.hypothesis_id, []).append(evaluation.state)

    unresolved: list[str] = []
    for hypothesis in bank.hypotheses_for(pattern_id):
        states = by_hypothesis.get(hypothesis.id, [])
        if "contradicts" in states:
            status = "contradicted"
        elif "supports" in states:
            status = "supported"
        else:
            status = "insufficient"
        statuses[hypothesis.id] = status
        if status == "insufficient":
            unresolved.append(hypothesis.id)

    resolved = not unresolved
    return statuses, unresolved, resolved, evaluations


def supported_hypotheses(statuses: dict[str, str]) -> list[str]:
    return [hypothesis_id for hypothesis_id, status in statuses.items() if status == "supported"]
