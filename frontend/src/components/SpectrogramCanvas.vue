<template>
  <div>
    <canvas
      ref="canvasEl"
      :height="height + 60"
      style="width: 100%; display: block"
      @pointermove="hover"
      @pointerleave="leave"
    />
    <div style="font-size: 11px; min-height: 18px">
      {{ readout || 'Hover: time · frequency · spectral level' }}
    </div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { PcmWindows, computeMagnitudes } from '../utils/speechVisualization.js'
import {
  viridis,
  plotRect,
  timeAt,
  axes,
  cursorLine,
} from '../utils/plotAxes.js'
const props = defineProps({
  pcmFrame: Object,
  colorMap: String,
  bgColor: { default: '#05080f' },
  height: { default: 220 },
  runKey: Number,
  floorDb: { default: -80 },
  maxCols: { default: 200 },
  scaleMode: { default: 'shared' },
  cursorTime: { default: null },
})
const emit = defineEmits(['cursor'])
const canvasEl = ref(null),
  readout = ref(''),
  windows = new PcmWindows(256)
let history = [],
  sampleRate = 16000,
  totalSamples = 0,
  nextStart = 0,
  full = false,
  observer,
  layout,
  limits,
  peakDb = 0
const db = (mag) => (mag > 0 ? 20 * Math.log10(mag / 256) : -Infinity)
function append(pcm, final = false) {
  totalSamples += pcm.length
  for (const frame of windows.push(pcm, final)) {
    history.push({ start: nextStart, mags: computeMagnitudes(frame, 513) })
    nextStart += 256
  }
  if (!full && history.length > props.maxCols)
    history.splice(0, history.length - props.maxCols)
}
function reset() {
  history = []
  totalSamples = 0
  nextStart = 0
  full = false
  windows.reset()
  readout.value = ''
  render()
}
watch(() => props.runKey, reset)
watch(
  () => props.pcmFrame,
  (frame) => {
    if (!frame?.pcm) return
    sampleRate = frame.sampleRate || 16000
    append(frame.pcm)
    render()
  },
)
watch(
  () => props.maxCols,
  () => {
    full = false
    if (history.length > props.maxCols)
      history.splice(0, history.length - props.maxCols)
    render()
  },
)
watch(
  () => [props.bgColor, props.floorDb, props.scaleMode, props.cursorTime],
  render,
)
onMounted(() => {
  observer = new ResizeObserver(render)
  observer.observe(canvasEl.value)
  render()
})
onUnmounted(() => observer?.disconnect())
defineExpose({
  getCanvas: () => canvasEl.value,
  rebuildFromPcm(pcm, rate = 16000) {
    history = []
    windows.reset()
    totalSamples = 0
    nextStart = 0
    sampleRate = rate
    full = true
    append(pcm, true)
    render()
  },
})
function render() {
  const c = canvasEl.value
  if (!c) return
  const w = Math.max(260, c.offsetWidth || c.width),
    h = props.height + 60
  if (c.width !== w) c.width = w
  const ctx = c.getContext('2d')
  ctx.fillStyle = props.bgColor
  ctx.fillRect(0, 0, w, h)
  const rect = plotRect(w, h, true)
  layout = rect
  const start = (history[0]?.start || 0) / sampleRate
  const end = history.length
    ? (full ? totalSamples : history.at(-1).start + 1024) / sampleRate
    : start
  limits = { start, end }
  peakDb = 0
  if (props.scaleMode === 'relative') {
    let peak = 0
    for (const col of history)
      for (const mag of col.mags) peak = Math.max(peak, mag)
    peakDb = peak > 0 ? db(peak) : 0
  }
  const img = ctx.createImageData(rect.w, rect.h)
  for (let y = 0; y < rect.h; y++)
    for (let x = 0; x < rect.w; x++) {
      const time = start + ((x + 0.5) / rect.w) * (end - start)
      const col =
        history[
          Math.min(
            history.length - 1,
            Math.floor((time * sampleRate - (history[0]?.start || 0)) / 256),
          )
        ]
      const bin = Math.round((1 - y / Math.max(1, rect.h - 1)) * 512)
      const level = col ? db(col.mags[bin]) - peakDb : -Infinity
      const norm = Math.max(
        0,
        Math.min(1, (level - props.floorDb) / -props.floorDb),
      )
      const rgb = viridis[Math.round(norm * 255)],
        i = (y * rect.w + x) * 4
      img.data[i] = rgb[0]
      img.data[i + 1] = rgb[1]
      img.data[i + 2] = rgb[2]
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, rect.x, rect.y)
  axes(
    ctx,
    rect,
    start,
    end,
    0,
    sampleRate / 2,
    'Frequency (Hz)',
    props.bgColor,
  )
  const bx = rect.x + rect.w + 12
  for (let y = 0; y < rect.h; y++) {
    const rgb = viridis[Math.round((1 - y / Math.max(1, rect.h - 1)) * 255)]
    ctx.fillStyle = `rgb(${rgb})`
    ctx.fillRect(bx, rect.y + y, 12, 1)
  }
  ctx.fillStyle = ['#e8eef6', '#f1f5f9'].includes(props.bgColor)
    ? '#334155'
    : '#cbd5e1'
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'left'
  for (let i = 0; i <= 4; i++)
    ctx.fillText(
      ((props.floorDb * i) / 4).toFixed(0),
      bx + 16,
      rect.y + (i * rect.h) / 4 + 4,
    )
  ctx.textAlign = 'center'
  ctx.fillText(
    props.scaleMode === 'relative' ? 'dB / peak' : 'dB / ref',
    bx + 16,
    rect.y + rect.h + 20,
  )
  cursorLine(ctx, rect, props.cursorTime, start, end)
}
function hover(e) {
  if (!layout || !history.length) return
  const box = canvasEl.value.getBoundingClientRect(),
    x = ((e.clientX - box.left) * canvasEl.value.width) / box.width,
    y = e.clientY - box.top
  if (
    x < layout.x ||
    x > layout.x + layout.w ||
    y < layout.y ||
    y > layout.y + layout.h
  ) {
    leave()
    return
  }
  const time = timeAt(x, layout, limits.start, limits.end),
    bin = Math.max(
      0,
      Math.min(512, Math.round((1 - (y - layout.y) / layout.h) * 512)),
    )
  const col =
    history[
      Math.min(
        history.length - 1,
        Math.floor((time * sampleRate - history[0].start) / 256),
      )
    ]
  const level = db(col.mags[bin]) - peakDb
  readout.value = `${time.toFixed(3)} s · ${((bin * sampleRate) / 1024).toFixed(1)} Hz · ${Number.isFinite(level) ? level.toFixed(1) : '−∞'} dB ${props.scaleMode === 'relative' ? 'relative to plot peak' : 'relative to fixed FFT reference'}`
  emit('cursor', time)
}
function leave() {
  readout.value = ''
  emit('cursor', null)
}
</script>
