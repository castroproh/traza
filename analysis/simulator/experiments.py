"""Experimentos reproducibles del simulador.

Cada experimento fija semilla, patrones, perfiles y selectores. No se ajustan
parámetros después de ver los resultados: las configuraciones son declarativas
y quedan registradas en la salida.
"""

from __future__ import annotations

from .models import Bank, ExperimentConfig, ExperimentResult
from .simulation import run_experiment

PATTERNS = ("RANGE", "ACUMULADORES", "CONDICIONALES", "FUNCIONES")


def canonical_experiment(bank: Bank, sessions: int = 20, seed: int = 2026) -> ExperimentResult:
    return run_experiment(
        bank,
        ExperimentConfig(
            name="canonico",
            seed=seed,
            sessions_per_profile=sessions,
            patterns=PATTERNS,
            noise_levels=(0.0,),
            selection_modes=("adaptive",),
        ),
    )


def noise_experiment(bank: Bank, sessions: int = 20, seed: int = 2027) -> ExperimentResult:
    return run_experiment(
        bank,
        ExperimentConfig(
            name="ruido",
            seed=seed,
            sessions_per_profile=sessions,
            patterns=PATTERNS,
            noise_levels=(0.0, 0.1, 0.2, 0.4),
            selection_modes=("adaptive",),
        ),
    )


def selector_experiment(bank: Bank, sessions: int = 20, seed: int = 2028) -> ExperimentResult:
    return run_experiment(
        bank,
        ExperimentConfig(
            name="selectores",
            seed=seed,
            sessions_per_profile=sessions,
            patterns=PATTERNS,
            noise_levels=(0.0, 0.2),
            selection_modes=("adaptive", "fixed", "information_gain"),
        ),
    )


def experiment_suite(
    bank: Bank,
    sessions: int = 20,
    seed: int = 2026,
) -> list[ExperimentResult]:
    """Suite estándar: canon, ruido y comparación de selectores."""
    configs = [
        ExperimentConfig(
            name="canonico",
            seed=seed,
            sessions_per_profile=sessions,
            patterns=PATTERNS,
            noise_levels=(0.0,),
            selection_modes=("adaptive",),
        ),
        ExperimentConfig(
            name="ruido",
            seed=seed + 1,
            sessions_per_profile=sessions,
            patterns=PATTERNS,
            noise_levels=(0.0, 0.1, 0.2, 0.4),
            selection_modes=("adaptive",),
        ),
        ExperimentConfig(
            name="selectores",
            seed=seed + 2,
            sessions_per_profile=sessions,
            patterns=PATTERNS,
            noise_levels=(0.0, 0.2),
            selection_modes=("adaptive", "fixed", "information_gain"),
        ),
    ]
    return [run_experiment(bank, config) for config in configs]
