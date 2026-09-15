import { ref, shallowRef, onUnmounted } from 'vue'

export function useSpeechWs() {
  const connected    = ref(false)
  const running      = ref(false)
  const statusMsg    = ref('Idle')
  const statusColor  = ref('secondary')
  const error        = ref(null)
  const chunkTimings   = ref([])         // [{ chunk, total, frameStart, frameEnd, stft, tvm, istft, totalMs }]
  const runKey         = ref(0)          // increments on each new run — canvases watch this to clear history
  const modelLoading   = ref(false)      // true while TVM is initialising (before first spectrum frame)
  const modelName      = ref('')         // model name received in model_loading message
  const inputPcmFrame  = shallowRef(null)  // latest frame → spectrogram FFT
  const outputPcmFrame = shallowRef(null)
  const inputPcm       = shallowRef(null)  // accumulated signal → waveform
  const outputPcm      = shallowRef(null)
  const inputPcmFull   = shallowRef(null)  // full WAV PCM after completion → spectrogram rebuild
  const outputPcmFull  = shallowRef(null)
  const inputBuffer    = []              // accumulate all input frames for continuous waveform
  const outputBuffer   = []             // accumulate all output frames
  const downloadUrls = ref(null)
  const metrics      = ref([])
  const MAX_BUFFER_SAMPLES = 16000 * 30  // 30 seconds at 16 kHz

  let ws = null

  function connect() {
    if (ws) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/speech`)
    ws.onopen  = () => { connected.value = true }
    ws.onclose = () => { connected.value = false; ws = null }
    ws.onerror = () => { connected.value = false }
    ws.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      dispatch(msg)
    }
  }

  function dispatch(msg) {
    switch (msg.type) {
      case 'model_loading':
        modelLoading.value = true
        modelName.value    = msg.modelName || ''
        statusMsg.value    = `Loading ${msg.modelName || 'model'}…`
        statusColor.value  = 'primary'
        break
      case 'spectrum':
        handleSpectrum(msg)
        modelLoading.value = false
        break
      case 'chunk_timing':
        if (modelLoading.value) {
          modelLoading.value = false
          statusMsg.value   = 'Running Speech Enhancement'
          statusColor.value = 'primary'
        }
        chunkTimings.value = [...chunkTimings.value, {
          chunk: msg.chunk, total: msg.total,
          frameStart: msg.frameStart ?? null, frameEnd: msg.frameEnd ?? null,
          stft: msg.stft, tvm: msg.tvm, istft: msg.istft, totalMs: msg.totalMs,
        }]
        break
      case 'metric':
        metrics.value = [...metrics.value, msg.label]
        statusMsg.value = msg.label
        statusColor.value = 'primary'
        break
      case 'error':
        modelLoading.value = false
        error.value = msg.message
        statusMsg.value = msg.message
        statusColor.value = 'error'
        running.value = false
        break
      case 'spectrum_done':
        running.value = false
        statusMsg.value = 'Complete'
        statusColor.value = 'success'
        downloadUrls.value = { inputUrl: msg.inputUrl, outputUrl: msg.outputUrl }
        fetchAndRebuild(msg.inputUrl, msg.outputUrl)
        break
      default:
        if (msg.status === 'connected') {
          statusMsg.value = 'Ready'
          statusColor.value = 'secondary'
        }
    }
  }

  function handleSpectrum(msg) {
    const binary = atob(msg.pcm)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const int16  = new Int16Array(bytes.buffer)

    // For waveform: accumulate all frames; for spectrogram: show latest frame only
    if (msg.channel === 'input') {
      inputPcmFrame.value = { pcm: int16, sampleRate: msg.sampleRate }
      inputBuffer.push(...int16)
      if (inputBuffer.length > MAX_BUFFER_SAMPLES) {
        inputBuffer.splice(0, inputBuffer.length - MAX_BUFFER_SAMPLES)
      }
      inputPcm.value = { pcm: new Int16Array(inputBuffer), sampleRate: msg.sampleRate }
    } else {
      outputPcmFrame.value = { pcm: int16, sampleRate: msg.sampleRate }
      outputBuffer.push(...int16)
      if (outputBuffer.length > MAX_BUFFER_SAMPLES) {
        outputBuffer.splice(0, outputBuffer.length - MAX_BUFFER_SAMPLES)
      }
      outputPcm.value = { pcm: new Int16Array(outputBuffer), sampleRate: msg.sampleRate }
    }
  }

  async function fetchAndRebuild(inputUrl, outputUrl) {
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
      } catch { /* ignore */ }
      return null
    }
    const [inPcm, outPcm] = await Promise.all([decodeWav(inputUrl), decodeWav(outputUrl)])
    if (inPcm) {
      inputPcm.value     = { pcm: inPcm,  sampleRate: 16000 }
      inputPcmFull.value = { pcm: inPcm,  sampleRate: 16000 }
    }
    if (outPcm) {
      outputPcm.value     = { pcm: outPcm, sampleRate: 16000 }
      outputPcmFull.value = { pcm: outPcm, sampleRate: 16000 }
    }
  }

  function reset() {
    runKey.value++
    chunkTimings.value   = []
    metrics.value        = []
    error.value          = null
    downloadUrls.value   = null
    modelLoading.value   = false
    modelName.value      = ''
    inputPcmFrame.value  = null
    outputPcmFrame.value = null
    inputPcm.value       = null
    outputPcm.value      = null
    inputPcmFull.value   = null
    outputPcmFull.value  = null
    inputBuffer.length   = 0
    outputBuffer.length  = 0
    statusMsg.value      = 'Starting…'
    statusColor.value    = 'primary'
    running.value        = true
  }

  async function start(filePath) {
    reset()
    const url = filePath ? `/start-speech-enhancement?file=${encodeURIComponent(filePath)}` : '/start-speech-enhancement'
    const r = await fetch(url)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      modelLoading.value = false
      error.value = d.error || `HTTP ${r.status}`
      running.value = false
      statusMsg.value = error.value
      statusColor.value = 'error'
    }
  }

  async function stop() {
    await fetch('/stop-speech-enhancement')
    running.value = false
    statusMsg.value = 'Stopped'
    statusColor.value = 'secondary'
  }

  onUnmounted(() => { if (ws) ws.close() })
  connect()

  return { connected, running, statusMsg, statusColor, error, chunkTimings, runKey, modelLoading, modelName, inputPcmFrame, outputPcmFrame, inputPcm, outputPcm, inputPcmFull, outputPcmFull, downloadUrls, metrics, start, stop }
}
