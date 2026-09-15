<template>
  <div class="audio-dsp-view">

    <!-- Page header -->
    <div class="page-hdr">
      <div class="ph-left">
        <div class="ph-icon">
          <v-icon size="22" color="blue-lighten-2">mdi-waveform</v-icon>
        </div>
        <div>
          <div class="ph-title">Audio Intelligence</div>
          <div class="ph-sub">Real-time audio intelligence powered by the C7x DSP — AI-enabled noise reduction, speech enhancement, and acoustic event detection on AM62D.</div>
        </div>
      </div>
      <v-btn
        :color="demoRunning ? 'error' : 'primary'"
        variant="flat"
        size="small"
        :disabled="!canRun && !demoRunning"
        :prepend-icon="demoRunning ? 'mdi-stop' : (!tvmReady && !tvmWasReady) ? 'mdi-cog-sync-outline' : 'mdi-play'"
        class="run-btn"
        @click="triggerRun"
      >{{ demoRunning ? 'Stop Demo' : (!tvmReady && !tvmWasReady) ? 'Preparing Demo…' : 'Run Demo' }}</v-btn>
    </div>

    <!-- C7x / TVM readiness banner — shown only during initial preload or on error -->
    <v-alert
      v-if="showPreparingBanner"
      :type="tvmState === 'error' ? 'error' : 'info'"
      variant="tonal"
      density="compact"
      class="preparing-alert"
      icon="mdi-cog-sync-outline"
      aria-live="polite"
    >
      <span class="preparing-txt">
        <span class="preparing-spinner">&#9696;</span>
        <span><strong>Preparing analytics demos:</strong> {{ tvmStatusMessage }}</span>
      </span>
    </v-alert>

    <!-- Two-column content grid -->
    <div class="content-grid">

      <!-- Demo selector -->
      <v-card class="ti-card demo-selector" flat>
        <div class="card-ttl" style="display:flex;align-items:center;justify-content:space-between">
          Demo Selection
        </div>

        <div
          v-for="(d, i) in demos"
          :key="i"
          class="dsi"
          :class="{ active: activeIdx === i }"
          @click="selectDemo(i)"
        >
          <div class="dsi-ic" :style="d.iconStyle">
            <v-icon size="16">{{ d.icon }}</v-icon>
          </div>
          <div class="dsi-txt">
            <div class="dsi-name">{{ d.name }}</div>
            <div class="dsi-sub">{{ d.sub }}</div>
          </div>
          <span class="dsi-arr">›</span>
        </div>
      </v-card>

      <!-- Active demo panel -->
      <div class="demo-panel">
        <Transition name="demo-fade" mode="out-in">
          <component :is="currentComponent" :key="activeIdx" ref="activeDemo" @running-change="onRunningChange" />
        </Transition>
      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, shallowRef, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
const SpeechEnhancement  = defineAsyncComponent(() => import('../demos/SpeechEnhancement.vue'))
const TvmInference        = defineAsyncComponent(() => import('../demos/TvmInference.vue'))
const AudioClassification = defineAsyncComponent(() => import('@/demos/AudioClassification.vue'))
const GStreamerPipeline   = defineAsyncComponent(() => import('../demos/GStreamerPipeline.vue'))
import { registerRunningDemo, clearRunningDemo } from '@/composables/useDemoSession'

const demos = [
  {
    name: 'Speech Enhancement',
    sub:  'C7x DSP noise reduction + TIDL',
    icon: 'mdi-microphone-outline',
    iconStyle: 'background:radial-gradient(circle at 40% 40%,#0d3a2e,#062018);border:2px solid #059669;color:#34d399',
    component: SpeechEnhancement,
    canRun: true,
  },
  {
    name: 'Audio Classification',
    sub:  'AI based audio event classification',
    icon: 'mdi-chart-bar',
    iconStyle: 'background:radial-gradient(circle at 40% 40%,#3b1c68,#1e0d40);border:2px solid #7c3aed;color:#c084fc',
    component: AudioClassification,
    canRun: true,
  },
  // {
  //   name: 'TVM Inference',
  //   sub:  'GCRN on C7x DSP via TVM+TIDL',
  //   icon: 'mdi-flash',
  //   iconStyle: 'background:radial-gradient(circle at 40% 40%,#1a3a7a,#0a1540);border:2px solid #1d4ed8;color:#60a5fa',
  //   component: TvmInference,
  //   canRun: true,
  // },
  {
    name: 'Custom Audio Pipeline',
    sub:  'Generic gst-launch runner with artifact management',
    icon: 'mdi-pipe',
    iconStyle: 'background:radial-gradient(circle at 40% 40%,#1a3a1a,#0a200a);border:2px solid #16a34a;color:#4ade80',
    component: GStreamerPipeline,
    canRun: true,
    skipTvmCheck: true,
  },
]

const activeIdx        = ref(0)
const activeDemo       = ref(null)
const currentComponent = shallowRef(demos[0].component)
const demoRunning      = ref(false)
const canRun = computed(() => {
  const demo = demos[activeIdx.value]
  return demo.canRun && (demo.skipTvmCheck || tvmReady.value || tvmWasReady.value)
})

const tvmReady      = ref(false)
const tvmWasReady   = ref(false)   // latched true once tvmReady ever becomes true
const tvmState      = ref('checking')
const tvmDetails    = ref(null)
let _tvmPollTimer   = null
let _tvmPollStopped = false
let _tvmPollStart   = 0
const TVM_INIT_TIMEOUT_MS = 90_000

/* Show the preload banner only during the initial boot sequence, or on hard
 * error. Once the daemon has been ready at least once, transient drops (e.g.
 * C7x firmware switch during a demo run) must not re-show the banner. */
const showPreparingBanner = computed(() =>
  tvmState.value === 'error' || (!tvmReady.value && !tvmWasReady.value)
)

watch(tvmReady, val => { if (val) tvmWasReady.value = true })

const tvmStatusMessage = computed(() => {
  if (tvmState.value === 'error')
    return `C7x/TVM initialization failed${tvmDetails.value?.error ? ': ' + tvmDetails.value.error : ''}`
  if (tvmDetails.value?.c7xState !== 'running')
    return `Waiting for C7x DSP to boot (state: ${tvmDetails.value?.c7xState || 'checking'})…`
  if (!tvmDetails.value?.daemonReady)
    return 'C7x is running; loading the TVM model daemon…'
  if (!tvmDetails.value?.modelReady)
    return 'TVM daemon is ready; preloading model artifacts…'
  return 'Checking C7x and TVM readiness…'
})

async function pollTvmDaemon() {
  try {
    const r = await fetch('/tvm-daemon/status')
    const status = await r.json()
    tvmDetails.value = status
    tvmState.value = status.state || (r.ok ? 'checking' : 'error')
    tvmReady.value = r.ok && status.ready === true
  } catch (error) {
    tvmReady.value = false
    tvmState.value = 'error'
    tvmDetails.value = { error: error.message, c7xState: 'unavailable' }
  } finally {
    if (_tvmPollStopped || tvmReady.value) return
    if (Date.now() - _tvmPollStart >= TVM_INIT_TIMEOUT_MS) {
      tvmState.value = 'error'
      tvmDetails.value = { error: 'TVM initialization timed out after 90 s — check C7x remoteproc and tvm-model-daemon service', c7xState: tvmDetails.value?.c7xState || 'unknown' }
      return
    }
    _tvmPollTimer = setTimeout(pollTvmDaemon, 2000)
  }
}

onMounted(() => { _tvmPollStart = Date.now(); pollTvmDaemon() })

function selectDemo(i) {
  if (i === activeIdx.value) return
  if (demoRunning.value) {
    if (activeDemo.value?.isModelLoading?.value) {
      window.alert(
        `${demos[activeIdx.value].name} model is loading — please wait for it to finish before switching demos.`
      )
      return
    }
    const confirmed = window.confirm(
      `”${demos[activeIdx.value].name}” is currently running. Switching demos will stop it. Continue?`
    )
    if (!confirmed) return
    activeDemo.value?.stop()
    clearRunningDemo(demos[activeIdx.value].name)
  }
  activeIdx.value        = i
  currentComponent.value = demos[i].component
  demoRunning.value      = false
}

function onRunningChange(v) {
  demoRunning.value = v
  const name = demos[activeIdx.value].name
  if (v) registerRunningDemo(name, () => activeDemo.value?.stop())
  else clearRunningDemo(name)
}

function triggerRun() {
  if (demoRunning.value) activeDemo.value?.stop()
  else if (tvmReady.value) activeDemo.value?.run()
}

onUnmounted(() => {
  _tvmPollStopped = true
  if (demoRunning.value) activeDemo.value?.stop()
  clearRunningDemo(demos[activeIdx.value].name)
  if (_tvmPollTimer) clearTimeout(_tvmPollTimer)
})
</script>

<style scoped>
.audio-dsp-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  padding: 18px;
  overflow: hidden;
}
/* Page header */
.page-hdr { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-shrink:0; }
.ph-left  { display:flex; align-items:center; gap:14px; }
.ph-icon  { width:50px; height:50px; border-radius:50%; flex-shrink:0; background:radial-gradient(circle at 40% 40%,#1a3a7a,#0a1540); border:2px solid #1d4ed8; display:flex; align-items:center; justify-content:center; }
.ph-title { font-size:21px; font-weight:800; color:rgb(var(--v-theme-on-background)); margin-bottom:3px; }
.ph-sub   { font-size:13px; color:#64748b; }
.run-btn  { font-weight:600; letter-spacing:0; text-transform:none; }

/* Content grid */
.content-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 14px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Cards */
.ti-card {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
  border-radius: 12px !important;
  padding: 16px !important;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}
.card-ttl { font-size:12.5px; font-weight:700; color:rgb(var(--v-theme-on-surface)); }

/* Demo selector items */
.dsi { display:flex; align-items:center; gap:11px; padding:11px 12px; border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); border-radius:9px; cursor:pointer; transition:all .15s; flex-shrink:0; }
.dsi:hover  { border-color:#4da6ff; background:rgba(77,166,255,0.05); }
.dsi.active { border-color:#4da6ff; background:rgba(77,166,255,0.09); }
.dsi-ic { width:36px; height:36px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.dsi-txt { flex:1; min-width:0; }
.dsi-name { font-size:13px; font-weight:600; color:rgb(var(--v-theme-on-surface)); }
.dsi-sub  { font-size:11px; color:#64748b; margin-top:2px; }
.dsi-arr  { color:#4da6ff; font-size:16px; flex-shrink:0; }

/* Demo panel */
.demo-panel { min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.demo-panel > * { flex: 1; min-height: 0; }

/* TVM preparing banner */
.preparing-alert { flex-shrink: 0; }
.preparing-txt   { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.preparing-spinner {
  display: inline-block;
  animation: spin 1.2s linear infinite;
  font-size: 16px;
  line-height: 1;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Demo switch transition */
.demo-fade-enter-active,
.demo-fade-leave-active { transition: opacity 0.12s ease; }
.demo-fade-enter-from,
.demo-fade-leave-to    { opacity: 0; }
</style>
