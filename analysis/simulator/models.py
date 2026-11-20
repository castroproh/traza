"""Modelos de datos del simulador de estudiantes sintéticos.

El banco se carga desde ``bank.json``, exportado del código TypeScript real con
``npm run export:bank``. El simulador no redefine las firmas de respuesta: las
lee del banco para no divergir del instrumento de producción.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping


@dataclass(frozen=True)
class Hypothesis:
    id: str
    pattern_id: str
    title: str
    description: str
    normative: bool = False


@dataclass(frozen=True)
class Microtest:
    id: str
    pattern_id: str
    target_hypotheses: tuple[str, ...]
    signatures: Mapping[str, tuple[str, ...]]
    expected_outcome: str
    ambiguity_cases: tuple[str, ...]
    difficulty: str
    objective: str

    def options(self) -> list[str]:
        """Opciones visibles, en el mismo orden que la interfaz web."""
        ordered: list[str] = []
        for hypothesis_id in self.target_hypotheses:
            for response in self.signatures.get(hypothesis_id, ()):
                if response not in ordered:
                    ordered.append(response)
        for ambiguous in self.ambiguity_cases:
            if ambiguous not in ordered:
                ordered.append(ambiguous)
        for response in (self.expected_outcome, "No estoy seguro"):
            if response not in ordered:
                ordered.append(response)
        return ordered

    def wrong_options(self) -> list[str]:
        """Opciones que no son la respuesta correcta ni una abstención explícita."""
        ambiguous = set(self.ambiguity_cases)
        return [
            option
            for option in self.options()
            if option != self.expected_outcome and option not in ambiguous
        ]


@dataclass(frozen=True)
class DiscriminationPair:
    pattern_id: str
    hypothesis_a_id: str
    hypothesis_b_id: str
    microtest_ids: tuple[str, ...]


@dataclass
class Bank:
    version: str
    generated_by: str
    patterns: dict[str, dict[str, str]]
    hypotheses: dict[str, Hypothesis]
    microtests: dict[str, Microtest]
    pairs: tuple[DiscriminationPair, ...]
    limitations: tuple[str, ...] = ()

    def hypotheses_for(self, pattern_id: str) -> list[Hypothesis]:
        return [h for h in self.hypotheses.values() if h.pattern_id == pattern_id]

    def microtests_for(self, pattern_id: str) -> list[Microtest]:
        return [m for m in self.microtests.values() if m.pattern_id == pattern_id]

    def pairs_for(self, pattern_id: str) -> list[DiscriminationPair]:
        return [p for p in self.pairs if p.pattern_id == pattern_id]

    def pattern_ids(self) -> list[str]:
        return list(self.patterns)


@dataclass(frozen=True)
class Profile:
    """Perfil sintético de respuesta.

    ``kind`` determina cómo se elige una respuesta base:

    - ``hypothesis``: sigue la firma de ``hypothesis_id``.
    - ``correct``: elige siempre la salida correcta.
    - ``mixed``: muestrea una hipótesis del patrón para cada microprueba.
    - ``ambiguous``: responde con incertidumbre según ``ambiguity_rate``.
    - ``inconsistent``: alterna hipótesis rivales sin mantener una concepción.
    - ``random``: elige una opción al azar entre las visibles.
    - ``known_only``: acierta las micropruebas de dificultad inicial y falla
      las intermedias según su hipótesis.
    """

    name: str
    kind: str
    description: str
    hypothesis_id: str | None = None
    weights: Mapping[str, float] | None = None
    ambiguity_rate: float = 0.0
    inconsistency_rate: float = 0.0
    noise: float = 0.0


@dataclass
class Evaluation:
    hypothesis_id: str
    microtest_id: str
    state: str
    observed_response: str
    predicted_responses: tuple[str, ...]
    reason: str


@dataclass
class AnswerRecord:
    microtest_id: str
    response: str
    evaluations: list[Evaluation] = field(default_factory=list)


@dataclass
class Selection:
    action: str
    reason: str
    microtest_id: str | None = None


@dataclass
class SessionResult:
    session_id: int
    seed: int
    pattern_id: str
    profile: str
    profile_kind: str
    target_hypothesis: str | None
    noise: float
    selection_mode: str
    answers: list[AnswerRecord]
    statuses: dict[str, str]
    unresolved: list[str]
    resolved: bool
    end_action: str
    diagnosis: str | None
    identification: str
    true_hypothesis_contradicted: bool
    ambiguous_answers: int = 0
    normative_diagnosis: bool = False

    @property
    def microtests_used(self) -> int:
        return len(self.answers)

    @property
    def abstained(self) -> bool:
        return not self.resolved and self.diagnosis is None


@dataclass
class ExperimentConfig:
    name: str
    seed: int = 2026
    sessions_per_profile: int = 20
    patterns: tuple[str, ...] = ("RANGE", "ACUMULADORES", "CONDICIONALES", "FUNCIONES")
    noise_levels: tuple[float, ...] = (0.0,)
    selection_modes: tuple[str, ...] = ("adaptive",)
    max_per_session: int = 8


@dataclass
class ExperimentResult:
    name: str
    config: ExperimentConfig
    sessions: list[SessionResult]
    metrics: dict
    notes: list[str] = field(default_factory=list)
