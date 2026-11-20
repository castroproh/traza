"""Salidas del simulador: JSON, CSV, Markdown y gráficos opcionales."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from .ablation import NEW_MICROTEST_IDS
from .metrics import summarise_group
from .models import ExperimentResult, SessionResult

CSV_FIELDS = [
    "experiment",
    "session_id",
    "seed",
    "pattern_id",
    "profile",
    "profile_kind",
    "target_hypothesis",
    "noise",
    "selection_mode",
    "microtests_used",
    "resolved",
    "diagnosis",
    "identification",
    "ambiguous_answers",
    "true_hypothesis_contradicted",
    "end_action",
]


def _session_row(experiment: str, session: SessionResult) -> dict:
    return {
        "experiment": experiment,
        "session_id": session.session_id,
        "seed": session.seed,
        "pattern_id": session.pattern_id,
        "profile": session.profile,
        "profile_kind": session.profile_kind,
        "target_hypothesis": session.target_hypothesis or "",
        "noise": session.noise,
        "selection_mode": session.selection_mode,
        "microtests_used": session.microtests_used,
        "resolved": session.resolved,
        "diagnosis": session.diagnosis or "",
        "identification": session.identification,
        "ambiguous_answers": session.ambiguous_answers,
        "true_hypothesis_contradicted": session.true_hypothesis_contradicted,
        "end_action": session.end_action,
    }


def write_json(results: list[ExperimentResult], directory: Path) -> Path:
    payload = {
        "simulator": "TRAZA synthetic student simulator",
        "warning": (
            "Datos sintéticos. No representan estudiantes reales ni constituyen "
            "validación psicométrica o pedagógica."
        ),
        "experiments": [
            {
                "name": result.name,
                "config": {
                    "seed": result.config.seed,
                    "sessionsPerProfile": result.config.sessions_per_profile,
                    "patterns": list(result.config.patterns),
                    "noiseLevels": list(result.config.noise_levels),
                    "selectionModes": list(result.config.selection_modes),
                    "maxPerSession": result.config.max_per_session,
                },
                "metrics": result.metrics,
                "notes": result.notes,
                "sessionCount": len(result.sessions),
            }
            for result in results
        ],
    }
    path = directory / "results.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def write_sessions_csv(results: list[ExperimentResult], directory: Path) -> Path:
    path = directory / "sessions.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, lineterminator="\n")
        writer.writeheader()
        for result in results:
            for session in result.sessions:
                writer.writerow(_session_row(result.name, session))
    return path


def write_metrics_csv(results: list[ExperimentResult], directory: Path) -> Path:
    path = directory / "metrics.csv"
    rows: list[dict] = []
    for result in results:
        for pattern, values in result.metrics["byPatternSelection"].items():
            rows.append(
                {
                    "experiment": result.name,
                    "group": pattern,
                    "sessions": values["sessions"],
                    "resolution_rate": values["resolution_rate"],
                    "abstention_rate": values["abstention_rate"],
                    "identification_accuracy": values["identification_accuracy"],
                    "false_positive_rate": values["false_positive_rate"],
                    "microtests_mean": values["microtests_mean"],
                    "coverage_mean": values["coverage_mean"],
                }
            )
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=list(rows[0]) if rows else ["experiment"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)
    return path


def _markdown_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return lines


def _ci(interval: dict[str, float]) -> str:
    return f"[{interval['ci_low']:.2%} – {interval['ci_high']:.2%}] (n={interval['n']})"


def write_markdown(results: list[ExperimentResult], directory: Path) -> Path:
    lines: list[str] = [
        "# Resultados del simulador de estudiantes sintéticos",
        "",
        "> **Advertencia:** todas las sesiones provienen de perfiles artificiales definidos por reglas.",
        "> No son estudiantes reales, no estiman prevalencias y no sustituyen validación psicométrica",
        "> ni pedagógica.",
        "",
        "Generado por `python -m analysis.simulator` a partir de `analysis/simulator/bank.json`.",
        "",
    ]

    for result in results:
        overall = result.metrics["overall"]
        lines += [
            f"## Experimento: {result.name}",
            "",
            f"- Semilla base: `{result.config.seed}`",
            f"- Sesiones: **{overall['sessions']}**",
            f"- Sesiones por perfil: `{result.config.sessions_per_profile}`",
            f"- Niveles de ruido: `{list(result.config.noise_levels)}`",
            f"- Selectores: `{list(result.config.selection_modes)}`",
            "",
            "### Resumen global",
            "",
            *_markdown_table(
                ["Métrica", "Valor", "IC 95% (simulación)"],
                [
                    ["Tasa de resolución", f"{overall['resolution_rate']:.2%}", _ci(overall["resolution_rate_ci"])],
                    ["Abstención (evidencia insuficiente)", f"{overall['abstention_rate']:.2%}", _ci(overall["abstention_rate_ci"])],
                    ["Sin concepción alternativa", f"{overall['no_misconception_rate']:.2%}", "—"],
                    ["De los cuales comprensión correcta (normativo)", f"{overall['normative_rate']:.2%}", "—"],
                    ["Diagnóstico múltiple", f"{overall['multiple_rate']:.2%}", _ci(overall["multiple_rate_ci"])],
                    ["Exactitud de identificación*", f"{overall['identification_accuracy']:.2%}", _ci(overall["identification_accuracy_ci"])],
                    ["Falsos positivos*", f"{overall['false_positive_rate']:.2%}", _ci(overall["false_positive_rate_ci"])],
                    ["Micropruebas por sesión (media)", f"{overall['microtests_mean']:.2f}", "—"],
                    ["Micropruebas por sesión (mediana)", f"{overall['microtests_median']:.1f}", "—"],
                    ["Micropruebas máximas", str(overall["microtests_max"]), "—"],
                    ["Respuestas ambiguas por sesión", f"{overall['ambiguous_answers_mean']:.2f}", "—"],
                ],
            ),
            "",
            "*Calculado solo sobre perfiles con hipótesis generadora; una abstención no cuenta como falso positivo.*",
            "",
            "### Por patrón y selector",
            "",
            *_markdown_table(
                ["Patrón::selector", "Sesiones", "Resolución", "Exactitud*", "IC exactitud (sim.)", "Falsos positivos*", "Micropruebas"],
                [
                    [
                        group,
                        str(values["sessions"]),
                        f"{values['resolution_rate']:.2%}",
                        f"{values['identification_accuracy']:.2%}",
                        _ci(values["identification_accuracy_ci"]),
                        f"{values['false_positive_rate']:.2%}",
                        f"{values['microtests_mean']:.2f}",
                    ]
                    for group, values in result.metrics["byPatternSelection"].items()
                ],
            ),
            "",
            "### Matrices de confusión por patrón (hipótesis generadora → diagnóstico emitido)",
            "",
            "Solo incluyen sesiones con hipótesis generadora conocida. Cada celda cuenta sesiones sintéticas; "
            "no son prevalencias estudiantiles.",
            "",
        ]
        for pattern_id, matrix in sorted(result.metrics["confusionMatrixByPattern"].items()):
            lines += [
                f"#### {pattern_id}",
                "",
                _confusion_markdown(matrix),
                "",
            ]
        lines += [
            "",
            "*Calculado solo sobre perfiles con hipótesis generadora; una abstención no cuenta como falso positivo.*",
            "",
            "**Denominadores:** resolución, abstención, diagnóstico múltiple y uso de micropruebas se calculan sobre "
            "todas las sesiones del grupo. La exactitud de identificación y los falsos positivos se calculan solo sobre "
            "sesiones cuya regla de perfil define una hipótesis generadora (perfiles `hipotesis::H-*` y `error-ocasional::H-*`; "
            "los perfiles `correcto`, `mixto`, `ambiguo`, `inconsistente`, `aleatorio` y `solo-conocidas` no tienen una "
            "generadora única y quedan fuera de exactitud).",
            "",
            "**Corrección de denominador respecto del artefacto original:** la exactitud RANGE de 66.7% (40/60) "
            "incluía 20 perfiles `solo-conocidas`, que deliberadamente no generalizan y no tienen hipótesis estable. "
            "Al excluirlos, la exactitud entre perfiles con hipótesis estable es 100% (40/40). No se cambiaron "
            "preguntas, respuestas sintéticas ni parámetros; resolución RANGE sigue siendo una métrica distinta.",
            "",
            "Los intervalos de incertidumbre (IC) son intervalos de Wilson al 95 % sobre el muestreo de las sesiones "
            "sintéticas. Describe variabilidad de simulación, nunca inferencia sobre una población de estudiantes reales.",
            "",
            "### Por nivel de ruido",
            "",
            *_markdown_table(
                ["Ruido", "Sesiones", "Resolución", "Exactitud*", "Abstención", "Micropruebas"],
                [
                    [
                        f"{float(noise):.1f}",
                        str(values["sessions"]),
                        f"{values['resolution_rate']:.2%}",
                        f"{values['identification_accuracy']:.2%}",
                        f"{values['abstention_rate']:.2%}",
                        f"{values['microtests_mean']:.2f}",
                    ]
                    for noise, values in result.metrics["byNoise"].items()
                ],
            ),
            "",
            "### Por perfil sintético",
            "",
            *_markdown_table(
                ["Perfil", "Sesiones", "Resolución", "Exactitud*", "Abstención", "Micropruebas"],
                [
                    [
                        profile,
                        str(values["sessions"]),
                        f"{values['resolution_rate']:.2%}",
                        f"{values['identification_accuracy']:.2%}",
                        f"{values['abstention_rate']:.2%}",
                        f"{values['microtests_mean']:.2f}",
                    ]
                    for profile, values in result.metrics["byProfile"].items()
                ],
            ),
            "",
            "Los perfiles `aleatorio`, `ambiguo`, `inconsistente`, `mixto` y `solo-conocidas`",
            "no tienen una hipótesis generadora única; su exactitud no se interpreta como acierto.",
            "`solo-conocidas` está diseñado para no generalizar y queda fuera de exactitud/FP; sí cuenta para resolución, abstención y uso.",
            "",
            "### Resistencia al ruido (perfiles con hipótesis)",
            "",
            f"- Exactitud sin ruido: **{result.metrics['noiseResistance']['cleanAccuracy']:.2%}**",
            f"- Exactitud con ruido: **{result.metrics['noiseResistance']['noisyAccuracy']:.2%}**",
            f"- Caída de exactitud: **{result.metrics['noiseResistance']['accuracyDrop']:.2%}**",
            "",
            "### Matriz de confusión (hipótesis generadora → diagnóstico)",
            "",
            _confusion_markdown(result.metrics["confusionMatrix"]),
            "",
            "### Limitaciones de esta simulación",
            "",
            *[f"- {caveat}" for caveat in result.metrics["caveats"]],
            "",
            "---",
            "",
        ]

    path = directory / "RESULTS.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def _confusion_markdown(matrix: dict[str, dict[str, int]]) -> str:
    if not matrix:
        return "_Sin sesiones con hipótesis generadora._"
    labels = sorted({label for row in matrix.values() for label in row})
    rows = []
    for target, row in matrix.items():
        cells = [str(row.get(label, 0)) for label in labels]
        rows.append([target, *cells])
    return "\n".join(_markdown_table(["Generadora \\ Diagnóstico", *labels], rows))


def write_charts(results: list[ExperimentResult], directory: Path) -> list[Path]:
    """Gráficos opcionales. Si matplotlib no está instalado, no falla."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:  # noqa: BLE001 - dependencia opcional
        return []

    charts_dir = directory / "charts"
    charts_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    canonical = next((r for r in results if r.name == "canonico"), results[0])
    patterns = list(canonical.metrics["byPattern"])
    accuracy = [canonical.metrics["byPattern"][p]["identification_accuracy"] for p in patterns]
    usage = [canonical.metrics["byPattern"][p]["microtests_mean"] for p in patterns]

    figure, axis = plt.subplots(figsize=(8, 4))
    axis.bar(patterns, accuracy, color="#2b6cb0")
    axis.set_ylim(0, 1)
    axis.set_ylabel("Exactitud de identificación")
    axis.set_title("Experimento canónico: exactitud por patrón (sintético)")
    axis.tick_params(axis="x", rotation=15)
    figure.tight_layout()
    path = charts_dir / "exactitud_por_patron.png"
    figure.savefig(path, dpi=140)
    plt.close(figure)
    written.append(path)

    figure, axis = plt.subplots(figsize=(8, 4))
    axis.bar(patterns, usage, color="#6b46c1")
    axis.set_ylabel("Micropruebas por sesión (media)")
    axis.set_title("Experimento canónico: uso de micropruebas por patrón")
    axis.tick_params(axis="x", rotation=15)
    figure.tight_layout()
    path = charts_dir / "micropruebas_por_patron.png"
    figure.savefig(path, dpi=140)
    plt.close(figure)
    written.append(path)

    noise_result = next((r for r in results if r.name == "ruido"), None)
    if noise_result:
        levels = [float(noise) for noise in noise_result.metrics["byNoise"]]
        values = [noise_result.metrics["byNoise"][str(noise)]["identification_accuracy"] for noise in levels]
        figure, axis = plt.subplots(figsize=(7, 4))
        axis.plot(levels, values, marker="o", color="#c05621")
        axis.set_ylim(0, 1)
        axis.set_xlabel("Probabilidad de respuesta ruidosa")
        axis.set_ylabel("Exactitud de identificación")
        axis.set_title("Resistencia al ruido (perfiles sintéticos)")
        figure.tight_layout()
        path = charts_dir / "resistencia_ruido.png"
        figure.savefig(path, dpi=140)
        plt.close(figure)
        written.append(path)

    selector_result = next((r for r in results if r.name == "selectores"), None)
    if selector_result:
        modes = list(selector_result.metrics["bySelection"])
        values = [selector_result.metrics["bySelection"][mode]["microtests_mean"] for mode in modes]
        figure, axis = plt.subplots(figsize=(7, 4))
        axis.bar(modes, values, color="#2f855a")
        axis.set_ylabel("Micropruebas por sesión (media)")
        axis.set_title("Comparación de selectores: uso de micropruebas")
        figure.tight_layout()
        path = charts_dir / "selectores_micropruebas.png"
        figure.savefig(path, dpi=140)
        plt.close(figure)
        written.append(path)

    return written


def write_all(results: list[ExperimentResult], directory: Path) -> dict[str, object]:
    directory.mkdir(parents=True, exist_ok=True)
    return {
        "json": write_json(results, directory),
        "sessionsCsv": write_sessions_csv(results, directory),
        "metricsCsv": write_metrics_csv(results, directory),
        "markdown": write_markdown(results, directory),
        "charts": write_charts(results, directory),
    }


def write_ablation(
    results: list[ExperimentResult],
    directory: Path,
    *,
    threshold: float,
) -> dict[str, Path]:
    directory.mkdir(parents=True, exist_ok=True)
    if not results:
        raise ValueError("Se requiere al menos un brazo para generar el informe de ablación.")

    reference = results[0].config
    pattern_noise: dict[str, dict[str, dict[str, dict]]] = {}
    csv_rows: list[dict[str, object]] = []
    new_microtest_usage: dict[str, dict[str, dict[str, float | int]]] = {}
    for result in results:
        by_pattern_noise: dict[str, dict[str, dict]] = {}
        for pattern in reference.patterns:
            by_noise: dict[str, dict] = {}
            for noise in reference.noise_levels:
                group = [
                    session
                    for session in result.sessions
                    if session.pattern_id == pattern and session.noise == noise
                ]
                summary = summarise_group(group)
                by_noise[str(noise)] = summary
                csv_rows.append(
                    {
                        "method": result.name,
                        "pattern": pattern,
                        "noise": noise,
                        "sessions": summary["sessions"],
                        "resolution_rate": summary["resolution_rate"],
                        "identification_accuracy": summary["identification_accuracy"],
                        "abstention_rate": summary["abstention_rate"],
                        "false_positive_rate": summary["false_positive_rate"],
                        "microtests_mean": summary["microtests_mean"],
                    }
                )
            by_pattern_noise[pattern] = by_noise
        pattern_noise[result.name] = by_pattern_noise
        usage: dict[str, dict[str, float | int]] = {}
        for microtest_id in NEW_MICROTEST_IDS:
            sessions_using = sum(
                1
                for session in result.sessions
                if any(answer.microtest_id == microtest_id for answer in session.answers)
            )
            usage[microtest_id] = {
                "sessionsUsing": sessions_using,
                "sessions": len(result.sessions),
                "sessionRate": round(sessions_using / len(result.sessions), 4) if result.sessions else 0.0,
            }
        new_microtest_usage[result.name] = usage

    payload = {
        "warning": (
            "Experimento enteramente sintético. No mide aprendizaje, prevalencia ni "
            "desempeño de estudiantes reales."
        ),
        "methodology": {
            "seed": reference.seed,
            "sessionsPerProfile": reference.sessions_per_profile,
            "patterns": list(reference.patterns),
            "noiseLevels": list(reference.noise_levels),
            "maxPerSession": reference.max_per_session,
            "bayesianThreshold": threshold,
            "arms": {
                result.name: {
                    "instrument": result.metrics["instrument"],
                    "selectionModes": list(result.config.selection_modes),
                    "notes": result.notes,
                }
                for result in results
            },
            "comparison": (
                "A-D son los brazos principales. E/F añaden cada microprueba nueva "
                "por separado para estimar contribuciones dentro de este simulador. "
                "Todos comparten perfiles, semillas, ruido y límite. D reutiliza "
                "exactamente las respuestas de B; cambia solo la decisión final."
            ),
            "byPatternNoise": pattern_noise,
            "newMicrotestUsage": new_microtest_usage,
            "overall": {
                result.name: result.metrics["overall"]
                for result in results
            },
            "byPattern": {
                result.name: result.metrics["byPattern"]
                for result in results
            },
        },
    }

    json_path = directory / "ablation.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    csv_path = directory / "ablation.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        fields = [
            "method",
            "pattern",
            "noise",
            "sessions",
            "resolution_rate",
            "identification_accuracy",
            "abstention_rate",
            "false_positive_rate",
            "microtests_mean",
        ]
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(csv_rows)

    lines = [
        "# Ablación sintética del banco y los métodos",
        "",
        "> **Advertencia:** estos resultados provienen de perfiles artificiales y firmas del propio banco. "
        "No son datos de estudiantes ni validación educativa.",
        "",
        f"- Semilla: `{reference.seed}`; sesiones por perfil: `{reference.sessions_per_profile}`.",
        f"- Niveles configurados de ruido: `{list(reference.noise_levels)}`; máximo: `{reference.max_per_session}` micropruebas.",
        f"- Umbral bayesiano experimental: `{threshold:.2f}`.",
        "- Los seis brazos usan las mismas hipótesis, perfiles, semillas y niveles de ruido; ninguna selección recibe la hipótesis generadora.",
        "- D usa las mismas preguntas y respuestas que B: solo cambia la decisión final.",
        "",
        "## Brazos",
        "",
        *_markdown_table(
            ["Brazo", "Banco", "Sesiones", "Resolución", "Exactitud*", "Abstención", "Falsos positivos*", "Micropruebas"],
            [
                [
                    result.name,
                    str(result.metrics["instrument"]["microtests"]),
                    str(result.metrics["overall"]["sessions"]),
                    f"{result.metrics['overall']['resolution_rate']:.2%}",
                    f"{result.metrics['overall']['identification_accuracy']:.2%}",
                    f"{result.metrics['overall']['abstention_rate']:.2%}",
                    f"{result.metrics['overall']['false_positive_rate']:.2%}",
                    f"{result.metrics['overall']['microtests_mean']:.2f}",
                ]
                for result in results
            ],
        ),
        "",
        "* Exactitud y falsos positivos usan solo sesiones de perfiles con una hipótesis generadora; "
        "los perfiles `solo-conocidas` carecen de hipótesis estable y quedan excluidos de ambos denominadores.",
        "",
        "Los perfiles se puntúan solo contra una hipótesis generadora estable. El perfil `solo-conocidas` "
        "no generaliza por diseño y se excluye de exactitud y falsos positivos, aunque cuenta en resolución, "
        "abstención y micropruebas.",
        "",
        "## Uso de las dos micropruebas nuevas",
        "",
        *_markdown_table(
            ["Brazo", "range-un-argumento-01", "acc-inicial-cero-02"],
            [
                [
                    result.name,
                    f"{result.metrics['overall']['sessions']} sesiones; "
                    f"{new_microtest_usage[result.name]['range-un-argumento-01']['sessionsUsing']} "
                    f"({new_microtest_usage[result.name]['range-un-argumento-01']['sessionRate']:.2%})",
                    f"{result.metrics['overall']['sessions']} sesiones; "
                    f"{new_microtest_usage[result.name]['acc-inicial-cero-02']['sessionsUsing']} "
                    f"({new_microtest_usage[result.name]['acc-inicial-cero-02']['sessionRate']:.2%})",
                ]
                for result in results
            ],
        ),
        "",
        "## Resultados por patrón",
        "",
        *_markdown_table(
            ["Patrón", "Brazo", "Sesiones", "Resolución", "Exactitud*", "Abstención", "Falsos positivos*", "Micropruebas"],
            [
                [
                    pattern,
                    result.name,
                    str(values["sessions"]),
                    f"{values['resolution_rate']:.2%}",
                    f"{values['identification_accuracy']:.2%}",
                    f"{values['abstention_rate']:.2%}",
                    f"{values['false_positive_rate']:.2%}",
                    f"{values['microtests_mean']:.2f}",
                ]
                for pattern in reference.patterns
                for result in results
                for values in [result.metrics["byPattern"][pattern]]
            ],
        ),
        "",
        "## Resultados por nivel de ruido",
        "",
        *_markdown_table(
            ["Ruido", "Brazo", "Sesiones", "Resolución", "Exactitud*", "Abstención", "Falsos positivos*", "Micropruebas"],
            [
                [
                    f"{noise:.1f}",
                    result.name,
                    str(values["sessions"]),
                    f"{values['resolution_rate']:.2%}",
                    f"{values['identification_accuracy']:.2%}",
                    f"{values['abstention_rate']:.2%}",
                    f"{values['false_positive_rate']:.2%}",
                    f"{values['microtests_mean']:.2f}",
                ]
                for noise in reference.noise_levels
                for result in results
                for values in [result.metrics["byNoise"][str(noise)]]
            ],
        ),
        "",
        "## Interpretación y límites",
        "",
        "- A vs B es la comparación marginal del efecto de añadir los dos ítems dentro de este simulador; no estima su efecto con estudiantes.",
        "- E y F aíslan cada ítem nuevo respecto de A; sus efectos siguen condicionados por los mismos perfiles y reglas sintéticas.",
        "- En el selector adaptativo B, `range-un-argumento-01` se usó en 10/2960 sesiones (0.34%) y `acc-inicial-cero-02` en 446/2960 (15.07%); la contribución marginal de RANGE fue pequeña en este experimento.",
        "- C cambia el selector, por lo que B vs C no aísla el efecto del tamaño del banco.",
        "- D mantiene el selector adaptativo de B; las plausibilidades dependen de supuestos experimentales y de firmas compartidas con el generador.",
        "- En el perfil `error-ocasional`, el ruido es fijo en 0.1 aunque cambie el nivel del experimento; se reporta el valor efectivo en `ablation.csv`.",
        "- No se cambian ítems ni parámetros a partir de los resultados.",
        "",
        "El uso observado de cada microprueba nueva por brazo está en `ablation.json`; la tabla completa por método/patrón/ruido y las configuraciones también están en esos archivos.",
        "",
    ]
    markdown_path = directory / "ABLATION.md"
    markdown_path.write_text("\n".join(lines), encoding="utf-8")
    return {"json": json_path, "csv": csv_path, "markdown": markdown_path}
