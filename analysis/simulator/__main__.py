"""Punto de entrada del simulador.

Uso:
    python -m analysis.simulator
    python -m analysis.simulator --sessions 20 --seed 2026 --output analysis/simulator/outputs
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .ablation import ablation_experiment
from .bank import bank_summary, load_bank
from .experiments import experiment_suite
from .bayesian import DIAGNOSIS_THRESHOLD
from .reporting import write_ablation, write_all

DEFAULT_OUTPUT = Path(__file__).with_name("outputs")


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulador de estudiantes sintéticos de TRAZA")
    parser.add_argument("--sessions", type=int, default=20, help="Sesiones por perfil (por defecto 20).")
    parser.add_argument("--seed", type=int, default=2026, help="Semilla base (por defecto 2026).")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Directorio de salida.")
    parser.add_argument("--quiet", action="store_true", help="No imprime el resumen por consola.")
    parser.add_argument(
        "--ablation",
        action="store_true",
        help="Compara los bancos de 24/26 ítems, ganancia de información y decisión bayesiana.",
    )
    parser.add_argument(
        "--bayesian-threshold",
        type=float,
        default=DIAGNOSIS_THRESHOLD,
        help=f"Umbral experimental bayesiano (por defecto {DIAGNOSIS_THRESHOLD:.2f}).",
    )
    args = parser.parse_args()

    if args.sessions < 1:
        parser.error("--sessions debe ser al menos 1")

    bank = load_bank()
    if args.ablation:
        results = ablation_experiment(
            bank,
            sessions_per_profile=args.sessions,
            seed=args.seed,
            threshold=args.bayesian_threshold,
        )
        outputs = write_ablation(results, args.output, threshold=args.bayesian_threshold)
        if not args.quiet:
            for result in results:
                overall = result.metrics["overall"]
                print(
                    f"  {result.name}: {overall['sessions']} sesiones, "
                    f"resolución {overall['resolution_rate']:.2%}, "
                    f"exactitud* {overall['identification_accuracy']:.2%}, "
                    f"abstención {overall['abstention_rate']:.2%}, "
                    f"falsos positivos* {overall['false_positive_rate']:.2%}, "
                    f"micropruebas {overall['microtests_mean']:.2f}"
                )
            print("Salidas:", ", ".join(str(path) for path in outputs.values()))
        return 0

    results = experiment_suite(bank, sessions=args.sessions, seed=args.seed)
    outputs = write_all(results, args.output)

    if not args.quiet:
        print("Banco:", json.dumps(bank_summary(bank), ensure_ascii=False))
        for result in results:
            overall = result.metrics["overall"]
            print(
                f"  {result.name}: {overall['sessions']} sesiones, "
                f"resolución {overall['resolution_rate']:.2%}, "
                f"exactitud* {overall['identification_accuracy']:.2%}, "
                f"micropruebas medias {overall['microtests_mean']:.2f}"
            )
        print("Salidas:")
        for key, value in outputs.items():
            if key == "charts":
                print(f"  gráficos: {len(value)} archivo(s) en {args.output / 'charts'}")
            else:
                print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
