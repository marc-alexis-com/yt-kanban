<script setup>
import { ref } from 'vue';
import { SIZES, THEMES, useSettings } from '../stores/settings.js';
import Modal from './Modal.vue';

const emit = defineEmits(['close']);
const settings = useSettings();
const modal = ref(null);
</script>

<template>
  <Modal ref="modal" title="Settings" @close="emit('close')">
    <fieldset class="flex flex-col gap-2">
      <legend class="mb-2 text-sm font-medium">Theme</legend>
      <div class="flex gap-2">
        <label
          v-for="t in THEMES"
          :key="t.value"
          class="flex h-8 cursor-pointer items-center rounded-lg px-3 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-link"
          :class="settings.theme === t.value ? 'bg-text text-bg' : 'bg-chip hover:bg-chip-hover'"
        >
          <input v-model="settings.theme" type="radio" name="theme" :value="t.value" class="sr-only" />
          {{ t.label }}
        </label>
      </div>
      <p class="text-xs text-muted">Auto follows your system's light or dark mode.</p>
    </fieldset>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-2 text-sm font-medium">Card size</legend>
      <div class="flex gap-2">
        <label
          v-for="s in SIZES"
          :key="s.value"
          class="flex h-8 cursor-pointer items-center rounded-lg px-3 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-link"
          :class="settings.size === s.value ? 'bg-text text-bg' : 'bg-chip hover:bg-chip-hover'"
        >
          <input v-model="settings.size" type="radio" name="size" :value="s.value" class="sr-only" />
          {{ s.label }}
        </label>
      </div>
      <p class="text-xs text-muted">Thumbnails, columns and the grid of a theme grow or shrink together.</p>
    </fieldset>

    <p class="text-xs text-muted">Saved in this browser only.</p>

    <template #actions>
      <button class="rounded-full px-4 py-2 text-sm font-medium text-link hover:bg-link/10" @click="modal.close()">Done</button>
    </template>
  </Modal>
</template>
