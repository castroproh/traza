"""Perfiles sintéticos de respuesta.

IMPORTANTE: estos perfiles son reglas artificiales para probar el instrumento.
No representan prevalencias, porcentajes ni personas reales.
"""

from __future__ import annotations

from .models import Bank, Profile


def hypothesis_profile(hypothesis_id: str, noise: float = 0.0) -> Profile:
    return Profile(
        name=f"hipotesis::{hypothesis_id}",
        kind="hypothesis",
        hypothesis_id=hypothesis_id,
        noise=noise,
        description=(
            f"Responde siguiendo la firma de {hypothesis_id} cuando la prueba la evalúa; "
            "en las demás pruebas acierta."
        ),
    )


def correct_profile(noise: float = 0.0) -> Profile:
    return Profile(
        name="correcto",
        kind="correct",
        noise=noise,
        description="Responde siempre el resultado correcto (sin concepción alternativa).",
    )


def mixed_profile(pattern_hypotheses: list[str], noise: float = 0.0) -> Profile:
    weight = 1.0 / len(pattern_hypotheses) if pattern_hypotheses else 0.0
    return Profile(
        name="mixto",
        kind="mixed",
        weights={hypothesis_id: weight for hypothesis_id in pattern_hypotheses},
        noise=noise,
        description=(
            "Mezcla las firmas de las hipótesis del patrón: no mantiene una única "
            "concepción durante la sesión."
        ),
    )


def ambiguous_profile(ambiguity_rate: float = 0.5, noise: float = 0.0) -> Profile:
    return Profile(
        name=f"ambiguo::{int(ambiguity_rate * 100)}",
        kind="ambiguous",
        ambiguity_rate=ambiguity_rate,
        noise=noise,
        description=(
            f"Con probabilidad {ambiguity_rate:.0%} responde «No estoy seguro»; "
            "en el resto acierta."
        ),
    )


def inconsistent_profile(pattern_hypotheses: list[str], inconsistency_rate: float = 0.5) -> Profile:
    return Profile(
        name=f"inconsistente::{int(inconsistency_rate * 100)}",
        kind="inconsistent",
        ambiguity_rate=0.0,
        inconsistency_rate=inconsistency_rate,
        description=(
            f"Con probabilidad {inconsistency_rate:.0%} alterna la firma de otra hipótesis "
            "objetivo; no mantiene una concepción estable."
        ),
    )


def random_profile() -> Profile:
    return Profile(
        name="aleatorio",
        kind="random",
        description="Elige una opción visible al azar, sin relación con una concepción.",
    )


def occasional_error_profile(hypothesis_id: str, error_rate: float = 0.1) -> Profile:
    return Profile(
        name=f"error-ocasional::{hypothesis_id}",
        kind="hypothesis",
        hypothesis_id=hypothesis_id,
        noise=error_rate,
        description=(
            f"Sigue {hypothesis_id} y comete un error aleatorio en el "
            f"{error_rate:.0%} de las respuestas."
        ),
    )


def known_only_profile(hypothesis_id: str) -> Profile:
    return Profile(
        name=f"solo-conocidas::{hypothesis_id}",
        kind="known_only",
        hypothesis_id=hypothesis_id,
        description=(
            f"Acierta las micropruebas de dificultad inicial y aplica la firma de "
            f"{hypothesis_id} en las intermedias: no generaliza."
        ),
    )


def profiles_for(bank: Bank, pattern_id: str, noise: float = 0.0) -> list[Profile]:
    """Perfiles estándar de un patrón. El orden es estable para reproducibilidad."""
    hypotheses = bank.hypotheses_for(pattern_id)
    profile_list: list[Profile] = [correct_profile(noise=noise)]
    for hypothesis in hypotheses:
        if not hypothesis.normative:
            profile_list.append(hypothesis_profile(hypothesis.id, noise=noise))
    profile_list.append(mixed_profile([h.id for h in hypotheses], noise=noise))
    profile_list.append(ambiguous_profile(0.5, noise=noise))
    profile_list.append(inconsistent_profile([h.id for h in hypotheses], 0.5))
    profile_list.append(random_profile())
    if hypotheses:
        first = next((h for h in hypotheses if not h.normative), hypotheses[0])
        profile_list.append(occasional_error_profile(first.id, 0.1))
        profile_list.append(known_only_profile(first.id))
    return profile_list
