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
    <audio ref="audioEl" :src="url" @timeupdate="onTime" @ended="onEnded" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  label:  { type: String, default: '' },
  url:    { type: String, default: '' },
  accent: { type: String, default: '#4da6ff' },
})

const audioEl  = ref(null)
const playing  = ref(false)
const progress = ref(0)
const timeStr  = ref('--:--')

watch(() => props.url, () => { playing.value = false; progress.value = 0; timeStr.value = '--:--' })

function toggle() {
  if (!audioEl.value) return
  playing.value ? audioEl.value.pause() : audioEl.value.play()
  playing.value = !playing.value
}

function onTime() {
  const el = audioEl.value
  if (!el || !el.duration) return
  progress.value = (el.currentTime / el.duration) * 100
  timeStr.value  = fmt(el.currentTime)
}

function onEnded() { playing.value = false; progress.value = 0 }

function seek(e) {
  const el = audioEl.value
  if (!el || !el.duration) return
  const rect = e.currentTarget.getBoundingClientRect()
  el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration
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
.ap-fill  { height:100%; border-radius:2px; transition:width .1s linear; pointer-events:none; }
.ap-time  { font-size:10px; color:#475569; min-width:32px; text-align:right; }
</style>
