"""Generación de respuestas sintéticas a partir de las firmas del banco."""

from __future__ import annotations

import random

from .models import Bank, Microtest, Profile


def _first_signature(microtest: Microtest, hypothesis_id: str) -> str | None:
    responses = microtest.signatures.get(hypothesis_id, ())
    return responses[0] if responses else None


def _uncertain(microtest: Microtest) -> str:
    return microtest.ambiguity_cases[0] if microtest.ambiguity_cases else "No estoy seguro"


def _weighted_choice(weights: dict[str, float], rng: random.Random) -> str | None:
    total = sum(max(0.0, weight) for weight in weights.values())
    if total <= 0:
        return None
    point = rng.random() * total
    cumulative = 0.0
    for key, weight in weights.items():
        cumulative += max(0.0, weight)
        if point <= cumulative:
            return key
    return next(reversed(weights))


def base_response(
    bank: Bank,
    microtest: Microtest,
    profile: Profile,
    rng: random.Random,
) -> str:
    """Respuesta coherente con el perfil, antes de aplicar ruido."""
    if profile.kind == "correct":
        return microtest.expected_outcome

    if profile.kind == "random":
        return rng.choice(microtest.options())

    if profile.kind == "ambiguous" and rng.random() < profile.ambiguity_rate:
        return _uncertain(microtest)

    if profile.kind == "mixed":
        weights = {
            hypothesis_id: weight
            for hypothesis_id, weight in (profile.weights or {}).items()
            if hypothesis_id in microtest.target_hypotheses
        }
        chosen = _weighted_choice(weights, rng)
        return (_first_signature(microtest, chosen) if chosen else None) or microtest.expected_outcome

    if profile.kind == "inconsistent" and rng.random() < profile.inconsistency_rate:
        alternatives = [
            hypothesis_id
            for hypothesis_id in microtest.target_hypotheses
            if hypothesis_id != profile.hypothesis_id
        ]
        if alternatives:
            chosen = rng.choice(alternatives)
            return _first_signature(microtest, chosen) or microtest.expected_outcome

    if profile.kind == "known_only" and microtest.difficulty == "beginner":
        return microtest.expected_outcome

    if profile.hypothesis_id and profile.hypothesis_id in microtest.signatures:
        return _first_signature(microtest, profile.hypothesis_id) or microtest.expected_outcome

    return microtest.expected_outcome


def generate_response(
    bank: Bank,
    microtest: Microtest,
    profile: Profile,
    rng: random.Random,
) -> str:
    """Respuesta final: base del perfil + ambigüedad + ruido controlado."""
    response = base_response(bank, microtest, profile, rng)

    if profile.kind != "ambiguous" and profile.ambiguity_rate > 0 and rng.random() < profile.ambiguity_rate:
        return _uncertain(microtest)

    if profile.noise > 0 and rng.random() < profile.noise:
        candidates = [option for option in microtest.wrong_options() if option != response]
        if candidates:
            response = rng.choice(candidates)

    return response


def response_frequencies(bank: Bank, microtest_ids: list[str]) -> dict[str, dict[str, float]]:
    """Distribución uniforme de opciones, útil para auditorías del banco."""
    result: dict[str, dict[str, float]] = {}
    for microtest_id in microtest_ids:
        microtest = bank.microtests.get(microtest_id)
        if microtest is None:
            continue
        options = microtest.options()
        result[microtest_id] = {option: 1.0 / len(options) for option in options} if options else {}
    return result
