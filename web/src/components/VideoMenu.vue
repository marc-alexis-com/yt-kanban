<script setup>
// The ⋮ menu of a video, YouTube style. Rendered in <body> with fixed positioning so the
// scrolling columns never clip it; only one menu is open at a time.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useBoard } from '../stores/board.js';
import Icon from './Icon.vue';

const props = defineProps({ video: { type: Object, required: true } });
const board = useBoard();

const { openMenu: openId } = storeToRefs(board);
const button = ref(null);
const menu = ref(null);
const page = ref('main'); // 'main' | 'move'
const style = ref({});

const fail = (err) => alert(err.message);
const isOpen = () => openId.value === props.video.id;

async function toggle() {
  if (isOpen()) return close();
  page.value = 'main';
  openId.value = props.video.id;
  await place();
}

async function place() {
  await nextTick();
  const b = button.value.getBoundingClientRect();
  const m = menu.value.getBoundingClientRect();
  const below = b.bottom + 4 + m.height <= window.innerHeight;
  style.value = {
    top: `${below ? b.bottom + 4 : Math.max(8, b.top - 4 - m.height)}px`,
    left: `${Math.max(8, Math.min(b.right - m.width, window.innerWidth - m.width - 8))}px`,
  };
}

function close() {
  if (isOpen()) openId.value = null;
}

function onOutside(event) {
  if (!menu.value?.contains(event.target) && !button.value?.contains(event.target)) close();
}
const onKey = (event) => event.key === 'Escape' && close();

watch(openId, (id) => {
  const open = id === props.video.id;
  const method = open ? 'addEventListener' : 'removeEventListener';
  document[method]('pointerdown', onOutside, true);
  document[method]('keydown', onKey);
  window[method]('resize', close);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside, true);
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', close);
});

async function showMove() {
  page.value = 'move';
  await place();
}

function run(action) {
  close();
  action().catch(fail);
}

const toggleViewed = () => run(() => board.setViewed(props.video, !props.video.viewed));
const moveTo = (theme) => run(() => board.move(props.video, theme));

function moveToNew() {
  const theme = prompt('Nom du nouveau thème :')?.trim();
  if (theme) moveTo(theme);
  else close();
}

function remove() {
  close();
  if (confirm(`Retirer « ${props.video.title} » du tableau ?`)) board.remove(props.video).catch(fail);
}
</script>

<template>
  <button
    ref="button"
    class="grid size-9 place-items-center rounded-full text-text hover:bg-chip-hover"
    :class="openId === video.id ? 'bg-chip-hover' : ''"
    aria-label="Actions"
    @click.stop.prevent="toggle"
  >
    <Icon name="more" :size="20" />
  </button>

  <Teleport to="body">
    <div
      v-if="openId === video.id"
      ref="menu"
      class="fixed z-50 w-64 rounded-xl bg-menu py-2 text-sm shadow-[0_4px_32px_rgba(0,0,0,.6)]"
      :style="style"
      role="menu"
    >
      <template v-if="page === 'main'">
        <button class="flex w-full items-center gap-4 px-4 py-2 hover:bg-chip-hover" @click="toggleViewed">
          <Icon :name="video.viewed ? 'eyeOff' : 'check'" />
          {{ video.viewed ? 'Marquer comme non vue' : 'Marquer comme vue' }}
        </button>
        <button class="flex w-full items-center gap-4 px-4 py-2 hover:bg-chip-hover" @click="showMove">
          <Icon name="move" />
          Déplacer vers…
        </button>
        <hr class="my-2 border-line" />
        <button class="flex w-full items-center gap-4 px-4 py-2 hover:bg-chip-hover" @click="remove">
          <Icon name="delete" />
          Retirer du tableau
        </button>
      </template>

      <template v-else>
        <button class="flex w-full items-center gap-4 px-4 py-2 text-muted hover:bg-chip-hover" @click="page = 'main'">
          <Icon name="back" />
          Déplacer vers…
        </button>
        <div class="max-h-72 overflow-y-auto">
          <button
            v-for="theme in board.themes"
            :key="theme"
            class="flex w-full items-center gap-4 px-4 py-2 text-left hover:bg-chip-hover"
            @click="theme !== video.theme && moveTo(theme)"
          >
            <span class="w-6"><Icon v-if="theme === video.theme" name="check" /></span>
            <span class="truncate">{{ theme }}</span>
          </button>
        </div>
        <hr class="my-2 border-line" />
        <button class="flex w-full items-center gap-4 px-4 py-2 hover:bg-chip-hover" @click="moveToNew">
          <Icon name="newFolder" />
          Nouveau thème…
        </button>
      </template>
    </div>
  </Teleport>
</template>
