<script setup lang="ts">
import { computed, ref } from "vue";
import AnalysisSummary from "./components/AnalysisSummary.vue";
import DiagnosticPanel from "./components/DiagnosticPanel.vue";
import PredictionForm from "./components/PredictionForm.vue";
import TraceTable from "./components/TraceTable.vue";
import { usePact } from "./composables/usePact";
import { useTraceEngine } from "./composables/useTraceEngine";
import { buildBankExportJson } from "./domain/diagnosis/export";
import { evidenceStateLabel } from "./domain/pact/summary";
import { PATTERNS, type DiagnosisPatternId } from "./domain/diagnosis/hypotheses";
import { getExercise, microtestExerciseId, type ExerciseId } from "./domain/exercises";
import type { PredictionInput, PactStage } from "./domain/pact/types";

const pact = usePact();
const engine = useTraceEngine();

const session = pact.session;
const stage = pact.stage;
const summary = pact.summary;
const mainDefinition = pact.mainExercise;
const transferDefinition = pact.transferExercise;

const lastRunExerciseId = ref<ExerciseId | null>(null);
const runningKind = ref<"main" | "contrast" | "transfer" | null>(null);
const bankJson = computed(() => buildBankExportJson());

const mainCode = computed(() =>
  mainDefinition.value ? getExercise(mainDefinition.value.exerciseId)?.code ?? "" : "",
);
const transferCode = computed(() =>
  transferDefinition.value ? getExercise(transferDefinition.value.exerciseId)?.code ?? "" : "",
);

const liveMainResult = computed(() =>
  lastRunExerciseId.value !== null && lastRunExerciseId.value === session.value?.mainExerciseId
    ? engine.result.value
    : null,
);
const liveTransferResult = computed(() =>
  lastRunExerciseId.value !== null && lastRunExerciseId.value === session.value?.transfer?.exerciseId
    ? engine.result.value
    : null,
);

const busy = computed(() => engine.status.value === "running" || engine.status.value === "loading");
const canRun = computed(() => !busy.value);

const engineStatusText = computed(() => {
  switch (engine.status.value) {
    case "idle":
    case "loading":
      return "Cargando Python…";
    case "ready":
      return "Python listo";
    case "running":
      return "Ejecutando en Python…";
    case "success":
      return "Ejecución terminada";
    case "error":
      return "Hubo un problema con el motor";
  }
});

const stageOrder = ["prediction", "analysis", "contrast", "transfer"] as const;
const stageCopy: Record<Exclude<PactStage, "completed">, { purpose: string; instruction: string }> = {
  prediction: {
    purpose: "Anticipa qué hará el programa antes de ejecutarlo.",
    instruction: "Escribe tu resultado, tu razonamiento y tu confianza. La predicción se guarda tal como la envíes.",
  },
  analysis: {
    purpose: "Ejecuta el programa real y compara lo observado con tu predicción.",
    instruction: "Ejecuta cuando estés listo. Después revisa la salida, las iteraciones y el primer punto de divergencia.",
  },
  contrast: {
    purpose: "Distingue explicaciones rivales con micropruebas ejecutadas de verdad.",
    instruction: "Responde cada microprueba y compruébala con Python. La evidencia puede apoyar, contradecir o quedar insuficiente.",
  },
  transfer: {
    purpose: "Aplica el concepto en un ejercicio nuevo, sin pistas.",
    instruction: "Predice, ejecuta y compara. Un acierto aislado no se interpreta como dominio consolidado.",
  },
};

const stepper = computed(() => {
  const current = stage.value === "completed" ? stageOrder.length : stageOrder.indexOf(stage.value as (typeof stageOrder)[number]);
  return stageOrder.map((item, index) => ({
    id: item,
    label: item === "prediction" ? "Predicción" : item === "analysis" ? "Análisis" : item === "contrast" ? "Contraste" : "Transferencia",
    state: index < current ? "done" : index === current ? "current" : "pending",
  }));
});

const activeStageCopy = computed(() =>
  stage.value && stage.value !== "completed" ? stageCopy[stage.value] : null,
);

const patternButtonIds: Record<DiagnosisPatternId, string> = {
  RANGE: "start-range",
  ACUMULADORES: "start-accumulators",
  CONDICIONALES: "start-condicionales",
  FUNCIONES: "start-funciones",
};

const patternButtonLabels: Record<DiagnosisPatternId, string> = {
  RANGE: "Comenzar con range()",
  ACUMULADORES: "Comenzar con acumuladores",
  CONDICIONALES: "Comenzar con condicionales",
  FUNCIONES: "Comenzar con funciones",
};

function startPattern(patternId: DiagnosisPatternId): void {
  lastRunExerciseId.value = null;
  pact.startSession(patternId);
}

function restartSession(): void {
  lastRunExerciseId.value = null;
  pact.restartSession();
}

function discardSaved(): void {
  lastRunExerciseId.value = null;
  pact.discardSavedSession();
}

async function runExercise(id: ExerciseId, kind: "main" | "contrast" | "transfer") {
  runningKind.value = kind;
  try {
    return await engine.run(id);
  } finally {
    runningKind.value = null;
  }
}

async function runMain(): Promise<void> {
  const current = session.value;
  if (!current || current.stage !== "analysis" || !current.prediction || current.analysis) return;
  const result = await runExercise(current.mainExerciseId, "main");
  if (!result) return;
  lastRunExerciseId.value = current.mainExerciseId;
  if (result.success) pact.recordMainAnalysis(result);
}

async function runContrast(microtestId: string, response: string): Promise<void> {
  const current = session.value;
  if (!current || current.stage !== "contrast") return;
  const result = await runExercise(microtestExerciseId(microtestId), "contrast");
  if (!result) return;
  // Un error del programa (por ejemplo NameError) también es un resultado real:
  // algunas micropruebas lo usan como evidencia. Solo se descarta si el Worker falló.
  const observedOutput = result.error
    ? [result.output.trimEnd(), result.error].filter((part) => part.length > 0).join("\n")
    : result.output;
  pact.answerContrast({ microtestId, response, observedOutput });
  if (result.error) engine.clearProgramError();
}

async function runTransfer(): Promise<void> {
  const current = session.value;
  const transfer = current?.transfer;
  if (!current || current.stage !== "transfer" || !transfer?.prediction || transfer.analysis) return;
  const result = await runExercise(transfer.exerciseId, "transfer");
  if (!result) return;
  lastRunExerciseId.value = transfer.exerciseId;
  if (result.success) pact.recordTransferResult(result);
}

function submitMainPrediction(input: PredictionInput): void {
  pact.submitMainPrediction(input);
}

function submitTransferPrediction(input: PredictionInput): void {
  pact.submitTransferPrediction(input);
}

function exportSession(): void {
  const json = pact.exportJson();
  const current = session.value;
  if (!json || !current) return;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `traza-${current.patternId.toLowerCase()}-${current.sessionId.slice(-8)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatState(value: string): string {
  if (value === "supported") return "apoyada";
  if (value === "contradicted") return "contradicha";
  return "sin resolver";
}
</script>

<template>
  <main class="page">
    <header class="masthead">
      <div>
        <h1>TRAZA</h1>
        <p class="tagline">Laboratorio de diagnóstico contrastivo del razonamiento algorítmico</p>
      </div>
      <span class="version">0.8.0 · PACT</span>
    </header>

    <p v-if="pact.persistenceWarning.value" class="alert" role="alert" data-testid="persistence-warning">
      {{ pact.persistenceWarning.value }}
    </p>
    <p v-if="pact.error.value" class="alert" role="alert" data-testid="action-error">{{ pact.error.value }}</p>

    <section v-if="!session" class="start" aria-labelledby="inicio">
      <h2 id="inicio">Elige un patrón para comenzar</h2>
      <p class="hint">
        El recorrido tiene cuatro etapas conectadas: predices, ejecutas Python de verdad, contrastas
        explicaciones rivales y aplicas el concepto en un ejercicio nuevo.
      </p>

      <p v-if="pact.loadMessage.value" class="alert warn" role="alert" data-testid="session-warning">
        {{ pact.loadMessage.value }}
        <button type="button" class="btn btn-small" data-testid="discard-session" @click="discardSaved">
          Descartar la sesión guardada
        </button>
      </p>

      <div class="pattern-cards">
        <article v-for="pattern in PATTERNS" :key="pattern.id" class="pattern-card">
          <h3>{{ pattern.name }}</h3>
          <p>{{ pattern.concept }}</p>
          <p class="muted">{{ pattern.description }}</p>
          <button
            type="button"
            class="btn btn-primary"
            :data-testid="patternButtonIds[pattern.id as DiagnosisPatternId]"
            @click="startPattern(pattern.id as DiagnosisPatternId)"
          >
            {{ patternButtonLabels[pattern.id as DiagnosisPatternId] }}
          </button>
        </article>
      </div>

      <details class="technical">
        <summary>Vista técnica y banco de micropruebas</summary>
        <p>
          El instrumento es determinista y no usa IA generativa. Las micropruebas se ejecutan desde una
          lista blanca del Worker; nunca se envía código libre a Python.
        </p>
        <pre class="json-block" aria-label="Banco de micropruebas en JSON">{{ bankJson }}</pre>
      </details>
    </section>

    <template v-else>
      <p v-if="pact.resumed.value" class="alert ok" role="status" data-testid="resume-banner">
        Sesión recuperada. Continúas en la etapa «{{ stage }}». Tus respuestas anteriores se conservan.
      </p>
      <p v-if="pact.loadMessage.value" class="alert warn" role="alert" data-testid="session-warning">
        {{ pact.loadMessage.value }}
      </p>

      <nav class="stepper" aria-label="Etapas del recorrido PACT" data-testid="stepper">
        <ol>
          <li v-for="item in stepper" :key="item.id" :class="`step-${item.state}`" :data-testid="`stage-${item.id}`">
            <span class="step-number" aria-hidden="true">{{ item.state === "done" ? "✓" : stepper.indexOf(item) + 1 }}</span>
            <span class="step-label">{{ item.label }}</span>
            <span class="sr-only">{{ item.state === "current" ? "etapa actual" : item.state === "done" ? "completada" : "pendiente" }}</span>
          </li>
          <li v-if="stage === 'completed'" class="step-done" data-testid="stage-completed">
            <span class="step-number" aria-hidden="true">✓</span>
            <span class="step-label">Completado</span>
          </li>
        </ol>
      </nav>

      <div v-if="activeStageCopy" class="stage-intro">
        <h2>{{ stepper.find((item) => item.state === "current")?.label }}</h2>
        <p><strong>Propósito:</strong> {{ activeStageCopy.purpose }}</p>
        <p class="hint">{{ activeStageCopy.instruction }}</p>
      </div>

      <!-- ------------------------------------------------------ PREDICCIÓN -->
      <section v-if="stage === 'prediction'" class="block" aria-labelledby="prediccion" data-testid="prediction-stage">
        <div v-if="mainDefinition" class="exercise-card">
          <h2 id="prediccion">{{ mainDefinition.title }}</h2>
          <p>{{ mainDefinition.purpose }}</p>
          <pre class="code" aria-label="Código del ejercicio (solo lectura)"><code><span
              v-for="(text, i) in mainCode.split('\n')" :key="i" class="code-line"><span class="ln">{{ i + 1 }}</span>{{ text }}
            </span></code></pre>
          <PredictionForm
            :exercise="mainDefinition"
            test-id-prefix="prediction"
            submit-label="Guardar predicción y continuar al análisis"
            @submit="submitMainPrediction"
          />
        </div>
      </section>

      <!-- --------------------------------------------------------- ANÁLISIS -->
      <section v-else-if="stage === 'analysis'" class="block" aria-labelledby="analisis" data-testid="analysis-stage">
        <div v-if="mainDefinition" class="exercise-card">
          <h2 id="analisis">{{ mainDefinition.title }}</h2>
          <pre class="code" aria-label="Código del ejercicio (solo lectura)"><code><span
              v-for="(text, i) in mainCode.split('\n')" :key="i" class="code-line"><span class="ln">{{ i + 1 }}</span>{{ text }}
            </span></code></pre>

          <PredictionForm :exercise="mainDefinition" :prediction="session.prediction" test-id-prefix="prediction" />

          <div v-if="!session.analysis" class="run-panel">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!canRun || runningKind === 'main'"
              data-testid="run-main"
              @click="runMain"
            >
              {{ busy ? "Espera a que Python esté listo…" : "Ejecutar programa" }}
            </button>
            <p :class="`status s-${engine.status.value}`" role="status" aria-live="polite">
              <span class="dot" aria-hidden="true"></span>{{ engineStatusText }}
            </p>
          </div>

          <p v-if="engine.errorMessage.value" class="alert" role="alert" data-testid="engine-error">
            {{ engine.errorMessage.value }}
            <button type="button" class="btn btn-small" data-testid="retry-engine" @click="engine.restart()">
              Reintentar motor
            </button>
          </p>

          <template v-if="session.analysis">
            <pre class="output" aria-label="Salida real del programa" data-testid="main-output"><code>{{ session.analysis.observedOutput || "(el programa no mostró nada)" }}</code></pre>

            <AnalysisSummary
              :prediction="session.prediction"
              :analysis="session.analysis"
              heading="Comparación con la ejecución real"
              test-id-prefix="main"
            />

            <section v-if="liveMainResult && liveMainResult.snapshots.length" class="trace" aria-labelledby="seguimiento">
              <h3 id="seguimiento">Seguimiento real de la ejecución</h3>
              <p class="hint">
                Cada fila es un paso que Python registró de verdad. «Antes» es el valor antes de la
                instrucción y «después» al terminar.
              </p>
              <TraceTable :snapshots="liveMainResult.snapshots" :code="mainCode" />
            </section>
            <p v-else class="hint">
              La tabla de seguimiento no se conserva al recargar. El resultado y la comparación sí se recuperan.
            </p>

            <div class="actions">
              <button type="button" class="btn btn-primary" data-testid="go-contrast" @click="pact.goToContrast()">
                Continuar al contraste
              </button>
            </div>
          </template>
        </div>
      </section>

      <!-- --------------------------------------------------------- CONTRASTE -->
      <section v-else-if="stage === 'contrast'" class="block" aria-labelledby="contraste" data-testid="contrast-stage-wrap">
        <h2 id="contraste" class="sr-only">Contraste</h2>
        <DiagnosticPanel
          :pattern-name="PATTERNS.find((pattern) => pattern.id === session?.patternId)?.name ?? session?.patternId ?? ''"
          :hypotheses="pact.hypotheses.value"
          :selection="pact.selection.value"
          :microtest="pact.currentMicrotest.value"
          :contrast="session?.contrast ?? { answers: [], evaluations: [], statuses: {}, unresolved: [], resolved: false, completed: false, completedAt: null }"
          :can-complete="pact.canCompleteContrast.value"
          :engine-status="engine.status.value"
          :engine-error="engine.errorMessage.value"
          @check="runContrast"
          @complete="pact.finishContrast()"
          @retry-engine="engine.restart()"
        />
      </section>

      <!-- ----------------------------------------------------- TRANSFERENCIA -->
      <section v-else-if="stage === 'transfer'" class="block" aria-labelledby="transferencia" data-testid="transfer-stage">
        <div v-if="transferDefinition && session.transfer" class="exercise-card">
          <h2 id="transferencia">{{ transferDefinition.title }}</h2>
          <p>{{ transferDefinition.purpose }}</p>
          <pre class="code" aria-label="Código de transferencia (solo lectura)"><code><span
              v-for="(text, i) in transferCode.split('\n')" :key="i" class="code-line"><span class="ln">{{ i + 1 }}</span>{{ text }}
            </span></code></pre>

          <PredictionForm
            v-if="!session.transfer.prediction"
            :exercise="transferDefinition"
            test-id-prefix="transfer"
            submit-label="Guardar predicción de transferencia"
            @submit="submitTransferPrediction"
          />
          <PredictionForm
            v-else
            :exercise="transferDefinition"
            :prediction="session.transfer.prediction"
            test-id-prefix="transfer"
          />

          <div v-if="session.transfer.prediction && !session.transfer.analysis" class="run-panel">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!canRun || runningKind === 'transfer'"
              data-testid="run-transfer"
              @click="runTransfer"
            >
              {{ busy ? "Espera a que Python esté listo…" : "Ejecutar y comparar" }}
            </button>
            <p :class="`status s-${engine.status.value}`" role="status" aria-live="polite">
              <span class="dot" aria-hidden="true"></span>{{ engineStatusText }}
            </p>
          </div>

          <p v-if="engine.errorMessage.value" class="alert" role="alert" data-testid="engine-error">
            {{ engine.errorMessage.value }}
            <button type="button" class="btn btn-small" data-testid="retry-engine" @click="engine.restart()">
              Reintentar motor
            </button>
          </p>

          <template v-if="session.transfer.analysis">
            <pre class="output" aria-label="Salida real de la transferencia" data-testid="transfer-output"><code>{{ session.transfer.analysis.observedOutput || "(el programa no mostró nada)" }}</code></pre>
            <AnalysisSummary
              :prediction="session.transfer.prediction"
              :analysis="session.transfer.analysis"
              heading="Comparación de la transferencia"
              test-id-prefix="transfer"
            />
            <p v-if="session.transfer.evidence" class="transfer-evidence" :class="session.transfer.evidence.correct ? 'ok' : 'warn'" data-testid="transfer-evidence">
              {{ session.transfer.evidence.note }}
            </p>
            <section v-if="liveTransferResult && liveTransferResult.snapshots.length" class="trace" aria-labelledby="seguimiento-transfer">
              <h3 id="seguimiento-transfer">Seguimiento real de la transferencia</h3>
              <TraceTable :snapshots="liveTransferResult.snapshots" :code="transferCode" />
            </section>
            <div class="actions">
              <button type="button" class="btn btn-primary" data-testid="complete-session" @click="pact.finishSession()">
                Finalizar recorrido
              </button>
            </div>
          </template>
        </div>
      </section>

      <!-- --------------------------------------------------------- COMPLETADO -->
      <section v-else-if="stage === 'completed' && summary" class="block" aria-labelledby="resumen" data-testid="session-summary">
        <h2 id="resumen">Resumen de tu recorrido</h2>
        <p class="hint">
          Este resumen distingue observaciones (lo que se registró) de inferencias (lo que la evidencia
          permite decir). No es una etiqueta sobre ti.
        </p>

        <div class="summary-grid">
          <article>
            <h3>Patrón trabajado</h3>
            <p><strong>{{ summary.patternName }}</strong></p>
            <p class="muted">{{ summary.patternConcept }}</p>
          </article>
          <article>
            <h3>Predicción inicial</h3>
            <p v-if="summary.prediction"><code>{{ summary.prediction.expectedOutput }}</code></p>
            <p v-if="summary.prediction" class="muted">Confianza: {{ summary.prediction.confidence }}/100 (no es calificación)</p>
          </article>
          <article>
            <h3>Resultado de la ejecución</h3>
            <pre v-if="summary.analysis" class="summary-output">{{ summary.analysis.observedOutput }}</pre>
          </article>
        </div>

        <section class="summary-section" aria-labelledby="microresumen">
          <h3 id="microresumen">Micropruebas y evidencias</h3>
          <p v-if="summary.microtests.length === 0" class="muted">No se respondieron micropruebas.</p>
          <ul class="microtest-summary">
            <li v-for="microtest in summary.microtests" :key="microtest.id">
              <strong>{{ microtest.objective }}</strong>
              <p>Tu predicción: <code>{{ microtest.response }}</code> · salida real: <code>{{ microtest.observedOutput || "(sin salida)" }}</code></p>
              <ul>
                <li v-for="evaluation in microtest.evaluations" :key="`${microtest.id}-${evaluation.hypothesisId}`">
                  {{ evaluation.hypothesisTitle }} → {{ evidenceStateLabel(evaluation.state) }}
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <section class="summary-section" aria-labelledby="hipresumen">
          <h3 id="hipresumen">Hipótesis</h3>
          <table class="summary-table">
            <thead>
              <tr><th>Hipótesis</th><th>Estado de la evidencia</th></tr>
            </thead>
            <tbody>
              <tr v-for="hypothesis in summary.hypotheses" :key="hypothesis.id">
                <td>{{ hypothesis.title }} <span class="muted">({{ hypothesis.id }})</span></td>
                <td><span class="status-badge" :class="`st-${hypothesis.status}`">{{ formatState(hypothesis.status) }}</span></td>
              </tr>
            </tbody>
          </table>
          <p class="muted">
            Apoyadas: {{ summary.supported.join(", ") || "ninguna" }} ·
            Contradichas: {{ summary.contradicted.join(", ") || "ninguna" }} ·
            Sin resolver: {{ summary.unresolved.join(", ") || "ninguna" }}
          </p>
        </section>

        <section v-if="summary.transfer" class="summary-section" aria-labelledby="transresumen">
          <h3 id="transresumen">Transferencia</h3>
          <p><strong>{{ summary.transfer.title }}</strong></p>
          <p v-if="summary.transfer.prediction">Tu predicción: <code>{{ summary.transfer.prediction.expectedOutput }}</code></p>
          <pre v-if="summary.transfer.analysis" class="summary-output">{{ summary.transfer.analysis.observedOutput }}</pre>
          <p v-if="summary.transfer.evidenceNote" class="transfer-evidence" data-testid="summary-transfer-evidence">
            {{ summary.transfer.evidenceNote }}
          </p>
        </section>

        <div class="summary-columns">
          <section class="summary-section">
            <h3>Observaciones</h3>
            <ul>
              <li v-for="(item, index) in summary.observations" :key="`obs-${index}`">{{ item }}</li>
            </ul>
          </section>
          <section class="summary-section">
            <h3>Inferencias prudentes</h3>
            <ul>
              <li v-for="(item, index) in summary.inferences" :key="`inf-${index}`">{{ item }}</li>
            </ul>
          </section>
        </div>

        <section class="summary-section">
          <h3>Limitaciones de interpretación</h3>
          <ul>
            <li v-for="(item, index) in summary.limitations" :key="`lim-${index}`">{{ item }}</li>
          </ul>
        </section>

        <div class="actions">
          <button type="button" class="btn btn-primary" data-testid="export-session" @click="exportSession">
            Exportar sesión (JSON)
          </button>
          <button type="button" class="btn" data-testid="restart-session" @click="restartSession">
            Iniciar otra sesión
          </button>
        </div>

        <details class="technical">
          <summary>Vista técnica de la sesión</summary>
          <p>
            Identificador local no personal: <code>{{ session?.sessionId }}</code> ·
            Esquema: {{ session.schemaVersion }} · Instrumento: {{ session.instrumentVersion }}
          </p>
          <p>
            La exportación incluye la sesión completa y el resumen, con versión de esquema y sin datos personales.
          </p>
          <pre class="json-block" data-testid="session-json">{{ pact.exportJson() }}</pre>
        </details>
      </section>

      <section class="block">
        <details class="technical">
          <summary>Vista técnica del motor</summary>
          <p>
            Estado del motor: <strong>{{ engineStatusText }}</strong>. El Worker ejecuta únicamente
            identificadores de ejercicios de la lista blanca; un Worker no es un sandbox de seguridad.
          </p>
          <div class="actions">
            <button type="button" class="btn btn-small" data-testid="restart-engine" @click="engine.restart()">
              Reiniciar motor voluntariamente
            </button>
            <button type="button" class="btn btn-small" data-testid="discard-pact" @click="discardSaved">
              Eliminar sesión local
            </button>
          </div>
        </details>
      </section>
    </template>

    <footer class="footer">
      <p>
        TRAZA 0.8.0 · Sin cuentas, sin ranking y sin recogida de datos personales. La sesión se guarda
        solo en este navegador.
      </p>
    </footer>
  </main>
</template>

<style scoped>
.masthead { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; }
.version { color: var(--muted); font-size: 0.9rem; white-space: nowrap; }
.start { display: grid; gap: 1rem; }
.pattern-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; }
.pattern-card { border: 1px solid var(--line); background: var(--surface); border-radius: 6px; padding: 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
.pattern-card h3 { margin: 0; font-family: var(--serif); }
.pattern-card p { margin: 0; }
.pattern-card .btn { margin-top: auto; align-self: flex-start; }
.stepper { margin: 1.25rem 0 1.5rem; }
.stepper ol { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; margin: 0; padding: 0; }
.stepper li { display: flex; align-items: center; gap: 0.45rem; padding: 0.5rem 0.55rem; border: 1px solid var(--line); background: var(--surface); color: var(--muted); border-radius: 4px; font-size: 0.92rem; }
.stepper .step-current { border-color: var(--accent); color: var(--ink); font-weight: 700; background: #eef4fb; }
.stepper .step-done { color: var(--ok); border-color: #b9d8c4; background: #f3faf5; }
.step-number { display: inline-grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: var(--line); color: var(--ink); font-size: 0.8rem; font-weight: 700; flex: none; }
.step-current .step-number { background: var(--accent); color: var(--accent-ink); }
.step-done .step-number { background: var(--ok); color: #fff; }
.stage-intro h2 { margin-bottom: 0.25rem; }
.stage-intro p { margin: 0.25rem 0; }
.exercise-card { border-top: 1px solid var(--line); padding-top: 1rem; }
.run-panel { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin: 1rem 0; }
.trace { margin-top: 1rem; }
.trace h3 { font-family: var(--serif); }
.transfer-evidence { border-left: 4px solid var(--accent); background: #eef4fb; padding: 0.75rem 1rem; }
.transfer-evidence.ok { border-left-color: var(--ok); background: #eef7f1; }
.transfer-evidence.warn { border-left-color: #b26a00; background: #fdf3e3; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; margin: 1rem 0; }
.summary-grid article { border: 1px solid var(--line); background: var(--surface); border-radius: 4px; padding: 0.85rem 1rem; }
.summary-grid h3 { margin-top: 0; font-family: var(--serif); font-size: 1.05rem; }
.summary-grid p { margin: 0.25rem 0; }
.summary-output {
  font-family: var(--mono);
  background: #f4f1ea;
  border-radius: 3px;
  padding: 0.35rem 0.5rem;
  margin: 0.35rem 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.summary-section { margin: 1.5rem 0; }
.summary-section h3 { font-family: var(--serif); }
.summary-table { width: 100%; border-collapse: collapse; background: var(--surface); }
.summary-table th, .summary-table td { border-bottom: 1px solid var(--line); padding: 0.5rem 0.65rem; text-align: left; }
.summary-table thead th { background: #f1eee6; }
.summary-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1.25rem; }
.microtest-summary { padding-left: 1.15rem; }
.microtest-summary > li { margin-bottom: 0.75rem; }
.microtest-summary code { font-family: var(--mono); background: #f4f1ea; padding: 0.1rem 0.35rem; }
.status-badge { display: inline-block; font-size: 0.82rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 999px; }
.st-supported { background: #e3f3e8; color: var(--ok); }
.st-contradicted { background: var(--danger-bg); color: var(--danger); }
.st-insufficient { background: #f1eee6; color: var(--muted); }
.technical { border-top: 1px dashed var(--line); padding-top: 0.75rem; margin-top: 1rem; }
.technical summary { cursor: pointer; font-weight: 600; }
.json-block { font-family: var(--mono); font-size: 0.8rem; background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 0.75rem; max-height: 22rem; overflow: auto; white-space: pre-wrap; }
.footer { border-top: 1px solid var(--line); margin-top: 3rem; padding-top: 1rem; color: var(--muted); font-size: 0.9rem; }
.footer p { margin: 0; }
@media (max-width: 700px) {
  .stepper ol { grid-template-columns: repeat(2, 1fr); }
  .masthead { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 480px) {
  .stepper ol { grid-template-columns: 1fr; }
  .btn { width: 100%; }
  .btn-small { width: auto; }
}
</style>
