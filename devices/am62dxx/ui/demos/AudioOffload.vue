<template>
  <div style="display:contents">

    <!-- Controls card -->
    <div class="card ctrl-card">
      <div class="card-ttl">Demo Description</div>
      <p class="desc-text">Real-time 8-channel audio processing offloaded to C7x DSP via RPMsg-DMA. FFT bandpass filtering with input/output spectrum visualization and live CPU/DSP performance metrics.</p>
      <hr class="card-div">
      <div class="status-row">
        <span class="status-dot" :style="{ background: ao.statusColor, animation: ao.statusPulse ? 'pulse 2s infinite' : 'none' }"/>
        <span style="font-size:12px" :style="{ color: ao.statusColor }">{{ ao.statusMsg }}</span>
      </div>
      <div class="sub-ttl">Controls</div>
      <div class="filter-row">
        <span class="filter-lbl">Filter</span>
        <button class="filt-btn" :class="{ active: ao.filterOn }"  @click="setAoFilter(true)">ON</button>
        <button class="filt-btn" :class="{ active: !ao.filterOn }" @click="setAoFilter(false)">OFF</button>
      </div>
      <div class="sub-ttl">Live Metrics</div>
      <div class="metrics-grid">
        <div class="metric-tile">
          <div class="mt-lbl">Frame</div>
          <div class="mt-val">{{ ao.frame }}</div>
        </div>
        <div class="metric-tile">
          <div class="mt-lbl">Latency</div>
          <div class="mt-val">{{ ao.latency }}</div>
          <div class="mt-stats"><span>Min <span class="sv">{{ ao.latMin }}</span></span><span class="sep">|</span><span>Avg <span class="sv">{{ ao.latAvg }}</span></span><span class="sep">|</span><span>Max <span class="sv">{{ ao.latMax }}</span></span></div>
        </div>
        <div class="metric-tile">
          <div class="mt-lbl">CPU Load</div>
          <div class="mt-val" style="color:#60a5fa">{{ ao.cpu }}</div>
          <div class="mt-stats"><span>Min <span class="sv">{{ ao.cpuMin }}</span></span><span class="sep">|</span><span>Avg <span class="sv">{{ ao.cpuAvg }}</span></span><span class="sep">|</span><span>Max <span class="sv">{{ ao.cpuMax }}</span></span></div>
        </div>
        <div class="metric-tile">
          <div class="mt-lbl">DSP Load</div>
          <div class="mt-val" style="color:#fbbf24">{{ ao.dsp }}</div>
          <div class="mt-stats"><span>Min <span class="sv">{{ ao.dspMin }}</span></span><span class="sep">|</span><span>Avg <span class="sv">{{ ao.dspAvg }}</span></span><span class="sep">|</span><span>Max <span class="sv">{{ ao.dspMax }}</span></span></div>
        </div>
      </div>
      <hr class="card-div">
      <div class="sub-ttl">Features</div>
      <ul class="feat-list">
        <li v-for="f in aoFeatures" :key="f"><span style="color:#fbbf24">✓</span> {{ f }}</li>
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
      <div class="canvas-wrap">
        <div class="canvas-lbl" style="color:#34d399">Input Audio Spectrum</div>
        <canvas ref="specInCanvas" width="600" height="150" class="viz-canvas"/>
      </div>
      <div class="canvas-wrap">
        <div class="canvas-lbl" style="color:#60a5fa">Output Audio Spectrum</div>
        <canvas ref="specOutCanvas" width="600" height="150" class="viz-canvas"/>
      </div>
      <hr class="card-div">
      <div class="canvas-wrap">
        <div class="canvas-lbl">Average Amplitude</div>
        <canvas ref="tsAmpCanvas" width="600" height="100" class="viz-canvas"/>
      </div>
      <div class="canvas-wrap">
        <div class="canvas-lbl">Frame Latency (ms)</div>
        <canvas ref="tsLatCanvas" width="600" height="100" class="viz-canvas"/>
      </div>
      <div class="canvas-wrap">
        <div class="canvas-lbl">System Load</div>
        <canvas ref="tsLoadCanvas" width="600" height="100" class="viz-canvas"/>
      </div>
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
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'

const emit = defineEmits(['running-change'])

const theme   = useTheme()
const isLight = computed(() => theme.global.name.value === 'tiLight')
const cvBg     = computed(() => isLight.value ? '#f1f5f9' : '#05080f')
const cvGrid   = computed(() => isLight.value ? '#dde3ec' : '#1a2f4a')
const cvLabel  = computed(() => isLight.value ? '#64748b' : '#3d5068')
const cvAxis   = computed(() => isLight.value ? '#cbd5e1' : '#334155')
const cvLegend = computed(() => isLight.value ? '#475569' : '#94a3b8')

const aoFeatures = ['8-channel audio via RPMsg-DMA','FFT bandpass filtering on C7x DSP','Real-time input/output spectrum','Live CPU and DSP load metrics','ARM vs DSP mode comparison']

const ao = reactive({
  running: false,
  statusMsg: 'Not running', statusColor: '#64748b', statusPulse: false,
  filterOn: true,
  frame: '--',
  latency: '-- ms', latMin: '--', latAvg: '--', latMax: '--',
  cpu: '--%',       cpuMin: '--', cpuAvg: '--', cpuMax: '--',
  dsp: '--%',       dspMin: '--', dspAvg: '--', dspMax: '--',
})
let aoWs = null, aoStats = null

const conflictActive = ref(false)
const rebootMsg      = ref('')

const specInCanvas  = ref(null), specOutCanvas = ref(null)
const tsAmpCanvas   = ref(null), tsLatCanvas   = ref(null), tsLoadCanvas = ref(null)

const AO_TS_LEN = 600
const aoTsAmp = new Float32Array(AO_TS_LEN), aoTsLat = new Float32Array(AO_TS_LEN)
const aoTsCpu = new Float32Array(AO_TS_LEN), aoTsDsp = new Float32Array(AO_TS_LEN)
let aoTsIdx = 0, aoTsCount = 0
const aoSpecLastDraw = {}
const aoSpecFFTRe = new Float64Array(512), aoSpecFFTIm = new Float64Array(512)

function _accum(s, v) {
  if (v == null || isNaN(v)) return s
  if (!s) return { min: v, max: v, sum: v, n: 1 }
  return { min: Math.min(s.min, v), max: Math.max(s.max, v), sum: s.sum + v, n: s.n + 1 }
}
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function _fft(re, im) {
  const N = re.length
  for (let i=1,j=0;i<N;i++){let b=N>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
  for (let len=2;len<=N;len<<=1){const ang=-2*Math.PI/len,wRe=Math.cos(ang),wIm=Math.sin(ang);for(let i=0;i<N;i+=len){let cRe=1,cIm=0;const h=len>>1;for(let j=0;j<h;j++){const uR=re[i+j],uI=im[i+j],tR=cRe*re[i+j+h]-cIm*im[i+j+h],tI=cRe*im[i+j+h]+cIm*re[i+j+h];re[i+j]=uR+tR;im[i+j]=uI+tI;re[i+j+h]=uR-tR;im[i+j+h]=uI-tI;const nr=cRe*wRe-cIm*wIm;cIm=cRe*wIm+cIm*wRe;cRe=nr;}}}
}

function aoTsPush(amp, lat, cpu, dsp) {
  aoTsAmp[aoTsIdx]=amp; aoTsLat[aoTsIdx]=lat; aoTsCpu[aoTsIdx]=cpu; aoTsDsp[aoTsIdx]=dsp
  aoTsIdx = (aoTsIdx + 1) % AO_TS_LEN
  if (aoTsCount < AO_TS_LEN) aoTsCount++
}

function drawAoSpectrum(which, b64pcm) {
  const now = performance.now()
  if (now - (aoSpecLastDraw[which] || 0) < 40) return
  aoSpecLastDraw[which] = now
  const canvas = which === 'in' ? specInCanvas.value : specOutCanvas.value
  if (!canvas) return
  const raw = atob(b64pcm), N = 512, n = Math.min(N, raw.length >> 1)
  for (let i=0;i<N;i++){if(i<n){const lo=raw.charCodeAt(i*2)&0xff,hi=raw.charCodeAt(i*2+1)&0xff;let s=(hi<<8)|lo;if(s>=32768)s-=65536;aoSpecFFTRe[i]=s/32768;}else aoSpecFFTRe[i]=0;aoSpecFFTIm[i]=0;}
  for (let i=0;i<N;i++){const w=0.42-0.5*Math.cos(2*Math.PI*i/(N-1))+0.08*Math.cos(4*Math.PI*i/(N-1));aoSpecFFTRe[i]*=w;}
  _fft(aoSpecFFTRe, aoSpecFFTIm)
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height
  const PL=44,PR=8,PT=12,PB=24,PW=W-PL-PR,PH=H-PT-PB
  const DB_MIN=-100,DB_MAX=0,SR=48000,MAX_HZ=16000,MAX_BIN=Math.round(MAX_HZ/(SR/N))
  ctx.fillStyle=cvBg.value;ctx.fillRect(0,0,W,H)
  ctx.font='10px monospace';ctx.textAlign='right'
  ;[-100,-75,-50,-25,0].forEach(db=>{const y=PT+(db-DB_MAX)/(DB_MIN-DB_MAX)*PH;ctx.strokeStyle=cvGrid.value;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(PL,y);ctx.lineTo(W-PR,y);ctx.stroke();ctx.fillStyle=cvLabel.value;ctx.fillText(db,PL-3,y+3);})
  ctx.textAlign='center'
  ;[0,1000,2000,4000,8000,12000,16000].forEach(hz=>{const x=PL+(Math.round(hz/(SR/N))/MAX_BIN)*PW;if(x<PL||x>W-PR)return;ctx.strokeStyle=cvGrid.value;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(x,PT);ctx.lineTo(x,H-PB);ctx.stroke();ctx.fillStyle=cvLabel.value;ctx.fillText(hz===0?'0':(hz>=1000?(hz/1000)+'k':hz),x,H-7);})
  ctx.save();ctx.translate(11,PT+PH/2);ctx.rotate(-Math.PI/2);ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillStyle=cvLabel.value;ctx.fillText('Amplitude (dBFS)',0,0);ctx.restore()
  ctx.strokeStyle=cvAxis.value;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PL,PT);ctx.lineTo(PL,H-PB);ctx.lineTo(W-PR,H-PB);ctx.stroke()
  ctx.strokeStyle=which==='in'?'#22c55e':'#3b82f6';ctx.lineWidth=1.5;ctx.beginPath()
  for(let b=1;b<=MAX_BIN;b++){const re=aoSpecFFTRe[b],im=aoSpecFFTIm[b],db=20*Math.log10(Math.sqrt(re*re+im*im)+1e-9),x=PL+(b/MAX_BIN)*PW,y=PT+(_clamp(db,DB_MIN,DB_MAX)-DB_MAX)/(DB_MIN-DB_MAX)*PH;if(b===1)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
  ctx.stroke()
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

function drawAoLoadChart() {
  const canvas=tsLoadCanvas.value; if(!canvas||aoTsCount<2)return
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,PL=42,PR=6,PT=6,PB=14,PW=W-PL-PR,PH=H-PT-PB
  const n=Math.min(aoTsCount,AO_TS_LEN),si=aoTsCount<AO_TS_LEN?0:aoTsIdx
  ctx.fillStyle=cvBg.value;ctx.fillRect(0,0,W,H)
  ctx.font='9px monospace';ctx.textAlign='right'
  ;[0,50,100].forEach(v=>{const y=PT+(1-v/100)*PH;ctx.strokeStyle=cvGrid.value;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(PL,y);ctx.lineTo(W-PR,y);ctx.stroke();ctx.fillStyle=cvLabel.value;ctx.fillText(v+'%',PL-3,y+3);})
  ctx.strokeStyle=cvAxis.value;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PL,PT);ctx.lineTo(PL,H-PB);ctx.lineTo(W-PR,H-PB);ctx.stroke()
  ;[[aoTsCpu,'#3b82f6'],[aoTsDsp,'#f59e0b']].forEach(([buf,col])=>{ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.beginPath();for(let i=0;i<n;i++){const v=buf[(si+i)%AO_TS_LEN],x=PL+(i/(n-1))*PW,y=PT+(1-_clamp(v/100,0,1))*PH;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();})
  ctx.textAlign='left';ctx.font='9px sans-serif'
  ctx.fillStyle='#3b82f6';ctx.fillRect(W-76,9,12,2);ctx.fillStyle=cvLegend.value;ctx.fillText('CPU',W-61,13)
  ctx.fillStyle='#f59e0b';ctx.fillRect(W-36,9,12,2);ctx.fillStyle=cvLegend.value;ctx.fillText('DSP',W-21,13)
}

function clearAoCanvases() {
  ;[specInCanvas,specOutCanvas,tsAmpCanvas,tsLatCanvas,tsLoadCanvas].forEach(r=>{if(!r.value)return;const c=r.value.getContext('2d');c.fillStyle=cvBg.value;c.fillRect(0,0,r.value.width,r.value.height);})
}

function checkConflictOverlay() {
  fetch('/sigchain-biquad/check-overlay', { signal: AbortSignal.timeout(5000) })
    .then(r => r.json())
    .then(d => { if (d) conflictActive.value = !!d.active })
    .catch(() => {})
}

async function run() {
  if (conflictActive.value) { checkConflictOverlay(); return }
  ao.running = true
  emit('running-change', true)
  aoStats = { lat: null, cpu: null, dsp: null }
  ao.latMin=ao.latAvg=ao.latMax='--'; ao.cpuMin=ao.cpuAvg=ao.cpuMax='--'; ao.dspMin=ao.dspAvg=ao.dspMax='--'
  ao.statusMsg = 'Starting rpmsg_audio_offload_example…'; ao.statusColor = '#f59e0b'; ao.statusPulse = true

  await nextTick()
  clearAoCanvases()

  fetch('/audio-offload/run')
    .then(r => r.ok ? r : r.text().then(t => { let m = t; try { m = JSON.parse(t).error || t } catch (_) {} throw new Error(m || 'HTTP ' + r.status) }))
    .then(() => { ao.statusMsg = 'Connecting…'; connectAoWs() })
    .catch(err => { ao.statusMsg = 'Error: ' + err.message; ao.statusColor = '#ef4444'; ao.statusPulse = false; ao.running = false; emit('running-change', false) })
}

function stop() {
  fetch('/audio-offload/stop').catch(() => {})
  ao.running = false
  emit('running-change', false)
  if (aoWs) { try { aoWs.close() } catch (_) {} aoWs = null }
  ao.statusMsg = 'Stopped'; ao.statusColor = '#64748b'; ao.statusPulse = false
  aoTsAmp.fill(0); aoTsLat.fill(0); aoTsCpu.fill(0); aoTsDsp.fill(0)
  aoTsIdx = 0; aoTsCount = 0
  clearAoCanvases()
}

function connectAoWs() {
  if (aoWs && (aoWs.readyState === 0 || aoWs.readyState === 1)) return
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  aoWs = new WebSocket(`${proto}//${location.host}/audio-offload`)
  aoWs.onmessage = e => {
    try {
      const d = JSON.parse(e.data)
      if (d.type === 'status') {
        const c = d.state === 'connected' ? '#22c55e' : d.state === 'connecting' ? '#f59e0b' : '#64748b'
        ao.statusMsg = d.message; ao.statusColor = c; ao.statusPulse = d.state === 'connecting'
      } else if (d.type === 'audio') {
        drawAoSpectrum(d.channel === 'input' ? 'in' : 'out', d.pcm)
      } else if (d.type === 'metrics') {
        const lat = d.latency ?? 0, cpu = d.cpuLoad ?? 0, dsp = d.dspLoad ?? 0, amp = d.avgAmp ?? 0
        ao.frame   = d.frame   != null ? String(d.frame) : '--'
        ao.latency = lat ? lat.toFixed(2) + ' ms' : '-- ms'
        ao.cpu     = cpu ? cpu.toFixed(1) + '%'   : '--%'
        ao.dsp     = dsp ? dsp.toFixed(1) + '%'   : '--%'
        if (aoStats) {
          if (d.latency != null) { aoStats.lat = _accum(aoStats.lat, lat); const s=aoStats.lat; ao.latMin=s.min.toFixed(2)+' ms'; ao.latAvg=(s.sum/s.n).toFixed(2)+' ms'; ao.latMax=s.max.toFixed(2)+' ms' }
          if (d.cpuLoad != null) { aoStats.cpu = _accum(aoStats.cpu, cpu); const s=aoStats.cpu; ao.cpuMin=s.min.toFixed(1)+'%'; ao.cpuAvg=(s.sum/s.n).toFixed(1)+'%'; ao.cpuMax=s.max.toFixed(1)+'%' }
          if (d.dspLoad != null) { aoStats.dsp = _accum(aoStats.dsp, dsp); const s=aoStats.dsp; ao.dspMin=s.min.toFixed(1)+'%'; ao.dspAvg=(s.sum/s.n).toFixed(1)+'%'; ao.dspMax=s.max.toFixed(1)+'%' }
        }
        aoTsPush(amp, lat, cpu, dsp)
        drawTrendLine(tsAmpCanvas.value,  aoTsAmp, aoTsIdx, aoTsCount, AO_TS_LEN, '#22d3ee', '')
        drawTrendLine(tsLatCanvas.value,  aoTsLat, aoTsIdx, aoTsCount, AO_TS_LEN, '#22c55e', 'ms')
        drawAoLoadChart()
      }
    } catch (err) { console.warn('[ao-ws]', err) }
  }
  aoWs.onclose = () => { if (ao.running) { ao.statusMsg = 'Connection lost'; ao.statusColor = '#ef4444'; ao.statusPulse = false } }
  aoWs.onerror = () => {}
}

function setAoFilter(enable) {
  ao.filterOn = enable
  if (aoWs && aoWs.readyState === 1) aoWs.send(JSON.stringify({ type: 'set_filter', value: enable ? 1 : 0 }))
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

watch(isLight, () => nextTick(clearAoCanvases))

onMounted(() => {
  checkConflictOverlay()
  nextTick(clearAoCanvases)
})

onUnmounted(() => {
  if (ao.running) fetch('/audio-offload/stop').catch(() => {})
  if (aoWs)     { try { aoWs.close()     } catch (_) {} }
  if (_rebootWs){ try { _rebootWs.close()} catch (_) {} }
})

defineExpose({ isRunning: computed(() => ao.running), run, stop })
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
.filter-row{ display:flex;gap:6px;align-items:center;flex-shrink:0; }
.filter-lbl{ font-size:11px;color:#94a3b8;flex-shrink:0; }
.filt-btn  { flex:1;padding:5px 8px;background:rgb(var(--v-theme-surface-variant));border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));color:#64748b;font-size:11px;font-weight:600;border-radius:5px;cursor:pointer; }
.filt-btn.active { background:#d97706;border-color:#b45309;color:#fff; }
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
.canvas-wrap { display:flex;flex-direction:column;gap:3px;flex-shrink:0; }
.canvas-lbl  { font-size:11px;color:#64748b; }
.viz-canvas  { border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));width:100%;border-radius:4px;display:block; }
.reboot-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center; }
.reboot-box { background:rgb(var(--v-theme-surface));border:1px solid #d97706;border-radius:12px;padding:32px 40px;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:400px;text-align:center; }
.reboot-title { font-size:18px;font-weight:700;color:rgb(var(--v-theme-on-surface)); }
.reboot-msg   { font-size:13px;color:#94a3b8;line-height:1.6; }
@keyframes pulse { 0%,100%{opacity:0.6}50%{opacity:1} }
</style>
