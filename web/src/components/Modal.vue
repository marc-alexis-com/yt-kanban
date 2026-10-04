<script setup>
import { onMounted, ref } from 'vue';
import Icon from './Icon.vue';

defineProps({ title: { type: String, required: true } });
const emit = defineEmits(['close']);
const dialog = ref(null);

// Native <dialog>: focus trap, Escape and backdrop come for free
onMounted(() => dialog.value.showModal());
defineExpose({ close: () => dialog.value.close() });
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[min(520px,calc(100vw-2rem))] rounded-xl bg-raised p-0 text-text shadow-2xl backdrop:bg-black/50"
    @close="emit('close')"
    @click.self="dialog.close()"
  >
    <div class="flex max-h-[85vh] flex-col">
      <header class="flex items-center justify-between py-3 pr-3 pl-6">
        <h2 class="text-xl">{{ title }}</h2>
        <button class="grid size-10 place-items-center rounded-full hover:bg-chip-hover" aria-label="Close" @click="dialog.close()">
          <Icon name="close" />
        </button>
      </header>
      <div class="flex flex-col gap-4 overflow-y-auto px-6 pb-2">
        <slot />
      </div>
      <footer class="flex justify-end gap-2 px-4 py-3">
        <slot name="actions" />
      </footer>
    </div>
  </dialog>
</template>
