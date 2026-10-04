// Board state: all videos are loaded once, filtering happens client-side
// (a few thousand videos are nothing for the browser).
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api.js';

const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export const useBoard = defineStore('board', () => {
  const videos = ref([]);
  const inboxTheme = ref('Inbox');
  const triageAvailable = ref(false);
  const loaded = ref(false);

  const query = ref('');
  const showViewed = ref(false);
  const activeTheme = ref(null);
  const openMenu = ref(null); // id of the video whose ⋮ menu is open

  // Inbox first, then alphabetical
  const themes = computed(() => {
    const names = [...new Set(videos.value.map((v) => v.theme))].sort(byName);
    const i = names.indexOf(inboxTheme.value);
    if (i > 0) names.unshift(...names.splice(i, 1));
    return names;
  });

  const unseenCount = computed(() => videos.value.filter((v) => !v.viewed).length);
  const seenCount = computed(() => videos.value.length - unseenCount.value);
  const inboxCount = computed(() => videos.value.filter((v) => v.theme === inboxTheme.value).length);

  const unseenByTheme = computed(() => {
    const counts = {};
    for (const v of videos.value) if (!v.viewed) counts[v.theme] = (counts[v.theme] || 0) + 1;
    return counts;
  });

  function matches(v) {
    if (!showViewed.value && v.viewed) return false;
    const q = query.value.trim().toLowerCase();
    return !q || v.title.toLowerCase().includes(q) || v.author.toLowerCase().includes(q);
  }

  // [{ theme, videos }] for the columns to display, empty columns skipped
  const columns = computed(() => {
    const shown = activeTheme.value ? [activeTheme.value] : themes.value;
    return shown
      .map((theme) => ({ theme, videos: videos.value.filter((v) => v.theme === theme && matches(v)) }))
      .filter((c) => c.videos.length || c.theme === activeTheme.value);
  });

  const shownCount = computed(() => columns.value.reduce((n, c) => n + c.videos.length, 0));

  async function load() {
    const [cfg, list] = await Promise.all([api.config(), api.videos()]);
    inboxTheme.value = cfg.inboxTheme;
    triageAvailable.value = cfg.triage;
    videos.value = list;
    loaded.value = true;
  }

  function replace(updated) {
    const i = videos.value.findIndex((v) => v.id === updated.id);
    if (i !== -1) videos.value[i] = updated;
  }

  async function setViewed(video, viewed) {
    replace(await api.update(video.id, { viewed }));
  }

  async function move(video, theme) {
    replace(await api.update(video.id, { theme }));
  }

  async function remove(video) {
    await api.remove(video.id);
    videos.value = videos.value.filter((v) => v.id !== video.id);
  }

  async function add(urls) {
    const result = await api.add(urls);
    videos.value.push(...result.added);
    return result;
  }

  async function renameTheme(from, to) {
    await api.renameTheme(from, to);
    for (const v of videos.value) if (v.theme === from) v.theme = to;
    if (activeTheme.value === from) activeTheme.value = to;
  }

  async function applyTriage(assignments) {
    const result = await api.applyTriage(assignments);
    await load();
    return result;
  }

  return {
    videos, inboxTheme, triageAvailable, loaded, query, showViewed, activeTheme, openMenu,
    themes, unseenCount, seenCount, inboxCount, unseenByTheme, columns, shownCount,
    load, setViewed, move, remove, add, renameTheme, applyTriage,
  };
});
