<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useBoard } from './stores/board.js';
import { api, sessionExpired } from './api.js';
import Icon from './components/Icon.vue';
import VideoCard from './components/VideoCard.vue';
import AddDialog from './components/AddDialog.vue';
import TriageDialog from './components/TriageDialog.vue';

const board = useBoard();
const dialog = ref(null); // 'add' | 'triage' | null
const loadError = ref('');
const importInput = ref(null);
const moreOpen = ref(false);
const moreMenu = ref(null);

onMounted(() => board.load().catch((err) => (loadError.value = err.message)));

const reload = () => window.location.reload();
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

function closeMore(event) {
  if (!moreMenu.value?.contains(event.target)) moreOpen.value = false;
}
onMounted(() => document.addEventListener('pointerdown', closeMore, true));
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeMore, true));

function openTheme(theme) {
  board.activeTheme = board.activeTheme === theme ? null : theme;
}

async function renameActive() {
  const from = board.activeTheme;
  const to = prompt(`Nouveau nom pour « ${from} » (un nom existant fusionne les deux thèmes) :`, from)?.trim();
  if (to && to !== from) await board.renameTheme(from, to).catch((err) => alert(err.message));
}

async function importFile(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const result = await api.import(JSON.parse(await file.text()));
    await board.load();
    alert(`Import : ${result.added} ajoutée(s), ${result.updated} mise(s) à jour, ${result.skipped} ignorée(s).`);
  } catch (err) {
    alert(`Import impossible : ${err.message}`);
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="sessionExpired" class="flex items-center justify-center gap-4 bg-raised px-4 py-2 text-sm">
      Ta session a expiré.
      <button class="rounded-full px-3 py-1.5 font-medium text-link hover:bg-link/10" @click="reload">Se reconnecter</button>
    </div>

    <!-- Masthead -->
    <header class="flex h-14 shrink-0 items-center gap-2 px-4 sm:gap-4">
      <button class="flex shrink-0 items-center gap-1 whitespace-nowrap" title="Tous les thèmes" @click="board.activeTheme = null">
        <svg width="30" height="21" viewBox="0 0 30 21" aria-hidden="true">
          <rect width="30" height="21" rx="6" fill="var(--color-red)" />
          <path d="M12 6v9l8-4.5z" fill="#fff" />
        </svg>
        <span class="text-lg font-bold tracking-tight max-sm:hidden">À voir</span>
      </button>

      <form class="mx-auto flex h-10 w-full min-w-0 max-w-xl" role="search" @submit.prevent>
        <input
          v-model="board.query"
          type="search"
          placeholder="Rechercher un titre ou une chaîne"
          class="min-w-0 flex-1 rounded-l-full border border-line bg-[#121212] px-4 text-base outline-none placeholder:text-muted focus:border-link"
        />
        <span class="grid w-16 place-items-center rounded-r-full border border-l-0 border-line bg-chip max-sm:w-11" aria-hidden="true">
          <Icon name="search" />
        </span>
      </form>

      <div class="flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          class="grid size-10 place-items-center rounded-full hover:bg-chip-hover"
          :class="board.showViewed ? 'bg-chip' : ''"
          :title="board.showViewed ? 'Masquer les vidéos vues' : 'Afficher les vidéos vues'"
          @click="board.showViewed = !board.showViewed"
        >
          <Icon :name="board.showViewed ? 'eye' : 'eyeOff'" />
        </button>
        <button
          v-if="board.triageAvailable && board.inboxCount"
          class="flex h-9 items-center gap-1.5 rounded-full bg-chip pr-4 pl-3 text-sm font-medium hover:bg-chip-hover"
          title="Proposer un thème pour chaque vidéo à trier (Claude)"
          @click="dialog = 'triage'"
        >
          <Icon name="sort" :size="20" /> <span class="max-md:hidden">Trier</span> {{ board.inboxCount }}
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-full bg-chip pr-4 pl-3 text-sm font-medium hover:bg-chip-hover max-md:pr-2 max-md:pl-2"
          title="Ajouter des vidéos"
          @click="dialog = 'add'"
        >
          <Icon name="add" :size="20" /> <span class="max-md:hidden">Ajouter</span>
        </button>
        <div ref="moreMenu" class="relative">
          <button class="grid size-10 place-items-center rounded-full hover:bg-chip-hover" aria-label="Plus" @click="moreOpen = !moreOpen">
            <Icon name="more" />
          </button>
          <div v-if="moreOpen" class="absolute right-0 z-40 mt-1 w-56 rounded-xl bg-menu py-2 text-sm shadow-[0_4px_32px_rgba(0,0,0,.6)]">
            <a href="/api/export" class="flex items-center gap-4 px-4 py-2 hover:bg-chip-hover" @click="moreOpen = false">
              <Icon name="download" /> Exporter (JSON)
            </a>
            <button class="flex w-full items-center gap-4 px-4 py-2 hover:bg-chip-hover" @click="moreOpen = false; importInput.click()">
              <Icon name="upload" /> Importer…
            </button>
          </div>
        </div>
        <input ref="importInput" type="file" accept="application/json,.json" hidden @change="importFile" />
      </div>
    </header>

    <!-- Theme chips, like YouTube's filter bar -->
    <nav class="flex shrink-0 gap-3 overflow-x-auto px-4 pt-1 pb-3">
      <button
        v-for="theme in [null, ...board.themes]"
        :key="theme ?? '*'"
        class="h-8 shrink-0 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors"
        :class="board.activeTheme === theme ? 'bg-text text-bg' : 'bg-chip hover:bg-chip-hover'"
        @click="theme === null ? (board.activeTheme = null) : openTheme(theme)"
      >
        {{ theme ?? 'Tous' }}
        <span v-if="theme !== null && board.unseenByTheme[theme]" class="ml-1 opacity-60">{{ board.unseenByTheme[theme] }}</span>
      </button>
    </nav>

    <p v-if="loadError" class="p-6 text-red">Chargement impossible : {{ loadError }}</p>
    <p v-else-if="!board.loaded" class="p-6 text-muted">Chargement…</p>
    <p v-else-if="!board.videos.length" class="p-6 text-muted">Aucune vidéo pour l'instant : « Ajouter » en haut à droite.</p>

    <!-- One theme: the home-page grid -->
    <main v-else-if="board.activeTheme" class="flex-1 overflow-y-auto px-4 pt-2 pb-10">
      <div class="mb-4 flex items-baseline gap-3">
        <h2 class="text-xl font-bold">{{ board.activeTheme }}</h2>
        <span class="text-sm text-muted">{{ plural(board.shownCount, 'vidéo') }}</span>
        <button class="flex items-center gap-1 self-center rounded-full px-2 py-1 text-sm text-muted hover:bg-chip hover:text-text" @click="renameActive">
          <Icon name="edit" :size="16" /> Renommer
        </button>
      </div>
      <p v-if="!board.shownCount" class="text-sm text-muted">
        Rien ici<template v-if="!board.showViewed"> : les vidéos vues sont masquées (icône œil en haut)</template>.
      </p>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-4 gap-y-10">
        <VideoCard v-for="video in board.columns[0]?.videos" :key="video.id" :video="video" layout="grid" />
      </div>
    </main>

    <!-- All themes: one "Up next"-style list per theme -->
    <main v-else class="flex flex-1 gap-6 overflow-x-auto px-4 pt-2">
      <p v-if="!board.columns.length" class="text-muted">Rien à afficher avec cette recherche.</p>
      <section v-for="col in board.columns" :key="col.theme" class="flex w-[min(360px,calc(100vw-3rem))] shrink-0 flex-col">
        <button class="mb-3 flex items-baseline gap-2 text-left" :title="`Ouvrir « ${col.theme} »`" @click="openTheme(col.theme)">
          <h2 class="truncate text-base font-bold hover:underline">{{ col.theme }}</h2>
          <span class="shrink-0 text-sm text-muted">{{ col.videos.length }}</span>
        </button>
        <div class="-mr-2 flex flex-col gap-2 overflow-y-auto pr-2 pb-10">
          <VideoCard v-for="video in col.videos" :key="video.id" :video="video" />
        </div>
      </section>
    </main>

    <AddDialog v-if="dialog === 'add'" @close="dialog = null" />
    <TriageDialog v-if="dialog === 'triage'" @close="dialog = null" />
  </div>
</template>
