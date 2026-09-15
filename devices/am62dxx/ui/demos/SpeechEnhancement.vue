<template>
  <div class="speech-panel">

    <!-- About card -->
    <v-expansion-panels variant="accordion" flat>
      <v-expansion-panel class="ti-expansion">
        <v-expansion-panel-title class="exp-title">
          <v-icon size="16" color="primary" class="mr-2">mdi-information-outline</v-icon>
          About
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <p class="desc-text">
            Real-time speech enhancement combining noise reduction on C7x DSP with
            TIDL-accelerated speech quality improvement. Delivers clean, intelligible
            audio at low latency.
          </p>

          <!-- Signal flow image -->
          <img :src="isLight ? '/images/speech-enhancement-flow-light.png' : '/images/speech-enhancement-flow.png'" alt="Speech Enhancement Pipeline" class="flow-img" />

          <!-- Features -->
          <ul class="feat-list">
            <li v-for="f in features" :key="f">
              <v-icon size="14" color="success" class="mr-1">mdi-check</v-icon>
              {{ f }}
            </li>
          </ul>

          <!-- Tags -->
          <div class="tags">
            <v-chip v-for="t in tags" :key="t" size="x-small" color="primary" variant="tonal">{{ t }}</v-chip>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Model card -->
    <v-expansion-panels variant="accordion" flat>
      <v-expansion-panel class="ti-expansion">
        <v-expansion-panel-title class="exp-title">
          <v-icon size="16" color="primary" class="mr-2">mdi-brain</v-icon>
          Model Info
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="model-row"><span class="model-lbl">Architecture</span><span class="model-val">GCRN</span></div>
          <div class="model-row"><span class="model-lbl">Runtime</span>      <span class="model-val">TVM + TIDL</span></div>
          <div class="model-row"><span class="model-lbl">Target</span>       <span class="model-val">C7x DSP</span></div>
          <div class="model-row"><span class="model-lbl">Input</span>        <span class="model-val">16kHz mono PCM</span></div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Audio source card -->
    <v-card class="ti-card" flat>
      <div class="card-ttl">Audio Source</div>

      <div class="file-card">
        <div class="file-card-icon">
          <v-icon size="20" color="primary">mdi-file-music</v-icon>
        </div>
        <div class="file-card-info">
          <div class="file-card-name">{{ fileInfo?.defaultFileName || '—' }}</div>
          <div v-if="fileInfo?.wavInfo" class="file-card-meta">
            {{ fileInfo.wavInfo.channels }}ch ·
            {{ (fileInfo.wavInfo.sampleRate / 1000).toFixed(0) }}kHz ·
            {{ fileInfo.wavInfo.bitsPerSample }}-bit ·
            {{ fileInfo.wavInfo.durationSec }}s
          </div>
          <v-chip v-if="uploadedPath" size="x-small" color="success" variant="tonal" class="mt-1">Uploaded</v-chip>
          <v-chip v-else size="x-small" color="primary" variant="tonal" class="mt-1">Default</v-chip>
        </div>
      </div>

    </v-card>

    <!-- Status -->
    <v-card class="ti-card" flat>
      <div class="status-row">
        <div class="status-dot-wrap">
          <span class="status-dot" :class="dotClass" />
          <span class="status-bars" :class="{ active: ws.running.value }">
            <span v-for="i in 5" :key="i" :style="barStyle(i)" />
          </span>
        </div>
        <span class="status-lbl" :class="`text-${ws.statusColor.value}`">{{ ws.statusMsg.value }}</span>
      </div>

      <v-alert v-if="ws.modelLoading.value" type="info" variant="tonal" density="compact" icon="mdi-cog-sync-outline" class="model-loading-alert" aria-live="polite">
        <span class="model-loading-txt">
          <span class="preparing-spinner">&#9696;</span>
          <span><strong>{{ ws.modelName.value || 'GCRN Model Artifacts' }} loading</strong> — {{ gcrNLoadingMsg }}</span>
        </span>
      </v-alert>

      <v-alert v-if="ws.error.value" type="error" density="compact" variant="tonal" closable @click:close="ws.error.value = null">
        {{ ws.error.value }}
      </v-alert>

      <!-- Audio playback -->
      <div v-if="ws.downloadUrls.value" class="playback-row">
        <AudioPlayer label="Input (Noisy)"     :url="ws.downloadUrls.value.inputUrl"  :accent="inputColor" />
        <AudioPlayer label="Output (Enhanced)" :url="ws.downloadUrls.value.outputUrl" :accent="outputColor" />
      </div>
    </v-card>

    <!-- Visualization -->
    <v-card class="ti-card" flat>
      <div class="card-ttl-row">
        <div class="card-ttl">Visualization</div>
        <v-btn
          size="x-small"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-folder-zip-outline"
          :disabled="!canSave"
          :loading="saving"
          @click="saveArtifacts"
        >Save ZIP</v-btn>
      </div>

      <!-- Spectrogram row -->
      <div class="viz-section-hdr">
        <div class="viz-section-lbl">Spectrogram</div>
        <div class="zoom-controls">
          <v-btn icon size="x-small" variant="text" :disabled="spectZoomIdx === 0" @click="spectZoomIdx--" title="Zoom out (more history)">
            <v-icon size="14">mdi-magnify-minus-outline</v-icon>
          </v-btn>
          <span class="zoom-label">{{ spectZoomLevels[spectZoomIdx] }}</span>
          <v-btn icon size="x-small" variant="text" :disabled="spectZoomIdx === spectZoomLevels.length - 1" @click="spectZoomIdx++" title="Zoom in (fewer frames, more detail)">
            <v-icon size="14">mdi-magnify-plus-outline</v-icon>
          </v-btn>
        </div>
      </div>
      <div class="viz-stack">
        <div class="viz-row">
          <div class="viz-ch-label" :style="{ color: inputColor }">Input (Noisy)</div>
          <SpectrogramCanvas ref="spectInRef" :pcm-frame="ws.inputPcmFrame.value" color-map="blue" :bg-color="spectBg" :height="220" :run-key="ws.runKey.value" :max-cols="spectZoomLevels[spectZoomIdx]" />
        </div>
        <div class="viz-row">
          <div class="viz-ch-label" :style="{ color: outputColor }">Output (Enhanced)</div>
          <SpectrogramCanvas ref="spectOutRef" :pcm-frame="ws.outputPcmFrame.value" color-map="green" :bg-color="spectBg" :height="220" :run-key="ws.runKey.value" :max-cols="spectZoomLevels[spectZoomIdx]" />
        </div>
      </div>

      <!-- Waveform row -->
      <div class="viz-section-hdr" style="margin-top:12px;">
        <div class="viz-section-lbl">Waveform</div>
        <div class="zoom-controls">
          <v-btn icon size="x-small" variant="text" :disabled="waveZoomIdx === 0" @click="waveZoomIdx--" title="Zoom out">
            <v-icon size="14">mdi-magnify-minus-outline</v-icon>
          </v-btn>
          <span class="zoom-label">{{ waveZoomLevels[waveZoomIdx] }}×</span>
          <v-btn icon size="x-small" variant="text" :disabled="waveZoomIdx === waveZoomLevels.length - 1" @click="waveZoomIdx++" title="Zoom in (amplify)">
            <v-icon size="14">mdi-magnify-plus-outline</v-icon>
          </v-btn>
        </div>
      </div>
      <div class="viz-stack">
        <div class="viz-row">
          <div class="viz-ch-label" :style="{ color: inputColor }">Input (Noisy)</div>
          <WaveformCanvas ref="waveInRef" :pcm-frame="ws.inputPcm.value" :color="inputColor" :bg-color="canvasBg" :height="130" :run-key="ws.runKey.value" :y-zoom="waveZoomLevels[waveZoomIdx]" />
        </div>
        <div class="viz-row">
          <div class="viz-ch-label" :style="{ color: outputColor }">Output (Enhanced)</div>
          <WaveformCanvas ref="waveOutRef" :pcm-frame="ws.outputPcm.value" :color="outputColor" :bg-color="canvasBg" :height="130" :run-key="ws.runKey.value" :y-zoom="waveZoomLevels[waveZoomIdx]" />
        </div>
      </div>
    </v-card>

    <!-- Chunk timing table -->
    <v-card class="ti-card" flat>
      <div class="card-ttl">Processing Times</div>
      <RmsTable :rows="ws.chunkTimings.value" />
    </v-card>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useSpeechWs }    from '@/composables/useSpeechWs'
import SpectrogramCanvas from '@/components/SpectrogramCanvas.vue'
import WaveformCanvas    from '@/components/WaveformCanvas.vue'
import RmsTable          from '@/components/RmsTable.vue'
import AudioPlayer       from '@/components/AudioPlayer.vue'
import JSZip             from 'jszip'

const vuetifyTheme = useTheme()
const isLight     = computed(() => vuetifyTheme.global.name.value === 'tiLight')
const inputColor  = computed(() => isLight.value ? '#1d6fe8' : '#4da6ff')
const outputColor = computed(() => isLight.value ? '#16a34a' : '#22c55e')
const canvasBg    = computed(() => isLight.value ? '#f1f5f9' : '#05080f')
const spectBg     = computed(() => isLight.value ? '#e8eef6' : '#020408')

const emit = defineEmits(['running-change'])

const ws = useSpeechWs()

// TVM status polling — runs while modelLoading is true to show granular messages
const tvmDetails     = ref(null)
let   _tvmPollTimer  = null

const gcrNLoadingMsg = computed(() => {
  const d = tvmDetails.value
  if (!d) return 'please wait, this may take up to 15 seconds…'
  if (d.c7xState !== 'running') return `waiting for C7x DSP (state: ${d.c7xState || 'unknown'})…`
  if (!d.daemonReady)           return 'loading TVM model daemon…'
  if (!d.modelReady)            return 'preloading GCRN model artifacts, this may take up to 15 seconds…'
  return 'initialising inference pipeline…'
})

async function _pollTvmForLoading() {
  if (!ws.modelLoading.value) return
  try {
    const r = await fetch('/tvm-daemon/status')
    tvmDetails.value = r.ok ? await r.json() : null
  } catch { tvmDetails.value = null }
  if (ws.modelLoading.value) _tvmPollTimer = setTimeout(_pollTvmForLoading, 2000)
}

watch(() => ws.modelLoading.value, v => {
  if (v) { tvmDetails.value = null; _pollTvmForLoading() }
  else   { clearTimeout(_tvmPollTimer); _tvmPollTimer = null }
})

// Emit running-change whenever ws.running changes (not just on manual start/stop)
watch(() => ws.running.value, (v) => emit('running-change', v))

// Rebuild spectrograms from full WAV PCM once processing completes
watch(() => ws.inputPcmFull.value,  (v) => { if (v?.pcm) spectInRef.value?.rebuildFromPcm(v.pcm) })
watch(() => ws.outputPcmFull.value, (v) => { if (v?.pcm) spectOutRef.value?.rebuildFromPcm(v.pcm) })
const fileInfo     = ref(null)
const uploadedPath = ref(null)
const uploadError  = ref(null)

// Zoom controls
const spectZoomLevels = [400, 200, 100, 50]    // maxCols: more = zoomed out (more history)
const spectZoomIdx    = ref(1)                 // default 200
const waveZoomLevels  = [1, 2, 4, 8]           // amplitude multiplier
const waveZoomIdx     = ref(0)                 // default 1×

// Canvas refs for save
const spectInRef  = ref(null)
const spectOutRef = ref(null)
const waveInRef   = ref(null)
const waveOutRef  = ref(null)

const canSave = computed(() => !ws.running.value && !saving.value && (ws.inputPcm.value !== null || ws.chunkTimings.value.length > 0))
const saving  = ref(false)

function renderWaveformToCanvas(pcmData, color, bgColor, width, height, yZoom) {
  const off = document.createElement('canvas')
  off.width = width; off.height = height
  const ctx = off.getContext('2d')
  const pcm = pcmData.pcm
  const midY = height / 2

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  ctx.beginPath()
  ctx.fillStyle = `rgba(${r},${g},${b},0.18)`
  ctx.moveTo(0, midY)
  for (let x = 0; x <= width; x++) {
    const idx = Math.floor(x * pcm.length / width)
    const val = Math.max(-midY, Math.min(midY, (pcm[Math.min(idx, pcm.length - 1)] / 32768) * yZoom * midY * 0.9))
    ctx.lineTo(x, midY - val)
  }
  ctx.lineTo(width, midY)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  for (let x = 0; x <= width; x++) {
    const idx = Math.floor(x * pcm.length / width)
    const val = Math.max(-midY, Math.min(midY, (pcm[Math.min(idx, pcm.length - 1)] / 32768) * yZoom * midY * 0.9))
    x === 0 ? ctx.moveTo(x, midY - val) : ctx.lineTo(x, midY - val)
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.strokeStyle = `rgba(${r},${g},${b},0.25)`
  ctx.lineWidth = 0.5
  ctx.moveTo(0, midY); ctx.lineTo(width, midY)
  ctx.stroke()
  return off
}

const features = [
  'Noise reduction on C7x DSP',
  'TIDL-accelerated speech enhancement',
  'Low latency real-time processing',
  'Background noise suppression',
  'Improved speech intelligibility',
]
const tags = ['Noise Reduction', 'TIDL', 'C7x DSP']

onMounted(async () => {
  try {
    const r = await fetch('/speech-enhancement/info')
    if (r.ok) fileInfo.value = await r.json()
  } catch { /* board not connected */ }
})

onUnmounted(() => { clearTimeout(_tvmPollTimer); _tvmPollTimer = null })

const dotClass = computed(() => ({
  'dot-running': ws.running.value,
  'dot-error':   ws.statusColor.value === 'error',
  'dot-success': ws.statusColor.value === 'success' && !ws.running.value,
  'dot-idle':    !ws.running.value && ws.statusColor.value !== 'error' && ws.statusColor.value !== 'success',
}))

function barStyle(i) {
  const delays = [0, 100, 200, 300, 150]
  return { animationDelay: `${delays[i - 1]}ms` }
}

function useDefault() {
  uploadedPath.value = null
  uploadError.value  = null
  if (fileInfo.value) fileInfo.value = { ...fileInfo.value }
}

async function saveArtifacts() {
  saving.value = true
  try {
    const now = new Date()
    const ts  = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
    const zip = new JSZip()

    // ── Composite visualization PNGs ─────────────────────────────────────
    const decodeWav = async (url) => {
      try {
        const resp = await fetch(url)
        if (!resp.ok) return null
        const buf  = await resp.arrayBuffer()
        const view = new DataView(buf)
        let offset = 12
        while (offset + 8 <= buf.byteLength) {
          const id  = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3))
          const len = view.getUint32(offset + 4, true)
          if (id === 'data') return new Int16Array(buf, offset + 8, len / 2)
          offset += 8 + len + (len & 1)
        }
      } catch { /* fall back to streamed */ }
      return null
    }

    // Decode WAVs before capturing canvases so rebuildFromPcm renders the full audio first
    const [inPcmRaw, outPcmRaw] = ws.downloadUrls.value
      ? await Promise.all([decodeWav(ws.downloadUrls.value.inputUrl), decodeWav(ws.downloadUrls.value.outputUrl)])
      : [null, null]
    if (inPcmRaw)  spectInRef.value?.rebuildFromPcm(inPcmRaw)
    if (outPcmRaw) spectOutRef.value?.rebuildFromPcm(outPcmRaw)

    const spectIn  = spectInRef.value?.getCanvas()
    const spectOut = spectOutRef.value?.getCanvas()
    const saveW = waveInRef.value?.getCanvas()?.offsetWidth || 800
    const saveH = waveInRef.value?.getCanvas()?.height || 130

    const inPcm  = inPcmRaw  ? { pcm: inPcmRaw }  : ws.inputPcm.value
    const outPcm = outPcmRaw ? { pcm: outPcmRaw } : ws.outputPcm.value
    const waveIn  = inPcm  ? renderWaveformToCanvas(inPcm,  inputColor.value,  canvasBg.value, saveW, saveH, waveZoomLevels[waveZoomIdx.value]) : null
    const waveOut = outPcm ? renderWaveformToCanvas(outPcm, outputColor.value, canvasBg.value, saveW, saveH, waveZoomLevels[waveZoomIdx.value]) : null

    const canvasToBlob = (canvas1, label1, color1, canvas2, label2, color2, suffix, canvasH) => {
      if (!canvas1 && !canvas2) return Promise.resolve(null)
      const PAD = 16, LABEL_H = 20, HEADER_H = 36
      const W = canvas1?.width || canvas2?.width || 800
      const H = HEADER_H + PAD + (LABEL_H + canvasH + PAD) * 2
      const off = document.createElement('canvas')
      off.width = W; off.height = H
      const ctx = off.getContext('2d')
      ctx.fillStyle = '#0a0f1e'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(29,111,232,0.12)'
      ctx.fillRect(0, 0, W, HEADER_H)
      ctx.fillStyle = '#e2e8f0'
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.fillText(`Speech Enhancement — ${suffix}  —  ${ts.replace(/_/, '  ').replace(/-/g, (m, o) => o > 10 ? ':' : '-')}`, PAD, HEADER_H / 2 + 5)
      const lbl = (text, y, color) => {
        ctx.font = 'bold 12px system-ui, sans-serif'
        ctx.fillStyle = color
        ctx.fillText(text, PAD, y)
      }
      let y = HEADER_H + PAD
      lbl(label1, y + LABEL_H - 4, color1); y += LABEL_H
      if (canvas1) ctx.drawImage(canvas1, 0, y, W, canvasH)
      y += canvasH + PAD
      lbl(label2, y + LABEL_H - 4, color2); y += LABEL_H
      if (canvas2) ctx.drawImage(canvas2, 0, y, W, canvasH)
      return new Promise(resolve => off.toBlob(resolve, 'image/png'))
    }

    const [spectBlob, waveBlob] = await Promise.all([
      canvasToBlob(spectIn, 'Input (Noisy)', '#4da6ff', spectOut, 'Output (Enhanced)', '#22c55e', 'Spectrogram', spectIn?.height || 220),
      canvasToBlob(waveIn,  'Input (Noisy)', '#4da6ff', waveOut,  'Output (Enhanced)', '#22c55e', 'Waveform',    waveIn?.height  || 130),
    ])
    if (spectBlob) zip.file('spectrogram.png', spectBlob)
    if (waveBlob)  zip.file('waveform.png',    waveBlob)

    // ── Processing times CSV ──────────────────────────────────────────────
    if (ws.chunkTimings.value.length > 0) {
      const header = 'Frames,STFT (ms),GCRN (ms),ISTFT (ms),Total (ms)'
      const lines  = ws.chunkTimings.value.map(r =>
        `${r.frameStart}-${r.frameEnd},${r.stft.toFixed(3)},${r.tvm.toFixed(3)},${r.istft.toFixed(3)},${r.totalMs.toFixed(3)}`
      )
      zip.file('timings.csv', [header, ...lines].join('\n'))
    }

    // ── Audio WAV files ───────────────────────────────────────────────────
    if (ws.downloadUrls.value) {
      await Promise.all(
        [['input', ws.downloadUrls.value.inputUrl], ['output', ws.downloadUrls.value.outputUrl]].map(async ([ch, url]) => {
          try {
            const resp = await fetch(url)
            if (resp.ok) zip.file(`${ch}.wav`, await resp.blob(), { binary: true })
          } catch { /* skip if unavailable */ }
        })
      )
    }

    // ── Generate and trigger ZIP download ─────────────────────────────────
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    const a = document.createElement('a')
    a.download = `speech-enhancement_${ts}.zip`
    a.href = URL.createObjectURL(zipBlob)
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  } finally {
    saving.value = false
  }
}

async function run()  { await ws.start(uploadedPath.value || null) }
async function stop() { await ws.stop() }

defineExpose({ run, stop, isRunning: ws.running, isModelLoading: ws.modelLoading })
</script>

<style scoped>
.speech-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow-y: auto;
}

.ti-card {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
  border-radius: 12px !important;
  padding: 14px !important;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

/* Expansion panels */
.ti-expansion {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
  border-radius: 12px !important;
}
.exp-title {
  font-size: 12.5px;
  font-weight: 700;
  min-height: 48px !important;
}

.card-ttl      { font-size: 12.5px; font-weight: 700; color: rgb(var(--v-theme-on-surface)); }
.card-ttl-row  { display:flex; align-items:center; justify-content:space-between; }
.desc-text { font-size: 13px; color: #94a3b8; line-height: 1.65; margin-bottom: 10px; }

/* Signal flow image */
.flow-img { width: 100%; border-radius: 8px; border: 1px solid rgba(var(--v-border-color),var(--v-border-opacity)); display: block; }

/* Features */
.feat-list { list-style:none; display:flex; flex-direction:column; gap:4px; }
.feat-list li { display:flex; align-items:flex-start; gap:6px; font-size:12px; color:#94a3b8; }

/* Tags */
.tags { display:flex; flex-wrap:wrap; gap:6px; }

/* Model */
.model-row { display:flex; justify-content:space-between; font-size:12px; }
.model-lbl { color:#64748b; }
.model-val { color:#94a3b8; font-weight:600; }

/* File card */
.file-card       { display:flex; align-items:flex-start; gap:10px; background:rgb(var(--v-theme-surface-variant)); border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); border-radius:8px; padding:10px; }
.file-card-icon  { width:36px; height:36px; border-radius:8px; background:rgba(77,166,255,0.1); border:1px solid rgba(77,166,255,0.3); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.file-card-info  { min-width:0; flex:1; }
.file-card-name  { font-size:13px; font-weight:600; color:rgb(var(--v-theme-on-surface)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.file-card-meta  { font-size:11px; color:#64748b; margin-top:2px; }
.gap-2 { gap:8px; }

/* Status */
.status-row      { display:flex; align-items:center; gap:10px; }
.status-dot-wrap { display:flex; align-items:center; gap:6px; }
.status-dot      { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.dot-running { background:#4da6ff; box-shadow:0 0 8px #4da6ff; animation: pulse 1.2s infinite; }
.dot-success { background:#22c55e; box-shadow:0 0 8px #22c55e; }
.dot-error   { background:#ef4444; box-shadow:0 0 8px #ef4444; }
.dot-idle    { background:#475569; }
.status-lbl  { font-size:13px; }

.status-bars { display:none; align-items:flex-end; gap:2px; height:16px; }
.status-bars.active { display:inline-flex; }
.status-bars span {
  display:inline-block; width:3px; border-radius:1px; height:3px;
  background:#4da6ff;
  animation: bar-rise 0.7s ease-in-out infinite;
}
@keyframes bar-rise { 0%,100%{height:3px} 50%{height:14px} }
@keyframes pulse    { 0%,100%{opacity:1}  50%{opacity:0.5} }

/* Visualization */
.viz-section-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.viz-section-lbl { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:1px; }
.zoom-controls   { display:flex; align-items:center; gap:4px; }
.zoom-label      { font-size:10px; color:#94a3b8; min-width:32px; text-align:center; }
.viz-stack       { display:flex; flex-direction:column; gap:10px; }
.viz-row         { display:flex; flex-direction:column; gap:4px; }
.viz-ch-label    { font-size:12px; font-weight:700; margin-bottom:2px; }

/* Model loading alert */
.model-loading-alert { flex-shrink: 0; }
.model-loading-txt   { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.preparing-spinner   { display: inline-block; animation: spin 1.2s linear infinite; font-size: 16px; line-height: 1; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Playback */
.playback-row { display:flex; flex-direction:column; gap:6px; }
</style>
