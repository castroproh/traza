"""Pruebas del simulador con ``unittest`` (sin dependencias externas).

Ejecutar desde la raíz del repositorio:
    python3 -m unittest discover -s analysis/simulator/tests -v
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from analysis.simulator.ablation import ablation_experiment
from analysis.simulator.bank import BankIntegrityError, bank_summary, load_bank, validate_bank
from analysis.simulator.evidence import evaluate_pattern, interpret_response, same_response
from analysis.simulator.experiments import PATTERNS, experiment_suite
from analysis.simulator.metrics import compute_metrics, confusion_matrix
from analysis.simulator.models import ExperimentConfig, Profile
from analysis.simulator.profiles import profiles_for
from analysis.simulator.reporting import write_ablation, write_all
from analysis.simulator.responses import generate_response
from analysis.simulator.selection import select_adaptive, select_fixed, select_information_gain
from analysis.simulator.simulation import run_experiment, run_session

import random


class BankTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = load_bank()

    def test_expected_counts(self) -> None:
        summary = bank_summary(self.bank)
        self.assertEqual(summary["patterns"], 4)
        self.assertEqual(summary["hypotheses"], 11)
        self.assertEqual(summary["microtests"], 26)
        self.assertEqual(summary["pairs"], 10)
        self.assertEqual(summary["version"], "0.8.0")

    def test_microtests_por_patron(self) -> None:
        self.assertEqual(len(self.bank.microtests_for("RANGE")), 7)
        self.assertEqual(len(self.bank.microtests_for("ACUMULADORES")), 7)
        self.assertEqual(len(self.bank.microtests_for("CONDICIONALES")), 6)
        self.assertEqual(len(self.bank.microtests_for("FUNCIONES")), 6)

    def test_patterns(self) -> None:
        self.assertEqual(tuple(self.bank.pattern_ids()), PATTERNS)

    def test_every_microtest_has_expected_outcome_and_targets(self) -> None:
        for microtest in self.bank.microtests.values():
            self.assertTrue(microtest.expected_outcome)
            self.assertTrue(microtest.target_hypotheses)
            self.assertIn(microtest.pattern_id, self.bank.patterns)
            for hypothesis_id in microtest.target_hypotheses:
                self.assertIn(hypothesis_id, self.bank.hypotheses)

    def test_validate_returns_no_errors(self) -> None:
        validate_bank(self.bank)

    def test_invalid_bank_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bank.json"
            path.write_text(json.dumps({"patterns": [], "hypotheses": [], "microtests": []}), encoding="utf-8")
            with self.assertRaises(BankIntegrityError):
                load_bank(path)


class EvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = load_bank()

    def test_expected_outcome_contradicts_wrong_hypothesis(self) -> None:
        microtest = self.bank.microtests["range-iteracion-01"]
        evaluation = interpret_response(self.bank, microtest, "H-RANGE-01", microtest.expected_outcome)
        self.assertEqual(evaluation.state, "contradicts")

    def test_signature_supports_non_normative_hypothesis(self) -> None:
        microtest = self.bank.microtests["range-iteracion-01"]
        signature = microtest.signatures["H-RANGE-01"][0]
        evaluation = interpret_response(self.bank, microtest, "H-RANGE-01", signature)
        self.assertEqual(evaluation.state, "supports")

    def test_uncertain_response_is_insufficient(self) -> None:
        microtest = self.bank.microtests["range-iteracion-01"]
        evaluation = interpret_response(self.bank, microtest, "H-RANGE-01", "No estoy seguro")
        self.assertEqual(evaluation.state, "insufficient")

    def test_ambiguity_cases_are_insufficient(self) -> None:
        for microtest in self.bank.microtests.values():
            for case in microtest.ambiguity_cases:
                evaluation = interpret_response(self.bank, microtest, microtest.target_hypotheses[0], case)
                self.assertEqual(evaluation.state, "insufficient", microtest.id)

    def test_normalization_ignores_whitespace(self) -> None:
        self.assertTrue(same_response(" 1,   2,3 ", "1,2, 3"))

    def test_normative_hypothesis_correct_answer_is_support(self) -> None:
        microtest = self.bank.microtests["range-iteracion-01"]
        normative = next(h.id for h in self.bank.hypotheses.values() if h.normative and h.pattern_id == "RANGE")
        evaluation = interpret_response(self.bank, microtest, normative, microtest.expected_outcome)
        self.assertEqual(evaluation.state, "supports")


class SelectorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = load_bank()

    def test_adaptive_is_deterministic(self) -> None:
        first = select_adaptive(self.bank, "RANGE", [])
        second = select_adaptive(self.bank, "RANGE", [])
        self.assertEqual(first.microtest_id, second.microtest_id)
        self.assertEqual(first.action, "selected")

    def test_adaptive_does_not_repeat_answered(self) -> None:
        first = select_adaptive(self.bank, "FUNCIONES", [])
        self.assertIsNotNone(first.microtest_id)
        second = select_adaptive(self.bank, "FUNCIONES", [(first.microtest_id, "No estoy seguro")])
        self.assertNotEqual(first.microtest_id, second.microtest_id)

    def test_limit_is_enforced(self) -> None:
        answers = [(m.id, "No estoy seguro") for m in self.bank.microtests_for("RANGE")]
        selection = select_adaptive(self.bank, "RANGE", answers, max_per_session=len(answers))
        self.assertEqual(selection.action, "limit")

    def test_fixed_selector_follows_bank_order(self) -> None:
        selection = select_fixed(self.bank, "RANGE", [])
        self.assertEqual(selection.microtest_id, "range-iteracion-01")

    def test_information_gain_is_deterministic_and_selects(self) -> None:
        first = select_information_gain(self.bank, "CONDICIONALES", [])
        second = select_information_gain(self.bank, "CONDICIONALES", [])
        self.assertEqual(first.microtest_id, second.microtest_id)
        self.assertEqual(first.action, "selected")

    def test_information_gain_reaches_sufficient_or_insufficient(self) -> None:
        answers: list[tuple[str, str]] = []
        for _ in range(8):
            selection = select_information_gain(self.bank, "RANGE", answers)
            if selection.action != "selected" or selection.microtest_id is None:
                break
            microtest = self.bank.microtests[selection.microtest_id]
            answers.append((microtest.id, microtest.expected_outcome))
        self.assertIn(select_information_gain(self.bank, "RANGE", answers).action, ("sufficient", "insufficient", "limit"))


class ResponseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = load_bank()

    def test_correct_profile_returns_expected_outcome(self) -> None:
        rng = random.Random(1)
        profile = Profile(name="correcto", kind="correct", description="")
        for microtest in self.bank.microtests.values():
            self.assertEqual(generate_response(self.bank, microtest, profile, rng), microtest.expected_outcome)

    def test_hypothesis_profile_uses_signature_when_available(self) -> None:
        microtest = self.bank.microtests["func-local-print-01"]
        profile = Profile(name="h", kind="hypothesis", hypothesis_id="H-FUNC-01", description="")
        response = generate_response(self.bank, microtest, profile, random.Random(7))
        self.assertIn(response, microtest.signatures["H-FUNC-01"])

    def test_ambiguous_profile_can_abstain(self) -> None:
        rng = random.Random(2)
        profile = Profile(
            name="ambiguo",
            kind="ambiguous",
            description="",
            ambiguity_rate=1.0,
        )
        for microtest in self.bank.microtests.values():
            response = generate_response(self.bank, microtest, profile, rng)
            self.assertTrue(
                response in microtest.ambiguity_cases or response == "No estoy seguro"
            )

    def test_profiles_include_required_kinds(self) -> None:
        kinds = {profile.kind for profile in profiles_for(self.bank, "FUNCIONES")}
        self.assertTrue(
            {"correct", "hypothesis", "mixed", "ambiguous", "inconsistent", "random", "known_only"} <= kinds
        )


class SimulationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = load_bank()

    def test_session_is_reproducible(self) -> None:
        profile = Profile(name="h", kind="hypothesis", hypothesis_id="H-COND-01", description="")
        first = run_session(self.bank, pattern_id="CONDICIONALES", profile=profile, seed=99)
        second = run_session(self.bank, pattern_id="CONDICIONALES", profile=profile, seed=99)
        self.assertEqual(
            [(a.microtest_id, a.response) for a in first.answers],
            [(a.microtest_id, a.response) for a in second.answers],
        )
        self.assertEqual(first.diagnosis, second.diagnosis)

    def test_session_respects_limit(self) -> None:
        profile = Profile(name="random", kind="random", description="")
        session = run_session(self.bank, pattern_id="RANGE", profile=profile, seed=5, max_per_session=3)
        self.assertLessEqual(session.microtests_used, 3)

    def test_hypothesis_profile_often_identified(self) -> None:
        identified = 0
        for seed in range(10):
            profile = Profile(name="h", kind="hypothesis", hypothesis_id="H-COND-02", description="")
            session = run_session(self.bank, pattern_id="CONDICIONALES", profile=profile, seed=seed)
            identified += int(session.diagnosis == "H-COND-02")
        self.assertGreaterEqual(identified, 8)

    def test_confusion_matrix_shape(self) -> None:
        profile = Profile(name="h", kind="hypothesis", hypothesis_id="H-FUNC-01", description="")
        session = run_session(self.bank, pattern_id="FUNCIONES", profile=profile, seed=1)
        matrix = confusion_matrix([session])
        self.assertIn("H-FUNC-01", matrix)

    def test_normative_diagnosis_is_distinguished(self) -> None:
        profile = Profile(
            name="solo-conocidas",
            kind="known_only",
            hypothesis_id="H-RANGE-01",
            description="",
        )
        session = run_session(self.bank, pattern_id="RANGE", profile=profile, seed=1)
        self.assertEqual(session.diagnosis, "H-RANGE-02")
        self.assertTrue(session.normative_diagnosis)
        self.assertEqual(session.identification, "normative")
        self.assertIsNone(session.target_hypothesis)

    def test_metrics_are_serializable(self) -> None:
        config = ExperimentConfig(
            name="mini",
            seed=1,
            sessions_per_profile=1,
            patterns=("RANGE",),
            noise_levels=(0.0,),
            selection_modes=("adaptive",),
        )
        result = run_experiment(self.bank, config)
        self.assertIn("overall", result.metrics)
        json.dumps(result.metrics)

    def test_write_all_creates_files(self) -> None:
        config = ExperimentConfig(
            name="mini",
            seed=1,
            sessions_per_profile=1,
            patterns=("RANGE",),
            noise_levels=(0.0,),
            selection_modes=("adaptive",),
        )
        result = run_experiment(self.bank, config)
        with tempfile.TemporaryDirectory() as directory:
            outputs = write_all([result], Path(directory))
            self.assertTrue(Path(outputs["json"]).exists())
            self.assertTrue(Path(outputs["sessionsCsv"]).exists())
            self.assertTrue(Path(outputs["metricsCsv"]).exists())
            self.assertTrue(Path(outputs["markdown"]).exists())
            payload = json.loads(Path(outputs["json"]).read_text(encoding="utf-8"))
            self.assertEqual(payload["experiments"][0]["name"], "mini")


class SuiteTests(unittest.TestCase):
    def test_suite_runs_three_experiments(self) -> None:
        bank = load_bank()
        results = experiment_suite(bank, sessions=1, seed=3)
        self.assertEqual([result.name for result in results], ["canonico", "ruido", "selectores"])
        for result in results:
            self.assertGreater(len(result.sessions), 0)
            self.assertIn("overall", result.metrics)


class AblationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = load_bank()

    def test_four_arms_use_paired_profiles_seeds_and_responses(self) -> None:
        arms = ablation_experiment(
            self.bank,
            sessions_per_profile=1,
            seed=71,
            noise_levels=(0.0, 0.2),
        )
        self.assertEqual(
            [arm.name for arm in arms],
            [
                "A_24_adaptive",
                "B_26_adaptive",
                "C_26_information_gain",
                "D_26_bayesian_threshold",
                "E_25_range_only",
                "F_25_accumulator_only",
            ],
        )
        self.assertEqual(
            [arm.metrics["instrument"]["microtests"] for arm in arms],
            [24, 26, 26, 26, 25, 25],
        )

        def paired_keys(arm):
            return [
                (
                    session.pattern_id,
                    session.profile,
                    session.profile_kind,
                    session.target_hypothesis,
                    session.noise,
                    session.seed,
                )
                for session in arm.sessions
            ]

        for arm in arms[1:]:
            self.assertEqual(paired_keys(arms[0]), paired_keys(arm))
        self.assertEqual(
            [
                [(answer.microtest_id, answer.response) for answer in session.answers]
                for session in arms[1].sessions
            ],
            [
                [(answer.microtest_id, answer.response) for answer in session.answers]
                for session in arms[3].sessions
            ],
        )
        self.assertFalse(
            any(
                answer.microtest_id in ("range-un-argumento-01", "acc-inicial-cero-02")
                for session in arms[0].sessions
                for answer in session.answers
            )
        )
        self.assertTrue(
            all(
                answer.microtest_id != "acc-inicial-cero-02"
                for session in arms[4].sessions
                for answer in session.answers
            )
        )
        self.assertTrue(
            all(
                answer.microtest_id != "range-un-argumento-01"
                for session in arms[5].sessions
                for answer in session.answers
            )
        )

    def test_ablation_outputs_are_reproducible_artifacts(self) -> None:
        arms = ablation_experiment(
            self.bank,
            sessions_per_profile=1,
            seed=8,
            noise_levels=(0.0,),
        )
        with tempfile.TemporaryDirectory() as directory:
            outputs = write_ablation(arms, Path(directory), threshold=0.7)
            for path in outputs.values():
                self.assertTrue(path.exists())
            payload = json.loads(outputs["json"].read_text(encoding="utf-8"))
            self.assertEqual(payload["methodology"]["seed"], 8)
            self.assertEqual(payload["methodology"]["bayesianThreshold"], 0.7)
            self.assertEqual(len(payload["methodology"]["arms"]), 6)


if __name__ == "__main__":
    unittest.main()
