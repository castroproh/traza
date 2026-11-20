"""Métricas agregadas de las simulaciones.

Las métricas describen el comportamiento del instrumento frente a perfiles
artificiales. No son estimaciones psicométricas ni prevalencias educativas.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from math import sqrt
from statistics import mean, median
from typing import Iterable

from .models import Bank, SessionResult

DIAGNOSIS_KEYS = ("none", "normative", "insufficient", "multiple")

# Nivel de confianza de los intervalos de incertidumbre de simulación.
# Se trata de incertidumbre de muestreo sobre los perfiles sintéticos,
# NO de inferencia sobre una población estudiantil real.
CONFIDENCE_Z = 1.96


def _rate(numerator: float, denominator: float) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _wilson_interval(successes: float, n: int, z: float = CONFIDENCE_Z) -> tuple[float, float]:
    """Intervalo de Wilson para una proporción simulada.

    Devuelve (limite_inferior, limite_superior) en [0, 1]. Cuando n es 0
    devuelve (0.0, 0.0). Los límites describen variabilidad de muestreo sobre
    las sesiones sintéticas generadas, nunca prevalencia en estudiantes.
    """
    if n <= 0:
        return (0.0, 0.0)
    p = successes / n
    denominator = 1.0 + z * z / n
    center = (p + z * z / (2 * n)) / denominator
    half = (
        z
        * sqrt((p * (1 - p) + z * z / (4 * n)) / n)
        / denominator
    )
    return (round(max(0.0, center - half), 4), round(min(1.0, center + half), 4))


def _diagnosis_label(session: SessionResult) -> str:
    if session.normative_diagnosis:
        return "normative"
    if session.diagnosis is None:
        return "insufficient" if not session.resolved else "none"
    return session.diagnosis


def _rate_with_interval(successes: int, n: int) -> dict[str, float]:
    rate = _rate(successes, n)
    low, high = _wilson_interval(successes, n)
    return {"rate": rate, "n": n, "ci_low": low, "ci_high": high}


def _safe_mean(values: Iterable[float]) -> float:
    items = list(values)
    return round(mean(items), 4) if items else 0.0


def _safe_median(values: Iterable[float]) -> float:
    items = list(values)
    return round(median(items), 4) if items else 0.0


def confusion_matrix(sessions: list[SessionResult]) -> dict[str, dict[str, int]]:
    """Matriz hipótesis generadora -> diagnóstico emitido.

    Solo incluye sesiones con una hipótesis generadora (perfiles
    ``hypothesis``). Las claves de diagnóstico son ids de hipótesis o
    ``none`` / ``insufficient`` / ``multiple``.
    """
    matrix: dict[str, Counter[str]] = defaultdict(Counter)
    for session in sessions:
        if not session.target_hypothesis:
            continue
        matrix[session.target_hypothesis][_diagnosis_label(session)] += 1
    return {target: dict(counter) for target, counter in sorted(matrix.items())}


def confusion_matrix_by_pattern(
    sessions: list[SessionResult],
) -> dict[str, dict[str, dict[str, int]]]:
    """Matriz de confusión desglosada por patrón."""
    result: dict[str, dict[str, dict[str, int]]] = {}
    for key, group in _group_by(sessions, "pattern_id").items():
        result[key[0]] = confusion_matrix(group)
    return result


def identification_accuracy(sessions: list[SessionResult]) -> float:
    targets = [s for s in sessions if s.target_hypothesis]
    correct = sum(1 for s in targets if s.diagnosis == s.target_hypothesis)
    return _rate(correct, len(targets))


def coverage(sessions: list[SessionResult]) -> float:
    """Proporción de hipótesis decididas (apoyadas o contradichas) por sesión."""
    values = []
    for session in sessions:
        if not session.statuses:
            continue
        decided = sum(1 for status in session.statuses.values() if status != "insufficient")
        values.append(decided / len(session.statuses))
    return _safe_mean(values)


def summarise_group(sessions: list[SessionResult]) -> dict:
    """Agrega métricas de un grupo de sesiones.

    Denominadores documentados:
    - resolución, abstención, sin concepción alternativa, múltiple, uso de
      micropruebas y respuestas ambiguas: denominador = todas las sesiones del
      grupo.
    - exactitud de identificación y falsos positivos: denominador = sesiones
      con hipótesis generadora estable (perfiles ``hypothesis``). Los perfiles
      ``known_only`` y otros perfiles sin una generadora única no entran en el
      numerador ni en el denominador de exactitud.
    - no_misconception_rate incluye diagnósticos normativos (comprensión
      correcta) y sesiones resueltas sin diagnóstico; todas las sesiones del
      grupo son el denominador.
    """
    n = len(sessions)
    resolved = sum(1 for s in sessions if s.resolved)
    abstained = sum(1 for s in sessions if s.diagnosis is None and not s.resolved)
    no_misconception = sum(
        1
        for s in sessions
        if (s.diagnosis is None and s.resolved) or s.normative_diagnosis
    )
    multiple = sum(1 for s in sessions if s.diagnosis == "multiple")
    normative = sum(1 for s in sessions if s.normative_diagnosis)
    targets = [s for s in sessions if s.target_hypothesis]
    correct = sum(1 for s in targets if s.diagnosis == s.target_hypothesis)
    wrong = sum(
        1
        for s in targets
        if s.diagnosis not in (None, "multiple")
        and not s.normative_diagnosis
        and s.diagnosis != s.target_hypothesis
    )
    return {
        "sessions": n,
        "resolution_rate": _rate(resolved, n),
        "resolution_rate_ci": _rate_with_interval(resolved, n),
        "abstention_rate": _rate(abstained, n),
        "abstention_rate_ci": _rate_with_interval(abstained, n),
        "no_misconception_rate": _rate(no_misconception, n),
        "normative_rate": _rate(normative, n),
        "multiple_rate": _rate(multiple, n),
        "multiple_rate_ci": _rate_with_interval(multiple, n),
        "identification_accuracy": _rate(correct, len(targets)),
        "identification_accuracy_ci": _rate_with_interval(correct, len(targets)),
        "false_positive_rate": _rate(wrong, len(targets)),
        "false_positive_rate_ci": _rate_with_interval(wrong, len(targets)),
        "coverage_mean": coverage(sessions),
        "microtests_mean": _safe_mean(s.microtests_used for s in sessions),
        "microtests_median": _safe_median(s.microtests_used for s in sessions),
        "microtests_max": max((s.microtests_used for s in sessions), default=0),
        "ambiguous_answers_mean": _safe_mean(s.ambiguous_answers for s in sessions),
        "total_microtests": sum(s.microtests_used for s in sessions),
    }


def false_positive_rate_from_sessions(sessions: list[SessionResult]) -> float:
    targets = [s for s in sessions if s.target_hypothesis]
    wrong = sum(
        1
        for s in targets
        if s.diagnosis not in (None, "multiple")
        and not s.normative_diagnosis
        and s.diagnosis != s.target_hypothesis
    )
    return _rate(wrong, len(targets))


def _group_by(sessions: list[SessionResult], *keys: str) -> dict[tuple[str, ...], list[SessionResult]]:
    groups: dict[tuple[str, ...], list[SessionResult]] = defaultdict(list)
    for session in sessions:
        group = tuple(str(getattr(session, key)) for key in keys)
        groups[group].append(session)
    return groups


def compute_metrics(bank: Bank, sessions: list[SessionResult]) -> dict:
    by_pattern = {
        key[0]: summarise_group(group)
        for key, group in sorted(_group_by(sessions, "pattern_id").items())
    }
    by_profile = {
        key[0]: summarise_group(group)
        for key, group in sorted(_group_by(sessions, "profile").items())
    }
    by_selection = {
        key[0]: summarise_group(group)
        for key, group in sorted(_group_by(sessions, "selection_mode").items())
    }
    by_noise = {
        key[0]: summarise_group(group)
        for key, group in sorted(_group_by(sessions, "noise").items())
    }
    by_pattern_selection = {
        f"{key[0]}::{key[1]}": summarise_group(group)
        for key, group in sorted(_group_by(sessions, "pattern_id", "selection_mode").items())
    }

    hypothesis_profiles = [s for s in sessions if s.profile_kind == "hypothesis"]
    noisy = [s for s in hypothesis_profiles if s.noise > 0]
    clean = [s for s in hypothesis_profiles if s.noise == 0]

    return {
        "overall": summarise_group(sessions),
        "byPattern": by_pattern,
        "byProfile": by_profile,
        "bySelection": by_selection,
        "byNoise": by_noise,
        "byPatternSelection": by_pattern_selection,
        "confusionMatrix": confusion_matrix(sessions),
        "confusionMatrixByPattern": confusion_matrix_by_pattern(sessions),
        "noiseResistance": {
            "cleanSessions": len(clean),
            "noisySessions": len(noisy),
            "cleanAccuracy": identification_accuracy(clean),
            "noisyAccuracy": identification_accuracy(noisy),
            "accuracyDrop": round(
                identification_accuracy(clean) - identification_accuracy(noisy), 4
            ),
        },
        "instrument": {
            "version": bank.version,
            "hypotheses": len(bank.hypotheses),
            "microtests": len(bank.microtests),
            "pairs": len(bank.pairs),
        },
        "caveats": [
            "Métricas calculadas sobre perfiles artificiales, no sobre estudiantes reales.",
            "La exactitud de identificación no mide aprendizaje ni validez psicométrica.",
            "Los resultados dependen de las firmas del banco y de los supuestos del simulador.",
        ],
    }
