<script setup>
import { ref } from 'vue';
import { useBoard } from '../stores/board.js';
import Modal from './Modal.vue';

const emit = defineEmits(['close']);
const board = useBoard();
const modal = ref(null);

const urls = ref('');
const busy = ref(false);
const result = ref(null);
const error = ref('');

async function submit() {
  if (!urls.value.trim() || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    result.value = await board.add(urls.value);
    if (result.value.added.length) urls.value = '';
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal ref="modal" title="Ajouter des vidéos" @close="emit('close')">
    <label class="flex flex-col gap-2">
      <span class="text-sm text-muted">Liens YouTube, un par ligne. Les vidéos arrivent dans « {{ board.inboxTheme }} ».</span>
      <textarea
        v-model="urls"
        autofocus
        rows="6"
        class="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-link"
        placeholder="https://www.youtube.com/watch?v=…"
        @keydown.meta.enter="submit"
        @keydown.ctrl.enter="submit"
      />
    </label>

    <p v-if="error" class="text-sm text-red">{{ error }}</p>
    <div v-if="result" class="flex flex-col gap-3 text-sm">
      <div v-if="result.added.length">
        <p class="font-medium">{{ result.added.length }} vidéo{{ result.added.length > 1 ? 's' : '' }} ajoutée{{ result.added.length > 1 ? 's' : '' }}</p>
        <ul class="mt-1 text-muted">
          <li v-for="v in result.added" :key="v.id" class="truncate">{{ v.title }}</li>
        </ul>
      </div>
      <div v-if="result.ignored.length">
        <p class="font-medium">{{ result.ignored.length }} ignorée{{ result.ignored.length > 1 ? 's' : '' }}</p>
        <ul class="mt-1 text-muted">
          <li v-for="(v, i) in result.ignored" :key="i" class="break-all">{{ v.url }} : {{ v.reason }}</li>
        </ul>
      </div>
    </div>

    <template #actions>
      <button class="rounded-full px-4 py-2 text-sm font-medium hover:bg-chip-hover" @click="modal.close()">
        {{ result ? 'Fermer' : 'Annuler' }}
      </button>
      <button
        class="rounded-full px-4 py-2 text-sm font-medium text-link hover:bg-link/10 disabled:text-muted disabled:hover:bg-transparent"
        :disabled="busy || !urls.trim()"
        @click="submit"
      >
        {{ busy ? 'Ajout…' : 'Ajouter' }}
      </button>
    </template>
  </Modal>
</template>
