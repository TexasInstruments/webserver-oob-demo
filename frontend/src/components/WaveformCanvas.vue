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
      {{ readout || 'Hover: time · sample amplitude' }}
    </div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { drawWavePlot, timeAt } from '../utils/plotAxes.js'
const props = defineProps({
  pcmFrame: Object,
  color: { default: '#4da6ff' },
  bgColor: { default: '#05080f' },
  height: { default: 130 },
  runKey: Number,
  yZoom: { default: 1 },
  cursorTime: { default: null },
})
const emit = defineEmits(['cursor']),
  canvasEl = ref(null),
  readout = ref('')
let observer, rect
function draw() {
  const c = canvasEl.value
  if (!c) return
  const w = Math.max(260, c.offsetWidth || c.width)
  if (c.width !== w) c.width = w
  const f = props.pcmFrame
  rect = drawWavePlot(
    c.getContext('2d'),
    f?.pcm || new Int16Array(0),
    w,
    props.height + 60,
    props.color,
    props.bgColor,
    props.yZoom,
    f?.sampleRate || 16000,
    f?.startSample || 0,
    props.cursorTime,
  )
}
watch(
  () => [
    props.pcmFrame,
    props.runKey,
    props.color,
    props.bgColor,
    props.yZoom,
    props.cursorTime,
  ],
  draw,
)
onMounted(() => {
  observer = new ResizeObserver(draw)
  observer.observe(canvasEl.value)
  draw()
})
onUnmounted(() => observer?.disconnect())
defineExpose({ getCanvas: () => canvasEl.value })
function hover(e) {
  const f = props.pcmFrame
  if (!f?.pcm?.length || !rect) return
  const box = canvasEl.value.getBoundingClientRect()
  const x = ((e.clientX - box.left) * canvasEl.value.width) / box.width
  if (x < rect.x || x > rect.x + rect.w) {
    leave()
    return
  }
  const rate = f.sampleRate || 16000,
    start = (f.startSample || 0) / rate,
    time = timeAt(x, rect, start, start + f.pcm.length / rate)
  const i = Math.min(
      f.pcm.length - 1,
      Math.max(0, Math.floor((time - start) * rate)),
    ),
    sample = f.pcm[i]
  readout.value = `${time.toFixed(3)} s · ${(sample / 32768).toFixed(5)} amplitude · PCM ${sample}`
  emit('cursor', time)
}
function leave() {
  readout.value = ''
  emit('cursor', null)
}
</script>
