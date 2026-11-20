"""Simulador de estudiantes sintéticos para el instrumento diagnóstico de TRAZA.

Este paquete vive fuera del bundle Vue y no se importa desde la aplicación.
"""

from .bank import BankIntegrityError, load_bank, validate_bank
from .experiments import experiment_suite
from .metrics import compute_metrics
from .models import Bank, ExperimentConfig, ExperimentResult, Profile, SessionResult
from .profiles import profiles_for
from .reporting import write_all
from .simulation import run_experiment, run_session

__all__ = [
    "Bank",
    "BankIntegrityError",
    "ExperimentConfig",
    "ExperimentResult",
    "Profile",
    "SessionResult",
    "compute_metrics",
    "experiment_suite",
    "load_bank",
    "profiles_for",
    "run_experiment",
    "run_session",
    "validate_bank",
    "write_all",
]
