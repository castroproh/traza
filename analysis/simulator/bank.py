"""Carga y validación del banco diagnóstico exportado desde TRAZA."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import Bank, DiscriminationPair, Hypothesis, Microtest

DEFAULT_BANK_PATH = Path(__file__).with_name("bank.json")
EXPECTED_PATTERNS = ("RANGE", "ACUMULADORES", "CONDICIONALES", "FUNCIONES")


class BankIntegrityError(ValueError):
    """El banco exportado no es coherente con las reglas del simulador."""


def load_bank(path: str | Path = DEFAULT_BANK_PATH) -> Bank:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise BankIntegrityError("El banco debe ser un objeto JSON.")

    patterns: dict[str, dict[str, str]] = {}
    for pattern in data.get("patterns", []):
        pattern_id = str(pattern["id"])
        patterns[pattern_id] = {
            "id": pattern_id,
            "name": str(pattern.get("name", pattern_id)),
            "concept": str(pattern.get("concept", "")),
            "description": str(pattern.get("description", "")),
        }

    hypotheses: dict[str, Hypothesis] = {}
    for raw in data.get("hypotheses", []):
        hypothesis = Hypothesis(
            id=str(raw["id"]),
            pattern_id=str(raw["patternId"]),
            title=str(raw.get("title", raw["id"])),
            description=str(raw.get("description", "")),
            normative=bool(raw.get("normative", False)),
        )
        if hypothesis.id in hypotheses:
            raise BankIntegrityError(f"Hipótesis duplicada: {hypothesis.id}")
        hypotheses[hypothesis.id] = hypothesis

    microtests: dict[str, Microtest] = {}
    for raw in data.get("microtests", []):
        signatures = {
            str(hypothesis_id): tuple(str(value) for value in values)
            for hypothesis_id, values in dict(raw.get("responseSignatures", {})).items()
        }
        microtest = Microtest(
            id=str(raw["id"]),
            pattern_id=str(raw["patternId"]),
            target_hypotheses=tuple(str(value) for value in raw.get("targetHypotheses", [])),
            signatures=signatures,
            expected_outcome=str(raw["expectedOutcome"]),
            ambiguity_cases=tuple(str(value) for value in raw.get("ambiguityCases", [])),
            difficulty=str(raw.get("difficulty", "beginner")),
            objective=str(raw.get("objective", "")),
        )
        if microtest.id in microtests:
            raise BankIntegrityError(f"Microprueba duplicada: {microtest.id}")
        microtests[microtest.id] = microtest

    pairs: list[DiscriminationPair] = []
    for matrix in data.get("discriminationMatrices", []):
        for raw_pair in matrix.get("pairs", []):
            pairs.append(
                DiscriminationPair(
                    pattern_id=str(matrix["patternId"]),
                    hypothesis_a_id=str(raw_pair["hypothesisAId"]),
                    hypothesis_b_id=str(raw_pair["hypothesisBId"]),
                    microtest_ids=tuple(str(value) for value in raw_pair.get("discriminatingMicrotests", [])),
                )
            )

    bank = Bank(
        version=str(data.get("instrument", {}).get("version", "desconocida")),
        generated_by=str(data.get("generatedBy", "")),
        patterns=patterns,
        hypotheses=hypotheses,
        microtests=microtests,
        pairs=tuple(pairs),
        limitations=tuple(str(value) for value in data.get("limitations", [])),
    )
    validate_bank(bank)
    return bank


def validate_bank(bank: Bank) -> list[str]:
    """Comprueba coherencia mínima. Devuelve advertencias no bloqueantes."""
    problems: list[str] = []
    warnings: list[str] = []

    if tuple(bank.patterns) != EXPECTED_PATTERNS:
        problems.append(
            f"Se esperaban los patrones {EXPECTED_PATTERNS} y se encontraron {tuple(bank.patterns)}."
        )
    if len(bank.hypotheses) != 11:
        problems.append(f"Se esperaban 11 hipótesis y hay {len(bank.hypotheses)}.")
    if len(bank.microtests) != 26:
        problems.append(f"Se esperaban 26 micropruebas y hay {len(bank.microtests)}.")
    if bank.version != "0.8.0":
        warnings.append(f"El banco declara la versión {bank.version}, no 0.8.0.")

    for hypothesis in bank.hypotheses.values():
        if hypothesis.pattern_id not in bank.patterns:
            problems.append(f"{hypothesis.id} apunta a un patrón inexistente.")

    for microtest in bank.microtests.values():
        if microtest.pattern_id not in bank.patterns:
            problems.append(f"{microtest.id} apunta a un patrón inexistente.")
        if not microtest.expected_outcome:
            problems.append(f"{microtest.id} no tiene resultado esperado.")
        if not microtest.target_hypotheses:
            problems.append(f"{microtest.id} no declara hipótesis objetivo.")
        for hypothesis_id in microtest.target_hypotheses:
            hypothesis = bank.hypotheses.get(hypothesis_id)
            if hypothesis is None:
                problems.append(f"{microtest.id} apunta a {hypothesis_id}, que no existe.")
            elif hypothesis.pattern_id != microtest.pattern_id:
                problems.append(
                    f"{microtest.id} ({microtest.pattern_id}) apunta a {hypothesis_id} "
                    f"del patrón {hypothesis.pattern_id}."
                )
        known = set(microtest.target_hypotheses)
        for hypothesis_id in microtest.signatures:
            if hypothesis_id not in known:
                warnings.append(
                    f"{microtest.id} tiene firma para {hypothesis_id}, que no es objetivo."
                )

    for pair in bank.pairs:
        for hypothesis_id in (pair.hypothesis_a_id, pair.hypothesis_b_id):
            if hypothesis_id not in bank.hypotheses:
                problems.append(f"Pareja con hipótesis inexistente: {hypothesis_id}")
        for microtest_id in pair.microtest_ids:
            microtest = bank.microtests.get(microtest_id)
            if microtest is None:
                problems.append(f"Pareja {pair.hypothesis_a_id}/{pair.hypothesis_b_id} usa {microtest_id} inexistente.")
            elif microtest.pattern_id != pair.pattern_id:
                problems.append(
                    f"Pareja {pair.hypothesis_a_id}/{pair.hypothesis_b_id} usa {microtest_id} de otro patrón."
                )

    if problems:
        raise BankIntegrityError("Banco inválido:\n- " + "\n- ".join(problems))
    return warnings


def bank_summary(bank: Bank) -> dict[str, Any]:
    return {
        "version": bank.version,
        "generatedBy": bank.generated_by,
        "patterns": len(bank.patterns),
        "hypotheses": len(bank.hypotheses),
        "microtests": len(bank.microtests),
        "pairs": len(bank.pairs),
    }


def chain_of(*values: Any) -> list[Any]:
    """Utilidad pequeña para aplanar listas en informes."""
    result: list[Any] = []
    for value in values:
        result.extend(value)
    return result
