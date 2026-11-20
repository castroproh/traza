"""Motor de simulación: sesiones completas con selectores y reglas de TRAZA."""

from __future__ import annotations

import random

from .evidence import evaluate_microtest, evaluate_pattern, is_uncertain_response
from .models import (
    AnswerRecord,
    Bank,
    ExperimentConfig,
    ExperimentResult,
    Profile,
    SessionResult,
)
from .profiles import profiles_for
from .responses import generate_response
from .selection import SELECTORS


def _target_for(profile: Profile) -> str | None:
    # ``known_only`` is deliberately non-generalizing; it does not have a
    # session-wide generating hypothesis and must not enter identification scores.
    return profile.hypothesis_id if profile.kind == "hypothesis" else None


def _session_seed(base_seed: int, pattern_index: int, profile_index: int, session_index: int) -> int:
    """Semilla estable: no depende de la aleatoriedad previa de otras sesiones."""
    return base_seed + pattern_index * 1_000_000 + profile_index * 10_000 + session_index


def run_session(
    bank: Bank,
    *,
    pattern_id: str,
    profile: Profile,
    seed: int,
    selection_mode: str = "adaptive",
    max_per_session: int = 8,
    session_id: int = 0,
) -> SessionResult:
    if selection_mode not in SELECTORS:
        raise ValueError(f"Selector desconocido: {selection_mode}")
    selector = SELECTORS[selection_mode]
    rng = random.Random(seed)
    answers: list[tuple[str, str]] = []
    records: list[AnswerRecord] = []
    end_action = "insufficient"

    while True:
        selection = selector(bank, pattern_id, answers, max_per_session=max_per_session)
        end_action = selection.action
        if selection.action != "selected" or selection.microtest_id is None:
            break
        microtest = bank.microtests[selection.microtest_id]
        response = generate_response(bank, microtest, profile, rng)
        evaluations = evaluate_microtest(bank, microtest, response)
        answers.append((microtest.id, response))
        records.append(AnswerRecord(microtest_id=microtest.id, response=response, evaluations=evaluations))

    statuses, unresolved, resolved, _ = evaluate_pattern(bank, pattern_id, answers)
    supported = [hypothesis_id for hypothesis_id, status in statuses.items() if status == "supported"]
    normative_diagnosis = False
    if len(supported) == 1:
        diagnosis = supported[0]
        hypothesis = bank.hypotheses.get(diagnosis)
        normative_diagnosis = bool(hypothesis and hypothesis.normative)
        identification = "normative" if normative_diagnosis else "identified"
    elif len(supported) > 1:
        diagnosis = "multiple"
        identification = "multiple"
    else:
        diagnosis = None
        identification = "no_misconception" if resolved else "insufficient"

    ambiguous_answers = sum(
        1
        for record in records
        if any(record.response.strip() == case.strip() for case in bank.microtests[record.microtest_id].ambiguity_cases)
        or is_uncertain_response(record.response)
    )

    target = _target_for(profile)
    return SessionResult(
        session_id=session_id,
        seed=seed,
        pattern_id=pattern_id,
        profile=profile.name,
        profile_kind=profile.kind,
        target_hypothesis=target,
        noise=profile.noise,
        selection_mode=selection_mode,
        answers=records,
        statuses=statuses,
        unresolved=unresolved,
        resolved=resolved,
        end_action=end_action,
        diagnosis=diagnosis,
        identification=identification,
        true_hypothesis_contradicted=bool(target and statuses.get(target) == "contradicted"),
        ambiguous_answers=ambiguous_answers,
        normative_diagnosis=normative_diagnosis,
    )


def run_experiment(bank: Bank, config: ExperimentConfig) -> ExperimentResult:
    sessions: list[SessionResult] = []
    session_id = 0
    for pattern_index, pattern_id in enumerate(config.patterns):
        if pattern_id not in bank.patterns:
            raise ValueError(f"Patrón desconocido en la configuración: {pattern_id}")
        for noise in config.noise_levels:
            profiles = profiles_for(bank, pattern_id, noise=noise)
            for profile_index, profile in enumerate(profiles):
                # El ruido del perfil se fija con el nivel del experimento, salvo
                # que el perfil ya declare uno propio (error ocasional).
                if profile.kind != "hypothesis" or profile.noise == 0:
                    profile = Profile(
                        name=profile.name,
                        kind=profile.kind,
                        description=profile.description,
                        hypothesis_id=profile.hypothesis_id,
                        weights=profile.weights,
                        ambiguity_rate=profile.ambiguity_rate,
                        inconsistency_rate=profile.inconsistency_rate,
                        noise=noise,
                    )
                for mode_index, mode in enumerate(config.selection_modes):
                    for session_index in range(config.sessions_per_profile):
                        # La misma semilla se usa para todos los selectores de un
                        # mismo (patrón, perfil, sesión): las sesiones sintéticas
                        # son comparables entre métodos sin que el selector
                        # experimental conozca la hipótesis generadora.
                        seed = _session_seed(
                            config.seed,
                            pattern_index,
                            profile_index,
                            session_index,
                        )
                        sessions.append(
                            run_session(
                                bank,
                                pattern_id=pattern_id,
                                profile=profile,
                                seed=seed,
                                selection_mode=mode,
                                max_per_session=config.max_per_session,
                                session_id=session_id,
                            )
                        )
                        session_id += 1

    from .metrics import compute_metrics

    return ExperimentResult(
        name=config.name,
        config=config,
        sessions=sessions,
        metrics=compute_metrics(bank, sessions),
        notes=[
            "Las sesiones usan perfiles artificiales definidos por reglas.",
            "La hipótesis generadora se usa para medir, nunca para seleccionar micropruebas.",
        ],
    )
