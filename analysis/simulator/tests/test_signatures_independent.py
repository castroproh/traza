"""Comprueba firmas con ejecuciones Python independientes del generador/evaluador."""

from __future__ import annotations

import contextlib
import io
import json
import unittest
from pathlib import Path


BANK_PATH = Path(__file__).parents[1] / "bank.json"


def _output_from_python(source: str) -> str:
    stream = io.StringIO()
    scope = {"__builtins__": {"print": print, "range": range}}
    with contextlib.redirect_stdout(stream):
        exec(compile(source, "<signature-reference>", "exec"), scope)
    return stream.getvalue().strip()


class IndependentSignatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        payload = json.loads(BANK_PATH.read_text(encoding="utf-8"))
        cls.microtests = {item["id"]: item for item in payload["microtests"]}

    def test_single_argument_range_signature(self) -> None:
        microtest = self.microtests["range-un-argumento-01"]
        self.assertEqual(
            ", ".join(_output_from_python(microtest["code"]).splitlines()),
            microtest["expectedOutcome"],
        )
        inclusive_reference = "\n".join(
            ("for numero in range(6):", "    print(numero)")
        )
        self.assertEqual(
            ", ".join(_output_from_python(inclusive_reference).splitlines()),
            microtest["responseSignatures"]["H-RANGE-01"][0],
        )

    def test_zero_initial_accumulator_signatures(self) -> None:
        microtest = self.microtests["acc-inicial-cero-02"]
        self.assertEqual(
            ", ".join(_output_from_python(microtest["code"]).splitlines()),
            microtest["expectedOutcome"],
        )
        substitution_reference = "\n".join(
            (
                "total = 0",
                "for numero in range(2, 5):",
                "    total = numero",
                "    print(total)",
            )
        )
        self.assertEqual(
            ", ".join(_output_from_python(substitution_reference).splitlines()),
            microtest["responseSignatures"]["H-ACC-02"][0],
        )
        self.assertEqual(
            microtest["expectedOutcome"],
            microtest["responseSignatures"]["H-ACC-03"][0],
        )

    def test_and_or_signature_with_a_single_true_clause(self) -> None:
        microtest = self.microtests["cond-and-01"]
        self.assertEqual(_output_from_python(microtest["code"]), microtest["expectedOutcome"])
        confused_reference = microtest["code"].replace(" and ", " or ")
        self.assertEqual(
            _output_from_python(confused_reference),
            microtest["responseSignatures"]["H-COND-01"][0],
        )

    def test_reversed_argument_signature(self) -> None:
        microtest = self.microtests["func-param-01"]
        self.assertEqual(_output_from_python(microtest["code"]), microtest["expectedOutcome"])
        reversed_reference = microtest["code"].replace("restar(10, 3)", "restar(3, 10)")
        self.assertEqual(
            _output_from_python(reversed_reference),
            microtest["responseSignatures"]["H-FUNC-02"][0],
        )


if __name__ == "__main__":
    unittest.main()
