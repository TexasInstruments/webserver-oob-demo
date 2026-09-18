<template>
  <div class="audio-player">
    <div class="ap-label">{{ label }}</div>
    <div class="ap-row">
      <button class="ap-play" :disabled="!url" @click="toggle">
        <v-icon size="10">{{ playing ? 'mdi-pause' : 'mdi-play' }}</v-icon>
      </button>
      <div class="ap-track" @click="seek">
        <div class="ap-fill" :style="{ width: progress + '%', background: accent }" />
      </div>
      <span class="ap-time">{{ timeStr }}</span>
    </div>
    <audio ref="audioEl" :src="url" preload="metadata"
      @loadedmetadata="onTime" @durationchange="onTime" @timeupdate="onTime"
      @seeking="onTime" @seeked="onTime" @playing="onPlaying"
      @pause="onPause" @ended="onEnded" @error="onPause" @emptied="reset" />
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  label:  { type: String, default: '' },
  url:    { type: String, default: '' },
  accent: { type: String, default: '#4da6ff' },
})

const audioEl  = ref(null)
const playing  = ref(false)
const progress = ref(0)
const timeStr  = ref('--:--')

let animationFrame = null

function stopClock() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  animationFrame = null
}

function reset() {
  stopClock()
  playing.value = false
  progress.value = 0
  timeStr.value = '--:--'
}

watch(() => props.url, reset)
onBeforeUnmount(() => {
  stopClock()
  audioEl.value?.pause()
})

async function toggle() {
  const el = audioEl.value
  if (!el) return
  if (!el.paused) {
    el.pause()
    return
  }
  try {
    await el.play()
  } catch {
    // A source change or browser playback rejection must not leave a false
    // playing state. The media events own the state on successful playback.
    if (el === audioEl.value && el.paused) onPause()
  }
}

function onTime() {
  const el = audioEl.value
  if (!el) return
  const current = Number.isFinite(el.currentTime) ? Math.max(0, el.currentTime) : 0
  timeStr.value = fmt(current)
  progress.value = Number.isFinite(el.duration) && el.duration > 0
    ? Math.min(100, Math.max(0, current / el.duration * 100)) : 0
}

function tick() {
  animationFrame = null
  onTime()
  const el = audioEl.value
  if (el && !el.paused && !el.ended) animationFrame = requestAnimationFrame(tick)
}

function onPlaying() {
  playing.value = true
  stopClock()
  tick()
}

function onPause() {
  playing.value = false
  stopClock()
  onTime()
}

function onEnded() {
  onPause()
  // Keep the bar at the completed position; replay updates it from currentTime.
}

function seek(e) {
  const el = audioEl.value
  if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return
  const rect = e.currentTarget.getBoundingClientRect()
  if (rect.width <= 0) return
  el.currentTime = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * el.duration
  onTime()
}

function fmt(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
</script>

<style scoped>
.audio-player { background:rgb(var(--v-theme-surface-variant)); border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); border-radius:6px; padding:8px 10px; }
.ap-label { font-size:11px; color:#64748b; margin-bottom:6px; }
.ap-row   { display:flex; align-items:center; gap:8px; }
.ap-play  { width:28px; height:28px; border-radius:50%; background:rgb(var(--v-theme-surface)); border:1px solid rgba(var(--v-border-color),1); color:rgb(var(--v-theme-on-surface)); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.ap-play:disabled { opacity:0.35; cursor:not-allowed; }
.ap-track { flex:1; height:3px; background:rgba(var(--v-border-color),0.5); border-radius:2px; overflow:hidden; cursor:pointer; }
.ap-fill  { height:100%; border-radius:2px; pointer-events:none; }
.ap-time  { font-size:10px; color:#475569; min-width:32px; text-align:right; }
</style>
