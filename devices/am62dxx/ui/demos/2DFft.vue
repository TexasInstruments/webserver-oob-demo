<template>
  <div style="display:contents">

    <!-- Controls card -->
    <div class="card ctrl-card">
      <div class="card-ttl">Demo Description</div>
      <p class="desc-text">Offloads 128×128×2 test data for 2D FFT processing to C7x DSP via RPMsg-DMA, then compares output against reference data to verify correctness.</p>
      <hr class="card-div">
      <div class="status-row">
        <span class="status-dot" :style="{ background: fft2d.statusColor, animation: fft2d.statusPulse ? 'pulse 2s infinite' : 'none' }"/>
        <span style="font-size:12px" :style="{ color: fft2d.statusColor }">{{ fft2d.statusMsg }}</span>
      </div>
      <div class="sub-ttl">Execution Info</div>
      <div class="metrics-grid">
        <div class="metric-tile">
          <div class="mt-lbl">Result</div>
          <div class="mt-val" :style="{ color: fft2d.resultColor }">{{ fft2d.result }}</div>
        </div>
        <div class="metric-tile">
          <div class="mt-lbl">Elapsed</div>
          <div class="mt-val" style="color:#22d3ee">{{ fft2d.elapsed }}</div>
        </div>
      </div>
      <hr class="card-div">
      <div class="sub-ttl">Features</div>
      <ul class="feat-list">
        <li v-for="f in fft2dFeatures" :key="f"><span style="color:#22d3ee">✓</span> {{ f }}</li>
      </ul>
      <div v-if="conflictActive" class="conflict-banner">
        <div class="banner-hdr"><v-icon size="15" color="error">mdi-alert-triangle</v-icon><span style="font-size:12px;font-weight:700;color:#fca5a5">Biquad Overlay Conflict</span></div>
        <p class="banner-body">The DSP audio overlay (<code>k3-am62d2-evm-dsp-controlled-audio.dtbo</code>) is active. Remove it to run this demo.</p>
        <button class="rem-btn" @click="removeAndReboot"><v-icon size="12">mdi-close</v-icon> Remove Overlay &amp; Reboot</button>
      </div>
    </div>

    <!-- Visualization card -->
    <div class="card viz-card">
      <div class="card-ttl">Live Visualization</div>
      <div class="fft-header">
        <div style="font-size:10.5px;color:#475569;font-family:monospace;margin-bottom:6px">RPMsg based 2D FFT Offload Example</div>
        <div style="display:flex;align-items:center;gap:10px">
          <span :style="{ fontSize:'14px', fontWeight:700, color: fft2d.badgeColor }">{{ fft2d.badge }}</span>
          <span style="flex:1"/>
          <span style="font-size:11px;color:#475569">Elapsed:</span>
          <span style="font-size:13px;font-weight:700;color:#22d3ee">{{ fft2d.elapsed }}</span>
        </div>
      </div>
      <div class="fft-metrics">
        <div class="metric-tile">
          <div class="mt-lbl">C7x Load</div>
          <div class="mt-val" style="color:#3b82f6">{{ fft2d.load }}</div>
          <div class="mt-stats"><span>Min <span class="sv">{{ fft2d.loadMin }}</span></span><span class="sep">|</span><span>Avg <span class="sv">{{ fft2d.loadAvg }}</span></span><span class="sep">|</span><span>Max <span class="sv">{{ fft2d.loadMax }}</span></span></div>
        </div>
        <div class="metric-tile">
          <div class="mt-lbl">Cycle Count</div>
          <div class="mt-val">{{ fft2d.cycles }}</div>
        </div>
        <div class="metric-tile">
          <div class="mt-lbl">DDR Throughput</div>
          <div class="mt-val" style="color:#22d3ee">{{ fft2d.ddr }}</div>
          <div class="mt-stats"><span>Min <span class="sv">{{ fft2d.ddrMin }}</span></span><span class="sep">|</span><span>Avg <span class="sv">{{ fft2d.ddrAvg }}</span></span><span class="sep">|</span><span>Max <span class="sv">{{ fft2d.ddrMax }}</span></span></div>
        </div>
      </div>
      <hr class="card-div">
      <div class="canvas-lbl">Console Output</div>
      <div ref="fft2dLogEl" class="log-box" style="height:300px"/>
    </div>

    <!-- Reboot overlay -->
    <div v-if="rebootMsg" class="reboot-overlay">
      <div class="reboot-box">
        <v-icon size="28" color="warning">mdi-refresh</v-icon>
        <div class="reboot-title">Board Rebooting</div>
        <div class="reboot-msg">{{ rebootMsg }}</div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['running-change'])

const fft2dFeatures = ['128×128×2 offload on C7x DSP','RPMsg-DMA zero-copy data transfer','Pass/fail vs. reference output','2D FFT magnitude heatmap']

const fft2d = reactive({
  running: false,
  statusMsg: 'Not running', statusColor: '#64748b', statusPulse: false,
  result: '--', resultColor: '#e2e8f0',
  elapsed: '-- ms',
  badge: 'Idle', badgeColor: '#64748b',
  load: '--%',  loadMin: '--', loadAvg: '--', loadMax: '--',
  cycles: '--',
  ddr: '-- MB/s', ddrMin: '--', ddrAvg: '--', ddrMax: '--',
})
let fft2dWs = null
let fft2dStats = { load: null, ddr: null }
const fft2dLogEl = ref(null)
const conflictActive = ref(false)
const rebootMsg      = ref('')

function _accum(s, v) {
  if (v == null || isNaN(v)) return s
  if (!s) return { min: v, max: v, sum: v, n: 1 }
  return { min: Math.min(s.min, v), max: Math.max(s.max, v), sum: s.sum + v, n: s.n + 1 }
}

function appendLog(box, text, color) {
  if (!box) return
  const div = document.createElement('div')
  div.style.cssText = 'padding:1px 0;word-break:break-all;'
  div.style.color = color
  div.textContent = text.replace(/\n$/, '')
  box.appendChild(div)
  box.scrollTop = box.scrollHeight
}

function checkConflictOverlay() {
  fetch('/sigchain-biquad/check-overlay', { signal: AbortSignal.timeout(5000) })
    .then(r => r.json())
    .then(d => { if (d) conflictActive.value = !!d.active })
    .catch(() => {})
}

function run() {
  if (conflictActive.value) { checkConflictOverlay(); return }
  fft2d.running = true
  emit('running-change', true)
  fft2d.statusMsg = 'Starting rpmsg_2dfft_example…'; fft2d.statusColor = '#f59e0b'; fft2d.statusPulse = true
  fft2d.result='--'; fft2d.resultColor='#e2e8f0'; fft2d.elapsed='-- ms'
  fft2d.badge='Running…'; fft2d.badgeColor='#f59e0b'
  fft2d.load='--%'; fft2d.cycles='--'; fft2d.ddr='-- MB/s'
  if (fft2dLogEl.value) fft2dLogEl.value.innerHTML = ''
  fetch('/2dfft/run')
    .then(r => r.ok ? r : r.text().then(t => { let m = t; try { m = JSON.parse(t).error || t } catch (_) {} throw new Error(m || 'HTTP ' + r.status) }))
    .then(() => connectFft2dWs())
    .catch(err => { fft2d.statusMsg = 'Error: ' + err.message; fft2d.statusColor = '#ef4444'; fft2d.statusPulse = false; fft2d.running = false; emit('running-change', false) })
}

function stop() {
  fetch('/2dfft/stop').catch(() => {})
  fft2d.running = false
  emit('running-change', false)
  if (fft2dWs) { try { fft2dWs.close() } catch (_) {} fft2dWs = null }
  fft2d.statusMsg = 'Stopped'; fft2d.statusColor = '#64748b'; fft2d.statusPulse = false
}

function connectFft2dWs() {
  if (fft2dWs && (fft2dWs.readyState === 0 || fft2dWs.readyState === 1)) return
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  fft2dWs = new WebSocket(`${proto}//${location.host}/2dfft`)
  fft2dWs.onmessage = e => {
    try {
      const d = JSON.parse(e.data)
      if (d.type === 'status') {
        const c = d.state==='running' ? '#f59e0b' : d.state==='stopped' ? '#22c55e' : '#64748b'
        fft2d.statusMsg = d.message; fft2d.statusColor = c; fft2d.statusPulse = d.state === 'running'
      } else if (d.type === 'log') {
        appendLog(fft2dLogEl.value, d.text, /error|fail/i.test(d.text) ? '#ef4444' : /passed/i.test(d.text) ? '#22c55e' : /^\*+$/.test(d.text.trim()) ? '#1e3a5a' : '#94a3b8')
        parseFft2dMetrics(d.text)
      } else if (d.type === 'result') {
        const pass = d.status === 'PASSED'
        fft2d.result = d.status; fft2d.resultColor = pass ? '#22c55e' : '#ef4444'
        fft2d.badge  = d.status; fft2d.badgeColor  = pass ? '#22c55e' : '#ef4444'
      } else if (d.type === 'done') {
        const pass = d.status === 'PASSED', ms = d.elapsed != null ? d.elapsed + ' ms' : '--'
        fft2d.elapsed = ms
        fft2d.statusMsg = pass ? 'Completed: PASSED' : 'Completed: FAILED'
        fft2d.statusColor = pass ? '#22c55e' : '#ef4444'; fft2d.statusPulse = false
        fft2d.running = false
        emit('running-change', false)
      }
    } catch (err) { console.warn('[fft2d-ws]', err) }
  }
  fft2dWs.onclose = () => { if (fft2d.running) { fft2d.statusMsg = 'Connection lost'; fft2d.statusColor = '#ef4444' } }
  fft2dWs.onerror = () => {}
}

function parseFft2dMetrics(text) {
  let m
  if ((m = text.match(/C7x Load:\s*(\d+)%/i))) {
    const v = parseInt(m[1]); fft2d.load = v + '%'
    fft2dStats.load = _accum(fft2dStats.load, v)
    const s = fft2dStats.load
    if (s) { fft2d.loadMin = s.min.toFixed(0)+'%'; fft2d.loadAvg = (s.sum/s.n).toFixed(0)+'%'; fft2d.loadMax = s.max.toFixed(0)+'%' }
  }
  if ((m = text.match(/C7x Cycle Count:\s*([\d,]+)/i)))
    fft2d.cycles = parseInt(m[1].replace(/,/g,'')).toLocaleString()
  if ((m = text.match(/C7x DDR Throughput:\s*([\d.]+)\s*MB\/s/i))) {
    const v = parseFloat(m[1]); fft2d.ddr = v.toFixed(6) + ' MB/s'
    fft2dStats.ddr = _accum(fft2dStats.ddr, v)
    const s = fft2dStats.ddr
    if (s) { fft2d.ddrMin = s.min.toFixed(3)+' MB/s'; fft2d.ddrAvg = (s.sum/s.n).toFixed(3)+' MB/s'; fft2d.ddrMax = s.max.toFixed(3)+' MB/s' }
  }
}

function removeAndReboot() {
  rebootMsg.value = 'Removing overlay…'
  fetch('/sigchain-biquad/disable-overlay', { method: 'POST' })
    .then(r => r.json())
    .then(d => {
      if (d.success) { rebootMsg.value = 'Board rebooting — page will refresh when device comes back online.'; startRebootWatch() }
      else rebootMsg.value = ''
    })
    .catch(() => { rebootMsg.value = '' })
}

let _rebootWs = null
function startRebootWatch() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  function tryConnect() {
    if (_rebootWs) { try { _rebootWs.close() } catch (_) {} }
    _rebootWs = new WebSocket(`${proto}//${location.host}/health`)
    _rebootWs.onopen  = () => location.reload()
    _rebootWs.onclose = () => setTimeout(tryConnect, 3000)
    _rebootWs.onerror = () => {}
  }
  setTimeout(tryConnect, 3000)
}

onMounted(checkConflictOverlay)

onUnmounted(() => {
  if (fft2d.running)  fetch('/2dfft/stop').catch(() => {})
  if (fft2dWs)  { try { fft2dWs.close()  } catch (_) {} }
  if (_rebootWs){ try { _rebootWs.close()} catch (_) {} }
})

defineExpose({ isRunning: computed(() => fft2d.running), run, stop })
</script>

<style scoped>
.card { background:rgb(var(--v-theme-surface));border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto; }
.ctrl-card { overflow-y:auto; flex-shrink:0; }
.viz-card  { flex-shrink:0; }
.card-ttl  { font-size:13px;font-weight:700;color:rgb(var(--v-theme-on-surface));flex-shrink:0; }
.card-div  { border:none;border-top:1px solid rgba(var(--v-border-color),var(--v-border-opacity));margin:2px 0;flex-shrink:0; }
.desc-text { font-size:13px;color:#94a3b8;line-height:1.65;flex-shrink:0; }
.sub-ttl   { font-size:12.5px;font-weight:700;color:rgb(var(--v-theme-on-surface));flex-shrink:0; }
.status-row{ display:flex;align-items:center;gap:7px;flex-shrink:0; }
.status-dot{ width:8px;height:8px;border-radius:50%;flex-shrink:0; }
.metrics-grid { display:grid;grid-template-columns:1fr 1fr;gap:6px;flex-shrink:0; }
.metric-tile  { background:rgb(var(--v-theme-surface-variant));border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));border-radius:6px;padding:8px 10px; }
.mt-lbl  { font-size:10px;color:#64748b;margin-bottom:3px; }
.mt-val  { font-size:16px;font-weight:700;color:rgb(var(--v-theme-on-surface)); }
.mt-stats{ display:flex;gap:4px;margin-top:4px;font-size:9px;color:#475569;flex-wrap:wrap; }
.sep { color:rgba(var(--v-border-color),var(--v-border-opacity)); }
.sv  { color:#94a3b8; }
.feat-list { list-style:none;display:flex;flex-direction:column;gap:5px;flex-shrink:0; }
.feat-list li { display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#94a3b8; }
.conflict-banner { display:flex;flex-direction:column;gap:8px;padding:12px;background:#120800;border:1px solid #ef4444;border-radius:8px;flex-shrink:0; }
.banner-hdr  { display:flex;align-items:center;gap:8px; }
.banner-body { font-size:11px;color:#94a3b8;line-height:1.6; }
.rem-btn     { padding:8px 12px;background:#dc2626;border:none;color:#fff;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;justify-content:center; }
.rem-btn:hover { background:#b91c1c; }
.fft-header  { padding:10px 14px;background:rgb(var(--v-theme-surface-variant));border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));border-radius:8px;flex-shrink:0; }
.fft-metrics { display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;flex-shrink:0; }
.canvas-lbl  { font-size:11px;color:#64748b; }
.log-box     { font-family:monospace;font-size:11px;background:rgb(var(--v-theme-surface-variant));border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));border-radius:6px;padding:10px;overflow-y:auto;color:#94a3b8;word-break:break-all;line-height:1.5;flex-shrink:0; }
.reboot-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center; }
.reboot-box { background:rgb(var(--v-theme-surface));border:1px solid #d97706;border-radius:12px;padding:32px 40px;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:400px;text-align:center; }
.reboot-title { font-size:18px;font-weight:700;color:rgb(var(--v-theme-on-surface)); }
.reboot-msg   { font-size:13px;color:#94a3b8;line-height:1.6; }
@keyframes pulse { 0%,100%{opacity:0.6}50%{opacity:1} }
</style>
