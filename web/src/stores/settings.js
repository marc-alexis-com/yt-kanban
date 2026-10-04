// Per-browser display preferences (theme, card size), kept in localStorage: they belong to
// the viewer, not to the board. Applied to <html> as soon as the store is created.
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const KEY = 'yt-kanban:settings';

export const THEMES = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Thumbnail width in the columns, column width, minimum grid cell width
export const SIZES = [
  { value: 'small', label: 'Small', thumb: 120, col: 300, grid: 220 },
  { value: 'medium', label: 'Medium', thumb: 160, col: 360, grid: 300 },
  { value: 'large', label: 'Large', thumb: 210, col: 440, grid: 380 },
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {}; // private window, blocked storage…
  }
}

export const useSettings = defineStore('settings', () => {
  const saved = load();
  const theme = ref(THEMES.some((t) => t.value === saved.theme) ? saved.theme : 'auto');
  const size = ref(SIZES.some((s) => s.value === saved.size) ? saved.size : 'medium');

  function apply() {
    const root = document.documentElement;
    root.dataset.theme = theme.value;
    const s = SIZES.find((x) => x.value === size.value);
    root.style.setProperty('--thumb-w', `${s.thumb}px`);
    root.style.setProperty('--col-w', `${s.col}px`);
    root.style.setProperty('--grid-min', `${s.grid}px`);
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme: theme.value, size: size.value }));
    } catch {
      // not saved, still applied for this visit
    }
  }

  apply();
  watch([theme, size], apply);

  return { theme, size };
});
