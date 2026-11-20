"""Pruebas del prototipo bayesiano; no se usa en producción."""

from __future__ import annotations

import math
import unittest
from dataclasses import replace

from analysis.simulator.bayesian import bayesian_diagnosis, run_bayesian_session
from analysis.simulator.bank import load_bank
from analysis.simulator.profiles import profiles_for


class BayesianTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = load_bank()

    def test_default_prior_is_uniform_and_posterior_normalizes(self) -> None:
        result = bayesian_diagnosis(self.bank, "ACUMULADORES", [])
        self.assertAlmostEqual(sum(result.plausibilities.values()), 1.0)
        self.assertEqual(set(result.plausibilities.values()), {1 / 3})

        updated = bayesian_diagnosis(
            self.bank,
            "ACUMULADORES",
            [("acc-final-01", "3")],
        )
        self.assertAlmostEqual(sum(updated.plausibilities.values()), 1.0)
        self.assertTrue(all(0 <= value <= 1 for value in updated.plausibilities.values()))

    def test_ambiguous_signature_is_non_informative(self) -> None:
        microtest = self.bank.microtests["range-iteracion-01"]
        signature = microtest.signatures["H-RANGE-01"][0]
        ambiguous_microtest = replace(microtest, ambiguity_cases=(signature,))
        microtests = dict(self.bank.microtests)
        microtests[microtest.id] = ambiguous_microtest
        bank = replace(self.bank, microtests=microtests)

        result = bayesian_diagnosis(
            bank,
            "RANGE",
            [(microtest.id, signature)],
        )
        self.assertEqual(result.plausibilities, {"H-RANGE-01": 0.5, "H-RANGE-02": 0.5})
        self.assertEqual({update.likelihood for update in result.updates}, {1 / len(ambiguous_microtest.options())})

    def test_uncertain_response_does_not_change_prior(self) -> None:
        result = bayesian_diagnosis(
            self.bank,
            "RANGE",
            [("range-iteracion-01", "No estoy seguro")],
        )
        self.assertEqual(result.plausibilities, {"H-RANGE-01": 0.5, "H-RANGE-02": 0.5})

    def test_untargeted_hypothesis_is_not_penalized_for_correct_answer(self) -> None:
        result = bayesian_diagnosis(
            self.bank,
            "ACUMULADORES",
            [("acc-final-01", "6")],
        )
        likelihood_by_hypothesis = {
            update.hypothesis_id: update.likelihood for update in result.updates
        }
        self.assertEqual(likelihood_by_hypothesis["H-ACC-01"], 0.5)
        self.assertEqual(likelihood_by_hypothesis["H-ACC-03"], 0.5)
        self.assertEqual(likelihood_by_hypothesis["H-ACC-02"], 0.05)

    def test_prior_and_threshold_are_configurable(self) -> None:
        prior = {"H-ACC-01": 0.01, "H-ACC-02": 0.98, "H-ACC-03": 0.01}
        selected = bayesian_diagnosis(self.bank, "ACUMULADORES", [], prior=prior, threshold=0.9)
        self.assertEqual(selected.diagnosis, "H-ACC-02")
        self.assertEqual(selected.threshold, 0.9)

        undecided = bayesian_diagnosis(self.bank, "ACUMULADORES", [], prior=prior, threshold=0.99)
        self.assertIsNone(undecided.diagnosis)

    def test_invalid_prior_and_threshold_are_rejected(self) -> None:
        for threshold in (0, -0.1, 1.1, math.nan, math.inf):
            with self.subTest(threshold=threshold), self.assertRaises(ValueError):
                bayesian_diagnosis(self.bank, "RANGE", [], threshold=threshold)
        for prior in (
            {"H-RANGE-01": -1},
            {"H-RANGE-01": 0, "H-RANGE-02": 0},
            {"H-RANGE-01": math.inf},
            {"H-RANGE-01": math.nan},
        ):
            with self.subTest(prior=prior), self.assertRaises(ValueError):
                bayesian_diagnosis(self.bank, "RANGE", [], prior=prior)

    def test_same_seed_reproduces_responses_and_posterior(self) -> None:
        profile = next(
            item
            for item in profiles_for(self.bank, "RANGE")
            if item.kind == "hypothesis"
        )
        first_session, first_diagnosis = run_bayesian_session(
            self.bank,
            pattern_id="RANGE",
            profile=profile,
            seed=1234,
        )
        second_session, second_diagnosis = run_bayesian_session(
            self.bank,
            pattern_id="RANGE",
            profile=profile,
            seed=1234,
        )
        self.assertEqual(
            [(item.microtest_id, item.response) for item in first_session.answers],
            [(item.microtest_id, item.response) for item in second_session.answers],
        )
        self.assertEqual(first_diagnosis.plausibilities, second_diagnosis.plausibilities)
        self.assertEqual(first_diagnosis.diagnosis, second_diagnosis.diagnosis)


if __name__ == "__main__":
    unittest.main()
