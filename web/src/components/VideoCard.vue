<script setup>
// A video, drawn like YouTube draws one: `row` is the compact "Up next" layout used in the
// columns, `grid` the home-page layout used when a single theme is open.
import { ref } from 'vue';
import { useBoard } from '../stores/board.js';
import Icon from './Icon.vue';
import VideoMenu from './VideoMenu.vue';

const props = defineProps({
  video: { type: Object, required: true },
  layout: { type: String, default: 'row' },
});
const board = useBoard();
const thumbFailed = ref(false);

const thumb = props.video.yt_id ? `/thumbs/${props.video.yt_id}.jpg` : null;
const views = props.video.views ? `${Number(props.video.views).toLocaleString('en-US')} views` : '';

function quickToggle() {
  board.setViewed(props.video, !props.video.viewed).catch((err) => alert(err.message));
}
</script>

<template>
  <article class="group relative flex" :class="layout === 'grid' ? 'flex-col gap-3' : 'gap-2'">
    <a
      :href="video.url"
      target="_blank"
      rel="noopener"
      class="relative block shrink-0 overflow-hidden bg-raised"
      :class="layout === 'grid' ? 'aspect-video w-full rounded-xl' : 'aspect-video w-[var(--thumb-w)] rounded-lg'"
    >
      <img
        v-if="thumb && !thumbFailed"
        :src="thumb"
        loading="lazy"
        alt=""
        class="h-full w-full object-cover"
        @error="thumbFailed = true"
      />
      <span v-else class="grid h-full place-items-center px-2 text-center text-xs text-muted">No thumbnail</span>

      <span v-if="video.duration" class="absolute right-1 bottom-1 rounded bg-black/80 px-1 text-xs font-medium text-white">
        {{ video.duration }}
      </span>
      <!-- Watched: YouTube's red progress bar, full -->
      <span v-if="video.viewed" class="absolute inset-x-0 bottom-0 h-1 bg-red" />

      <button
        class="absolute top-1 right-1 grid size-8 place-items-center rounded bg-black/80 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:hidden"
        :title="video.viewed ? 'Mark as unwatched' : 'Mark as watched'"
        @click.stop.prevent="quickToggle"
      >
        <Icon :name="video.viewed ? 'eyeOff' : 'check'" :size="20" />
      </button>
    </a>

    <div class="flex min-w-0 flex-1 gap-1">
      <div class="min-w-0 flex-1" :class="layout === 'grid' ? 'pt-0.5' : ''">
        <a
          :href="video.url"
          target="_blank"
          rel="noopener"
          class="line-clamp-2 font-medium"
          :class="layout === 'grid' ? 'text-base leading-[22px]' : 'text-sm leading-5'"
          :title="video.title"
        >
          {{ video.title }}
        </a>
        <p class="mt-1 truncate text-muted" :class="layout === 'grid' ? 'text-sm' : 'text-xs'">{{ video.author }}</p>
        <p v-if="views || video.viewed" class="truncate text-muted" :class="layout === 'grid' ? 'text-sm' : 'text-xs'">
          {{ [views, video.viewed ? 'Watched' : ''].filter(Boolean).join(' • ') }}
        </p>
      </div>
      <!-- Hover-only on desktop, always visible on touch screens -->
      <div
        class="-mt-1 -mr-2 transition-opacity [@media(hover:none)]:opacity-100"
        :class="board.openMenu === video.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 has-[button:focus]:opacity-100'"
      >
        <VideoMenu :video="video" />
      </div>
    </div>
  </article>
</template>
