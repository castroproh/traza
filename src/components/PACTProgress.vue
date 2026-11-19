<script setup lang="ts">
import type { PACTStage } from "../domain/pact";

defineProps<{
  stage: PACTStage;
  accessible: Record<PACTStage, boolean>;
}>();

const emit = defineEmits<{ select: [stage: PACTStage] }>();
const steps: { id: PACTStage; label: string }[] = [
  { id: "prediction", label: "Predicción" },
  { id: "analysis", label: "Análisis" },
  { id: "contrast", label: "Contraste" },
  { id: "transfer", label: "Transferencia" },
];
</script>

<template>
  <nav class="pact-progress" aria-label="Etapas PACT">
    <ol>
      <li v-for="(step, index) in steps" :key="step.id">
        <button
          type="button"
          class="stage-button"
          :class="{ current: stage === step.id, locked: !accessible[step.id] }"
          :aria-current="stage === step.id ? 'step' : undefined"
          :disabled="!accessible[step.id]"
          @click="emit('select', step.id)"
        >
          <span class="stage-number">{{ index + 1 }}</span>
          <span>{{ step.label }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>
