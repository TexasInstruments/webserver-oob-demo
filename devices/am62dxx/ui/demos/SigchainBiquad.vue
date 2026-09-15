<template>
  <div style="display:contents">

    <!-- Controls card -->
    <div class="card ctrl-card">
      <div class="card-ttl">Demo Description</div>
      <p class="desc-text">Real-time 3-stage parametric equalizer (biquad cascade) on C7x DSP with live C7x load, cycles and throughput monitoring via multi-port TCP server.</p>
      <hr class="card-div">
      <div class="status-row">
        <span class="status-dot" :style="{ background: biquad.statusColor, animation: biquad.statusPulse ? 'pulse 2s infinite' : 'none' }"/>
        <span style="font-size:12px" :style="{ color: biquad.statusColor }">{{ biquad.statusMsg }}</span>
      </div>
      <div v-if="biquadOverlayWarn" class="warn-banner">
        <div class="banner-hdr"><v-icon size="15" color="warning">mdi-alert-triangle</v-icon><span style="font-size:12px;font-weight:700;color:#fbbf24">DSP Audio Overlay Required</span></div>
        <p class="banner-body">This demo requires the DSP-controlled audio overlay in <code>uEnv.txt</code>. Add:</p>
        <code class="overlay-code">name_overlays=ti/k3-am62d2-evm-dsp-controlled-audio.dtbo</code>
        <p style="font-size:11px;color:#64748b;margin-top:2px">File: <code style="color:#94a3b8">/run/media/boot-mmcblk1p1/uEnv.txt</code></p>
        <button class="apply-btn" @click="applyBiquadOverlay"><v-icon size="12">mdi-check</v-icon> Apply Overlay &amp; Reboot</button>
      </div>
      <div v-else-if="biquad.overlayActive" class="overlay-ok">
        <v-icon size="13" color="success">mdi-check-circle</v-icon>
        <span style="font-size:11px;color:#22c55e">DSP audio overlay active</span>
      </div>
      <div class="sub-ttl">Live Metrics</div>
      <div class="metrics-grid">
        <div class="metric-tile">
          <div class="mt-lbl">C7x Load</div>
          <div class="mt-val" style="color:#3b82f6">{{ biquad.load }}</div>
          <div class="mt-stats"><span>Min <span class="sv">{{ biquad.loadMin }}</span></span><span class="sep">|</span><span>Avg <span class="sv">{{ biquad.loadAvg }}</span></span><span class="sep">|</span><span>Max <span class="sv">{{ biquad.loadMax }}</span></span></div>
        </div>
        <div class="metric-tile">
          <div class="mt-lbl">Cycles</div>
          <div class="mt-val">{{ biquad.cycles }}</div>
        </div>
        <div class="metric-tile">
          <div class="mt-lbl">Throughput</div>
          <div class="mt-val" style="color:#22c55e">{{ biquad.tput }}</div>
        </div>
      </div>
      <hr class="card-div">
      <div class="sub-ttl">Features</div>
      <ul class="feat-list">
        <li v-for="f in biquadFeatures" :key="f"><span style="color:#c084fc">✓</span> {{ f }}</li>
      </ul>
    </div>

    <!-- Visualization card -->
    <div class="card viz-card">
      <div class="card-ttl">Live Visualization</div>
      <div class="canvas-wrap">
        <div class="canvas-lbl" style="color:#3b82f6">{{ biquad.loadLbl }}</div>
        <canvas ref="bqLoadCanvas" width="600" height="80" class="viz-canvas"/>
      </div>
      <div class="canvas-wrap">
        <div class="canvas-lbl" style="color:#ef4444">{{ biquad.cyclesLbl }}</div>
        <canvas ref="bqCyclesCanvas" width="600" height="80" class="viz-canvas"/>
      </div>
      <div class="canvas-wrap">
        <div class="canvas-lbl" style="color:#22c55e">{{ biquad.tputLbl }}</div>
        <canvas ref="bqTputCanvas" width="600" height="80" class="viz-canvas"/>
      </div>
      <hr class="card-div">
      <div class="canvas-lbl">Board Logs (Port 8888)</div>
      <div ref="biquadLogEl" class="log-box" style="height:160px"/>
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
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'

const emit = defineEmits(['running-change'])

const theme   = useTheme()
const isLight = computed(() => theme.global.name.value === 'tiLight')
const cvBg     = computed(() => isLight.value ? '#f1f5f9' : '#05080f')
const cvGrid   = computed(() => isLight.value ? '#dde3ec' : '#1a2f4a')
const cvLabel  = computed(() => isLight.value ? '#64748b' : '#3d5068')
const cvAxis   = computed(() => isLight.value ? '#cbd5e1' : '#334155')

const biquadFeatures = ['3-stage cascade biquad EQ on C7x DSP','TAD5212 DAC + PCM6240 ADC support','Live C7x load, cycles, throughput','Multi-port TCP (logs, cmds, stats)']

const biquad = reactive({
  running: false, overlayActive: false,
  statusMsg: 'Not running', statusColor: '#64748b', statusPulse: false,
  load: '--%', loadMin: '--', loadAvg: '--', loadMax: '--',
  cycles: '--',
  tput: '-- MB/s',
  loadLbl: 'C7x DSP Load (%)',
  cyclesLbl: 'DSP Processing Cycles',
  tputLbl: 'Demo Throughput (MB/s)',
})
let biquadWs = null, biquadStats = null
const biquadLogEl = ref(null)
const biquadOverlayWarn = ref(false)
const rebootMsg         = ref('')

const BIQUAD_TS_LEN  = 600
const biquadTsLoad   = new Float32Array(BIQUAD_TS_LEN)
const biquadTsCycles = new Float32Array(BIQUAD_TS_LEN)
const biquadTsTput   = new Float32Array(BIQUAD_TS_LEN)
let biquadTsIdx = 0, biquadTsCount = 0

const bqLoadCanvas    = ref(null), bqCyclesCanvas = ref(null), bqTputCanvas = ref(null)

function _accum(s, v) {
  if (v == null || isNaN(v)) return s
  if (!s) return { min: v, max: v, sum: v, n: 1 }
  return { min: Math.min(s.min, v), max: Math.max(s.max, v), sum: s.sum + v, n: s.n + 1 }
}
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function appendLog(box, text, color) {
  if (!box) return
  const div = document.createElement('div')
  div.style.cssText = 'padding:1px 0;word-break:break-all;'
  div.style.color = color
  div.textContent = text.replace(/\n$/, '')
  box.appendChild(div)
  box.scrollTop = box.scrollHeight
}

function drawTrendLine(canvas, buf, tsIdx, tsCount, TS_LEN, color, unit) {
  if (!canvas || tsCount < 2) return
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,PL=42,PR=6,PT=6,PB=14,PW=W-PL-PR,PH=H-PT-PB
  const n=Math.min(tsCount,TS_LEN),si=tsCount<TS_LEN?0:tsIdx
  let vMin=Infinity,vMax=-Infinity
  for(let i=0;i<n;i++){const v=buf[(si+i)%TS_LEN];if(v<vMin)vMin=v;if(v>vMax)vMax=v;}
  if(vMin===vMax){vMin-=1;vMax+=1;}
  const mg=(vMax-vMin)*0.15||0.5;vMin-=mg;vMax+=mg
  ctx.fillStyle=cvBg.value;ctx.fillRect(0,0,W,H)
  ctx.font='9px monospace';ctx.textAlign='right'
  ;[vMin,(vMin+vMax)/2,vMax].forEach(v=>{const y=PT+(1-(v-vMin)/(vMax-vMin))*PH;ctx.strokeStyle=cvGrid.value;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(PL,y);ctx.lineTo(W-PR,y);ctx.stroke();ctx.fillStyle=cvLabel.value;ctx.fillText(v.toFixed(v<10?2:0)+(unit||''),PL-3,y+3);})
  ctx.strokeStyle=cvAxis.value;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PL,PT);ctx.lineTo(PL,H-PB);ctx.lineTo(W-PR,H-PB);ctx.stroke()
  ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath()
  for(let i=0;i<n;i++){const v=buf[(si+i)%TS_LEN],x=PL+(i/(n-1))*PW,y=PT+(1-_clamp((v-vMin)/(vMax-vMin),0,1))*PH;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
  ctx.stroke()
}

function checkBiquadOverlay() {
  biquad.statusMsg = 'Checking overlay…'; biquad.statusColor = '#64748b'; biquad.statusPulse = false
  fetch('/sigchain-biquad/check-overlay', { signal: AbortSignal.timeout(5000) })
    .then(r => r.json())
    .then(d => {
      if (!d) return
      biquad.overlayActive = !!d.active
      if (d.active) {
        biquadOverlayWarn.value = false
        biquad.statusMsg = 'Ready'; biquad.statusColor = '#22c55e'
      } else {
        biquadOverlayWarn.value = true
        biquad.statusMsg = 'Overlay not set — demo disabled'; biquad.statusColor = '#d97706'
      }
    })
    .catch(() => {
      biquadOverlayWarn.value = false
      biquad.statusMsg = 'Could not read uEnv.txt'; biquad.statusColor = '#ef4444'
    })
}

function run() {
  if (!biquad.overlayActive) { checkBiquadOverlay(); return }
  biquad.running = true
  emit('running-change', true)
  biquadStats = { load: null }
  biquad.loadMin=biquad.loadAvg=biquad.loadMax='--'
  biquad.statusMsg = 'Starting rpmsg_sigchain_biquad_example…'; biquad.statusColor = '#f59e0b'; biquad.statusPulse = true
  biquadTsLoad.fill(0); biquadTsCycles.fill(0); biquadTsTput.fill(0)
  biquadTsIdx = 0; biquadTsCount = 0
  biquad.cycles = '--'; biquad.tput = '-- MB/s'
  if (biquadLogEl.value) biquadLogEl.value.innerHTML = ''
  fetch('/sigchain-biquad/run')
    .then(r => r.ok ? r : r.text().then(t => { let m = t; try { m = JSON.parse(t).error || t } catch (_) {} throw new Error(m || 'HTTP ' + r.status) }))
    .then(() => connectBiquadWs())
    .catch(err => { biquad.statusMsg = 'Error: ' + err.message; biquad.statusColor = '#ef4444'; biquad.statusPulse = false; biquad.running = false; emit('running-change', false) })
}

function stop() {
  fetch('/sigchain-biquad/stop').catch(() => {})
  biquad.running = false
  emit('running-change', false)
  if (biquadWs) { try { biquadWs.close() } catch (_) {} biquadWs = null }
  biquad.statusMsg = 'Stopped'; biquad.statusColor = '#64748b'; biquad.statusPulse = false
}

function connectBiquadWs() {
  if (biquadWs && (biquadWs.readyState === 0 || biquadWs.readyState === 1)) return
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  biquadWs = new WebSocket(`${proto}//${location.host}/sigchain-biquad`)
  biquadWs.onmessage = e => {
    try {
      const d = JSON.parse(e.data)
      if (d.type === 'status') {
        const c = d.state==='connected' ? '#22c55e' : d.state==='connecting' ? '#f59e0b' : d.state==='stopped' ? '#64748b' : '#ef4444'
        biquad.statusMsg = d.message; biquad.statusColor = c; biquad.statusPulse = d.state === 'connecting'
        if (d.state === 'stopped') { biquad.running = false; emit('running-change', false) }
      } else if (d.type === 'log') {
        appendLog(biquadLogEl.value, d.text, /error/i.test(d.text) ? '#ef4444' : /loaded|success|running/i.test(d.text) ? '#22c55e' : /warn/i.test(d.text) ? '#f59e0b' : '#94a3b8')
      } else if (d.type === 'stats') {
        if (d.c7xLoad != null) {
          biquad.load = d.c7xLoad.toFixed(1) + '%'
          if (biquadStats) { biquadStats.load = _accum(biquadStats.load, d.c7xLoad); const s=biquadStats.load; if(s){biquad.loadMin=s.min.toFixed(1)+'%';biquad.loadAvg=(s.sum/s.n).toFixed(1)+'%';biquad.loadMax=s.max.toFixed(1)+'%';} }
        }
        if (d.cycles    != null) biquad.cycles = d.cycles.toLocaleString()
        if (d.throughput != null) biquad.tput = d.throughput.toFixed(2) + ' MB/s'
        biquadTsLoad[biquadTsIdx]   = d.c7xLoad    ?? 0
        biquadTsCycles[biquadTsIdx] = d.cycles     ?? 0
        biquadTsTput[biquadTsIdx]   = d.throughput ?? 0
        biquadTsIdx = (biquadTsIdx + 1) % BIQUAD_TS_LEN
        if (biquadTsCount < BIQUAD_TS_LEN) biquadTsCount++
        biquad.loadLbl = `C7x DSP Load (${biquadTsCount} samples)`
        if (d.cycles    != null) biquad.cyclesLbl = `DSP Processing Cycles (Latest: ${d.cycles.toLocaleString()})`
        if (d.throughput != null) { const avg = biquadTsTput.slice(0,biquadTsCount).reduce((a,b)=>a+b,0)/biquadTsCount; biquad.tputLbl = `Demo Throughput (Avg: ${avg.toFixed(2)} MB/s)` }
        drawTrendLine(bqLoadCanvas.value,   biquadTsLoad,   biquadTsIdx, biquadTsCount, BIQUAD_TS_LEN, '#3b82f6', '%')
        drawTrendLine(bqCyclesCanvas.value, biquadTsCycles, biquadTsIdx, biquadTsCount, BIQUAD_TS_LEN, '#ef4444', '')
        drawTrendLine(bqTputCanvas.value,   biquadTsTput,   biquadTsIdx, biquadTsCount, BIQUAD_TS_LEN, '#22c55e', ' MB/s')
      }
    } catch (err) { console.warn('[biquad-ws]', err) }
  }
  biquadWs.onclose = () => { if (biquad.running) { biquad.statusMsg = 'Connection lost'; biquad.statusColor = '#ef4444' } }
  biquadWs.onerror = () => {}
}

function applyBiquadOverlay() {
  biquad.statusMsg = 'Writing overlay and rebooting…'; biquad.statusColor = '#f59e0b'; biquad.statusPulse = true
  fetch('/sigchain-biquad/enable-overlay', { method: 'POST' })
    .then(r => r.json())
    .then(d => {
      if (d.success) { rebootMsg.value = 'Board rebooting — page will refresh when device comes back online.'; startRebootWatch() }
      else { biquad.statusMsg = 'Failed: ' + (d.error || 'unknown'); biquad.statusColor = '#ef4444'; biquad.statusPulse = false }
    })
    .catch(e => { biquad.statusMsg = 'Error: ' + e.message; biquad.statusColor = '#ef4444'; biquad.statusPulse = false })
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

function clearBiquadCanvases() {
  ;[bqLoadCanvas, bqCyclesCanvas, bqTputCanvas].forEach(r => {
    if (!r.value) return
    const c = r.value.getContext('2d')
    c.fillStyle = cvBg.value
    c.fillRect(0, 0, r.value.width, r.value.height)
  })
}

watch(isLight, () => clearBiquadCanvases())

onMounted(() => { checkBiquadOverlay(); clearBiquadCanvases() })

onUnmounted(() => {
  if (biquad.running) fetch('/sigchain-biquad/stop').catch(() => {})
  if (biquadWs) { try { biquadWs.close() } catch (_) {} }
  if (_rebootWs){ try { _rebootWs.close()} catch (_) {} }
})

defineExpose({ isRunning: computed(() => biquad.running), run, stop })
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
.metrics-grid { display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;flex-shrink:0; }
.metric-tile  { background:rgb(var(--v-theme-surface-variant));border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));border-radius:6px;padding:8px 10px; }
.mt-lbl  { font-size:10px;color:#64748b;margin-bottom:3px; }
.mt-val  { font-size:16px;font-weight:700;color:rgb(var(--v-theme-on-surface)); }
.mt-stats{ display:flex;gap:4px;margin-top:4px;font-size:9px;color:#475569;flex-wrap:wrap; }
.sep { color:rgba(var(--v-border-color),var(--v-border-opacity)); }
.sv  { color:#94a3b8; }
.feat-list { list-style:none;display:flex;flex-direction:column;gap:5px;flex-shrink:0; }
.feat-list li { display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#94a3b8; }
.warn-banner   { display:flex;flex-direction:column;gap:8px;padding:12px;background:#120800;border:1px solid #d97706;border-radius:8px;flex-shrink:0; }
.banner-hdr    { display:flex;align-items:center;gap:8px; }
.banner-body   { font-size:11px;color:#94a3b8;line-height:1.6; }
.overlay-code  { font-family:monospace;font-size:10.5px;background:rgb(var(--v-theme-surface-variant));border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));border-radius:5px;padding:8px 10px;color:#22d3ee;word-break:break-all;line-height:1.5;display:block; }
.overlay-ok    { display:flex;align-items:center;gap:8px;padding:8px 10px;background:#031a0e;border:1px solid #166534;border-radius:6px;flex-shrink:0; }
.apply-btn     { padding:8px 12px;background:#d97706;border:none;color:#fff;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;justify-content:center; }
.apply-btn:hover { background:#b45309; }
.canvas-wrap { display:flex;flex-direction:column;gap:3px;flex-shrink:0; }
.canvas-lbl  { font-size:11px;color:#64748b; }
.viz-canvas  { border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));width:100%;border-radius:4px;display:block; }
.log-box     { font-family:monospace;font-size:11px;background:rgb(var(--v-theme-surface-variant));border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));border-radius:6px;padding:10px;overflow-y:auto;color:#94a3b8;word-break:break-all;line-height:1.5;flex-shrink:0; }
.reboot-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center; }
.reboot-box { background:rgb(var(--v-theme-surface));border:1px solid #d97706;border-radius:12px;padding:32px 40px;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:400px;text-align:center; }
.reboot-title { font-size:18px;font-weight:700;color:rgb(var(--v-theme-on-surface)); }
.reboot-msg   { font-size:13px;color:#94a3b8;line-height:1.6; }
@keyframes pulse { 0%,100%{opacity:0.6}50%{opacity:1} }
</style>
