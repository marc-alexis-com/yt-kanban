<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api.js';
import { useBoard } from '../stores/board.js';
import Modal from './Modal.vue';

const emit = defineEmits(['close']);
const board = useBoard();
const modal = ref(null);

const loading = ref(true);
const applying = ref(false);
const error = ref('');
const suggestions = ref([]); // [{ id, title, author, theme, keep }]
const done = ref(null);

const selected = computed(() => suggestions.value.filter((s) => s.keep));
const left = computed(() => board.inboxCount - suggestions.value.length);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

onMounted(async () => {
  try {
    const { suggestions: list } = await api.suggest();
    suggestions.value = list.map((s) => ({ ...s, keep: true }));
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

async function apply() {
  applying.value = true;
  try {
    done.value = await board.applyTriage(selected.value.map(({ id, theme }) => ({ id, theme })));
  } catch (err) {
    error.value = err.message;
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <Modal ref="modal" :title="`Sort &quot;${board.inboxTheme}&quot;`" @close="emit('close')">
    <p v-if="loading" class="text-sm text-muted">Claude is reading the {{ plural(board.inboxCount, 'video') }} to sort…</p>
    <p v-else-if="error" class="text-sm text-red">{{ error }}</p>
    <p v-else-if="done" class="text-sm">{{ plural(done.moved, 'video') }} sorted.</p>
    <template v-else>
      <p class="text-sm text-muted">
        <template v-if="suggestions.length">
          Untick what you disagree with.
          <template v-if="left > 0">{{ plural(left, 'video') }} left unsorted: no obvious theme.</template>
        </template>
        <template v-else>No video has an obvious theme, nothing is moved.</template>
      </p>
      <ul class="-mx-2 flex flex-col">
        <li v-for="s in suggestions" :key="s.id">
          <label class="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-chip">
            <input v-model="s.keep" type="checkbox" class="mt-0.5 size-4 accent-link" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm">{{ s.title }}</span>
              <span class="block truncate text-xs text-muted">{{ s.author }} → <span class="text-text">{{ s.theme }}</span></span>
            </span>
          </label>
        </li>
      </ul>
    </template>

    <template #actions>
      <button class="rounded-full px-4 py-2 text-sm font-medium hover:bg-chip-hover" @click="modal.close()">
        {{ done || error || (!loading && !suggestions.length) ? 'Close' : 'Cancel' }}
      </button>
      <button
        v-if="!loading && !done && suggestions.length"
        class="rounded-full px-4 py-2 text-sm font-medium text-link hover:bg-link/10 disabled:text-muted disabled:hover:bg-transparent"
        :disabled="applying || !selected.length"
        @click="apply"
      >
        {{ applying ? 'Sorting…' : `Sort ${plural(selected.length, 'video')}` }}
      </button>
    </template>
  </Modal>
</template>
