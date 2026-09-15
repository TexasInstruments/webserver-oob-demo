<template>
  <div class="home-page">

    <!-- ── Hero ── -->
    <div class="hero" :class="{ 'hero-light': isLight }" :style="heroStyle">
      <div class="hero-content">
        <div class="hero-welcome">Welcome to</div>
        <h1 class="hero-title">
          <span class="t-white">{{ deviceTitle.white }}</span><span class="t-blue">{{ deviceTitle.blue }}</span>
        </h1>
        <p class="hero-desc">{{ heroDesc }}</p>
        <v-btn color="primary" variant="flat" size="large" :to="heroButton.to" append-icon="mdi-chevron-right">
          {{ heroButton.label }}
        </v-btn>
      </div>
      <div class="hero-chip">
        <img :src="isLight ? chipImages.light : chipImages.dark" alt="SoC" />
      </div>
    </div>

    <!-- ── Main grid ── -->
    <div class="main-grid">

      <!-- Explore Demos -->
      <v-card flat class="ti-card">
        <div class="card-ttl">Explore Demos And Tools</div>

        <div
          v-for="demo in demoCards" :key="demo.to"
          class="demo-item"
          @click="$router.push(demo.to)"
        >
          <div class="demo-icon" :style="{ background: demo.iconBg, border: `2px solid ${demo.iconBorder}`, color: demo.iconColor }">
            <v-icon size="22">{{ demo.icon }}</v-icon>
          </div>
          <div class="demo-body">
            <div class="demo-name">{{ demo.name }}</div>
            <div class="demo-desc">{{ demo.desc }}</div>
          </div>
          <v-icon size="20" color="primary">mdi-chevron-right</v-icon>
        </div>
      </v-card>

      <!-- Info -->
      <v-card flat class="ti-card">
        <div class="card-ttl">Info</div>

        <div v-for="item in sdkInfo" :key="item.label" class="info-item">
          <div class="info-icon" :style="{ background: item.iconBg, border: item.iconBd, color: item.iconColor }">
            <v-icon size="20">{{ item.icon }}</v-icon>
          </div>
          <span class="info-label">{{ item.label }}</span>
          <span class="info-version">{{ item.version }}</span>
        </div>

        <div class="about-box">
          <div class="about-title">
            <v-icon size="15" color="primary">mdi-information-outline</v-icon>
            About This Demo
          </div>
          <p class="about-body">{{ aboutText }}</p>
        </div>
      </v-card>

      <!-- Device Info + Runtime -->
      <div class="right-col">
        <v-card flat class="ti-card">
          <div class="card-ttl">
            <v-icon size="16" color="primary" style="margin-right:6px;">mdi-monitor</v-icon>
            Device Info
          </div>
          <div class="dev-row"><span class="dl">Device</span>    <span class="dv">{{ devInfo.displayName || '—' }}</span></div>
          <div class="dev-row"><span class="dl">Board</span>     <span class="dv">{{ devInfo.board || '—' }}</span></div>
          <div class="dev-row"><span class="dl">SoC</span>       <span class="dv">{{ devInfo.soc || '—' }}</span></div>
          <div class="dev-row"><span class="dl">IP Address</span><span class="dv">{{ ip }}</span></div>
          <div class="dev-row" style="border:none;"><span class="dl">Uptime</span><span class="dv">{{ uptime }}</span></div>
        </v-card>

        <v-card flat class="ti-card">
          <div class="card-ttl">
            <v-icon size="16" color="primary" style="margin-right:6px;">mdi-pulse</v-icon>
            Runtime Status
          </div>

          <div v-for="m in metrics" :key="m.label" class="metric">
            <div class="metric-hdr">
              <span class="metric-lbl">{{ m.label }}</span>
              <span class="metric-val">{{ m.value }}</span>
            </div>
            <div v-if="m.pct !== null" class="bar-track">
              <div class="bar-fill" :class="m.color" :style="{ transform: 'scaleX(' + m.pct / 100 + ')' }" />
            </div>
          </div>
        </v-card>

      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import { deviceTitle, heroDesc, heroButton, demoCards, sdkInfo, chipImages, aboutText } from '@device/index.js'

const vuetifyTheme = useTheme()
const isLight = computed(() => vuetifyTheme.global.name.value === 'tiLight')
const heroStyle = computed(() => isLight.value
  ? { background: 'linear-gradient(135deg, #f0f8ff 0%, #dbeafe 55%, #eff6ff 100%)', border: '1px solid #bfdbfe' }
  : { background: 'linear-gradient(135deg, #04070f 0%, #07122a 55%, #040c18 100%)', border: '1px solid #1e3a5f' }
)

const devInfo = ref({ displayName: '', board: '', soc: '' })
const ip      = ref(window.location.hostname || '—')
const uptime  = ref('—')
const metrics = ref([
  { label: 'CPU Load',     value: '—', pct: 0,    color: 'bar-green'  },
  { label: 'CPU Avg',      value: '—', pct: null,  color: ''          },
  { label: 'CPU Peak',     value: '—', pct: null,  color: ''          },
  { label: 'RAM Used/Free',value: '—', pct: 0,    color: 'bar-purple' },
])

let timers = []

function fmt(mb) { return mb >= 1024 ? (mb / 1024).toFixed(1) + 'GB' : mb + 'MB' }
function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

async function pollCpu() {
  try {
    const d = await fetch('/cpu-load').then(r => r.json())
    const cpu = d.current_cpu_usage ?? d.cpu_percent ?? null
    const avg = d.average_cpu_usage ?? null
    const max = d.max_cpu_usage ?? null
    if (cpu != null) { metrics.value[0].value = Math.round(cpu) + '%'; metrics.value[0].pct = cpu }
    if (avg != null)   metrics.value[1].value = Math.round(avg) + '%'
    if (max != null)   metrics.value[2].value = Math.round(max) + '%'
  } catch (_) {}
}

async function pollMem() {
  try {
    const d = await fetch('/mem-info').then(r => r.json())
    if (!d.total_kb) return
    const used = Math.round((d.total_kb - d.available_kb) / 1024)
    const total = Math.round(d.total_kb / 1024)
    const pct = (d.total_kb - d.available_kb) / d.total_kb * 100
    metrics.value[3].value = `${fmt(used)} / ${fmt(total)}`
    metrics.value[3].pct = pct
  } catch (_) {}
}

async function pollUptime() {
  try {
    const d = await fetch('/sys-uptime').then(r => r.json())
    if (d.uptime_seconds != null) uptime.value = fmtUptime(d.uptime_seconds)
  } catch (_) {}
}

onMounted(async () => {
  try {
    const d = await fetch('/device-info').then(r => r.json())
    devInfo.value.displayName = d.displayName || d.id || ''
    devInfo.value.board = (d.boards && d.boards[0]?.name) || ''
    devInfo.value.soc   = d.soc || ''
  } catch (_) {}

  pollCpu(); pollMem(); pollUptime()
  timers.push(setInterval(pollCpu,    1000))
  timers.push(setInterval(pollMem,    5000))
  timers.push(setInterval(pollUptime, 10000))
})

onUnmounted(() => timers.forEach(clearInterval))
</script>

<style scoped>
.home-page { display:flex; flex-direction:column; gap:0; height:100%; overflow-y:auto; }

/* ── Hero ── */
.hero {
  margin: 16px 16px 0;
  border-radius: 14px;
  padding: 40px 48px;
  display: flex; align-items: center; justify-content: space-between;
  position: relative; overflow: hidden; min-height: 240px; flex-shrink: 0;
}
.hero::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 30% 50%, rgba(29,78,216,0.15) 0%, transparent 55%);
  pointer-events: none;
}
.hero-content { position:relative; z-index:2; max-width:460px; }
.hero-welcome { font-size:14px; font-weight:500; color:#4da6ff; margin-bottom:8px; }
.hero-title   { font-size:38px; font-weight:900; line-height:1.1; margin-bottom:14px; }
.t-white { color:#fff; }
.t-blue  { color:#4da6ff; }
.hero-desc { font-size:14px; color:#94a3b8; line-height:1.65; margin-bottom:24px; max-width:380px; }

/* Light mode hero overrides */
.hero-light .t-white { color:#0f172a; }
.hero-light .t-blue  { color:#1d6fe8; }
.hero-light .hero-welcome { color:#1d6fe8; }
.hero-light .hero-desc    { color:#475569; }

.hero-chip { position:absolute; right:0; top:0; bottom:0; width:48%; z-index:1; pointer-events:none; }
.hero-chip img {
  position:absolute; inset:0; width:100%; height:100%;
  object-fit:cover; object-position:center;
  -webkit-mask-image:
    linear-gradient(to right,  transparent 0%, black 40%, black 90%, transparent 100%),
    linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-size: 100% 100%;
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(to right,  transparent 0%, black 40%, black 90%, transparent 100%),
    linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  mask-composite: intersect;
}

/* ── Main grid ── */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  padding: 16px;
  flex: 1;
}

/* ── Cards ── */
.ti-card {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-border-color),var(--v-border-opacity)) !important;
  border-radius: 12px !important;
  padding: 20px;
}
.card-ttl { font-size:14px; font-weight:700; color:rgb(var(--v-theme-on-surface)); margin-bottom:14px; }

/* ── Demo items ── */
.demo-item {
  display:flex; align-items:center; gap:14px;
  padding:14px; border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));
  border-radius:10px; margin-bottom:10px; cursor:pointer; transition:all 0.15s;
}
.demo-item:last-child { margin-bottom:0; }
.demo-item:hover { border-color:#4da6ff; background:rgba(77,166,255,0.04); }
.demo-icon  { width:46px; height:46px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.demo-body  { flex:1; }
.demo-name  { font-size:13px; font-weight:700; color:rgb(var(--v-theme-on-surface)); margin-bottom:3px; }
.demo-desc  { font-size:12px; color:#64748b; line-height:1.45; }

/* ── Info items ── */
.info-item {
  display:flex; align-items:center; gap:12px;
  padding:12px; border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));
  border-radius:10px; margin-bottom:10px;
}
.info-icon    { width:40px; height:40px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.info-label   { flex:1; font-size:13px; color:#94a3b8; }
.info-version { font-size:13px; color:rgb(var(--v-theme-on-surface)); font-weight:600; white-space:nowrap; }
.about-box  { border:1px solid rgba(77,166,255,0.2); border-radius:10px; padding:14px; background:rgba(10,20,50,0.3); }
.about-title{ display:flex; align-items:center; gap:7px; font-size:13px; font-weight:700; color:#4da6ff; margin-bottom:7px; }
.about-body { font-size:12px; color:#64748b; line-height:1.6; }

/* ── Right column ── */
.right-col { display:flex; flex-direction:column; gap:16px; }
.dev-row {
  display:flex; justify-content:space-between; align-items:center;
  padding:8px 0; border-bottom:1px solid rgba(var(--v-border-color),var(--v-border-opacity));
  font-size:13px;
}
.dl { color:#64748b; }
.dv { color:rgb(var(--v-theme-on-surface)); font-weight:500; text-align:right; }

/* ── Metrics ── */
.metric     { margin-bottom:12px; }
.metric:last-child { margin-bottom:0; }
.metric-hdr { display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px; }
.metric-lbl { color:#94a3b8; }
.metric-val { color:rgb(var(--v-theme-on-surface)); font-weight:600; }
.bar-track  { height:6px; background:rgb(var(--v-theme-surface-variant)); border-radius:4px; overflow:hidden; }
.bar-fill   { height:100%; border-radius:4px; transform-origin:left; transition:transform 1.2s ease; }
.bar-green  { background: linear-gradient(90deg,#16a34a,#4ade80); }
.bar-purple { background: linear-gradient(90deg,#7c3aed,#c084fc); }

</style>
