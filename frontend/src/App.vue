<template>
  <v-app :theme="theme">

    <!-- ── NAVIGATION DRAWER (sidebar) ── -->
    <v-navigation-drawer permanent width="222" :border="0">
      <div class="sidebar-brand">
        <div class="ti-logo">
          <img src="/ti-logo.png" alt="TI" />
        </div>
        <div>
          <div class="brand-main">TI SITARA</div>
          <div class="brand-sub">DSP + EDGE AI<br>EXPERIENCE PORTAL</div>
        </div>
      </div>

      <v-list density="compact" nav class="sidebar-nav">
        <v-list-item
          prepend-icon="mdi-home-outline"
          title="Home"
          to="/home"
          class="nav-item"
        />

        <template v-for="group in navItems" :key="group.section">
          <v-list-subheader class="nav-lbl">{{ group.section }}</v-list-subheader>
          <v-list-item
            v-for="item in group.items"
            :key="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            :to="item.to"
            class="nav-item"
          />
        </template>

        <v-list-subheader class="nav-lbl">System</v-list-subheader>

        <v-list-item
          prepend-icon="mdi-monitor"
          title="Device Info"
          class="nav-item"
          @click="openDeviceInfo"
        />
        <v-list-item
          prepend-icon="mdi-file-document-outline"
          title="Logs"
          to="/logs"
          class="nav-item"
        />
        <v-list-item
          prepend-icon="mdi-help-circle-outline"
          title="Help"
          href="https://e2e.ti.com/support/processors/"
          target="_blank"
          class="nav-item"
        />
      </v-list>
    </v-navigation-drawer>

    <!-- ── APP BAR (top navbar) ── -->
    <v-app-bar flat height="62" :border="'b'">
      <template #append>
        <div class="conn-block">
          <div class="conn-row">
            <span class="conn-dot" :class="isConnected ? 'conn-dot-ok' : 'conn-dot-err'" />
            <span class="conn-txt">{{ isConnected ? `Connected to ${connectedLabel}` : 'Disconnected' }}</span>
          </div>
          <div class="conn-ip">{{ hostname }}</div>
        </div>

        <v-divider vertical class="mx-3" style="height:32px;align-self:center;" />

        <v-tooltip text="Reboot EVM" location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-restart"
              variant="tonal"
              size="small"
              color="warning"
              class="mr-1"
              @click="confirmAction('reboot')"
            />
          </template>
        </v-tooltip>

        <v-tooltip text="Power Off EVM" location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-power"
              variant="tonal"
              size="small"
              color="error"
              class="mr-2"
              @click="confirmAction('poweroff')"
            />
          </template>
        </v-tooltip>

        <v-divider vertical class="mr-3" style="height:32px;align-self:center;" />

        <v-btn
          :icon="theme === 'tiDark' ? 'mdi-weather-night' : 'mdi-weather-sunny'"
          variant="tonal"
          size="small"
          color="primary"
          class="mr-2"
          @click="toggleTheme"
        />
      </template>
    </v-app-bar>

    <!-- ── MAIN CONTENT ── -->
    <v-main style="height:100vh;overflow:hidden;">
      <div style="height:100%;display:flex;flex-direction:column;overflow:hidden;">
        <div style="flex:1;overflow:hidden;">
          <router-view v-slot="{ Component }">
            <Transition name="page-fade" mode="out-in">
              <component :is="Component" :key="$route.path" />
            </Transition>
          </router-view>
        </div>

        <!-- ── STATUS BAR (footer) ── -->
        <div class="statusbar">
          <div class="sb-item">
            <v-icon size="13">mdi-clock-outline</v-icon>
            Uptime: <span>{{ stats.uptime.value }}</span>
          </div>
          <div class="sb-item">
            CPU Load: <span>{{ stats.cpu.value }}%</span>
            <div class="bar-t"><div class="bar-f g" :style="{ transform: 'scaleX(' + stats.cpu.value / 100 + ')' }" /></div>
          </div>
          <div class="sb-item">
            RAM: <span class="sb-ram">{{ stats.ramUsed.value }} / {{ stats.ramFree.value }}</span>
          </div>
          <div class="sb-spacer" />
          <span class="sb-version">v{{ appVersion }}&ensp;&middot;&ensp;{{ buildDate }}</span>
          <span class="sb-copy">&copy; 2026 Texas Instruments Incorporated</span>
          <a
            href="https://software-dl.ti.com/processor-sdk-linux/esd/AM62DX/latest/exports/docs/devices/AM62DX/index.html"
            target="_blank"
            class="sb-doc"
          >
            Documentation
            <v-icon size="11">mdi-open-in-new</v-icon>
          </a>
        </div>
      </div>
    </v-main>

    <!-- ── DEVICE INFO DIALOG ── -->
    <v-dialog v-model="deviceInfoOpen" max-width="460" :scrim-opacity="0.72">
      <v-card class="sys-card" rounded="lg">
        <div class="sys-hdr">
          <div style="display:flex;align-items:center;gap:10px;">
            <v-icon color="primary" size="18">mdi-monitor</v-icon>
            <span>Device Info</span>
          </div>
          <v-btn icon size="small" variant="text" @click="deviceInfoOpen = false">
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </div>
        <div class="sys-body">
          <div v-for="row in deviceRows" :key="row.label" class="sys-row">
            <span class="sys-lbl">{{ row.label }}</span>
            <span class="sys-val">{{ row.value }}</span>
          </div>
        </div>
      </v-card>
    </v-dialog>


    <!-- ── DISCONNECT OVERLAY ── -->
    <div v-if="showDisconnect" class="disc-overlay">
      <div class="disc-box">
        <div class="disc-icon">
          <v-icon size="36" color="error">mdi-lan-disconnect</v-icon>
        </div>
        <div class="disc-title">Connection Lost</div>
        <div class="disc-msg">Lost connection to the {{ connectedLabel }}.<br>Attempting to reconnect…</div>
        <div class="disc-spin">
          <v-progress-circular indeterminate color="primary" size="28" width="2" />
          <span class="disc-sec">Retrying in {{ reconnectSec }}s</span>
        </div>
      </div>
    </div>

    <!-- ── POWER CONTROL DIALOG ── -->
    <v-dialog v-model="powerDialog" max-width="360" persistent>
      <v-card class="sys-card" rounded="lg">
        <div class="sys-hdr">
          <div style="display:flex;align-items:center;gap:10px;">
            <v-icon :color="powerTarget === 'poweroff' ? 'error' : 'warning'" size="18">
              {{ powerTarget === 'poweroff' ? 'mdi-power' : 'mdi-restart' }}
            </v-icon>
            <span>{{ powerTarget === 'poweroff' ? 'Power Off EVM?' : 'Reboot EVM?' }}</span>
          </div>
          <v-btn icon size="small" variant="text" @click="powerDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </div>
        <div class="sys-body" style="padding-bottom:8px;">
          <p style="font-size:13px;color:#94a3b8;line-height:1.65;padding:8px 0;">
            {{ powerTarget === 'poweroff'
              ? 'The EVM will shut down immediately. Physical access is required to power it back on.'
              : 'The EVM will restart. The portal will be unavailable for ~30 seconds, then reconnect automatically.'
            }}
          </p>
          <v-alert v-if="powerMsg" :type="powerMsgType" density="compact" variant="tonal" class="mb-2">{{ powerMsg }}</v-alert>
        </div>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="!!powerLoading" @click="powerDialog = false">Cancel</v-btn>
          <v-btn
            :color="powerTarget === 'poweroff' ? 'error' : 'warning'"
            variant="flat"
            :loading="!!powerLoading"
            @click="doPowerAction"
          >Confirm</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import { useCpuStats } from '@/composables/useCpuStats'
import { navItems, connectedLabel } from '@device/index.js'
import { runningDemoSnapshot } from '@/composables/useDemoSession'

const vuetifyTheme = useTheme()
const saved = localStorage.getItem('theme')
const theme = ref(saved === 'tiLight' ? 'tiLight' : 'tiDark')
vuetifyTheme.global.name.value = theme.value
const stats = useCpuStats()
const hostname = window.location.hostname

/* eslint-disable no-undef */
const appVersion = __APP_VERSION__
const buildDate  = new Date(__BUILD_DATE__).toISOString().slice(0, 10)
/* eslint-enable no-undef */

/* ── Connection health ── */
const isConnected    = ref(true)
const showDisconnect = ref(false)
const reconnectSec   = ref(0)
let _healthWs = null
let _reconnectTimer = null
let _countdownTimer = null
let _everConnected = false

function initHealth() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (_healthWs) { try { _healthWs.close() } catch (_) {} _healthWs = null }
  const ws = new WebSocket(`${proto}//${location.host}/health`)
  _healthWs = ws
  ws.onopen = () => {
    const wasDisconnected = !isConnected.value
    _everConnected = true
    isConnected.value = true
    showDisconnect.value = false
    clearTimeout(_reconnectTimer)
    clearInterval(_countdownTimer)
    if (wasDisconnected) { location.reload() }
  }
  ws.onclose = () => {
    if (_healthWs !== ws) return
    _healthWs = null
    isConnected.value = false
    if (_everConnected) showDisconnect.value = true
    clearTimeout(_reconnectTimer)
    clearInterval(_countdownTimer)
    reconnectSec.value = 5
    _countdownTimer = setInterval(() => {
      if (reconnectSec.value > 0) reconnectSec.value--
    }, 1000)
    _reconnectTimer = setTimeout(() => {
      clearInterval(_countdownTimer)
      initHealth()
    }, 5000)
  }
  ws.onerror = () => {}
}

function confirmBrowserExit(event) {
  if (!runningDemoSnapshot()) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  initHealth()
  window.addEventListener('beforeunload', confirmBrowserExit)
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', confirmBrowserExit)
  clearTimeout(_reconnectTimer)
  clearInterval(_countdownTimer)
  if (_healthWs) { try { _healthWs.close() } catch (_) {} }
})

function toggleTheme() {
  theme.value = theme.value === 'tiDark' ? 'tiLight' : 'tiDark'
  vuetifyTheme.global.name.value = theme.value
  localStorage.setItem('theme', theme.value)
}

/* ── Device Info dialog ── */
const deviceInfoOpen = ref(false)
const devData = ref({ displayName: '', board: '', soc: '', ip: window.location.hostname })

const deviceRows = computed(() => [
  { label: 'Device',     value: devData.value.displayName || '—' },
  { label: 'Board',      value: devData.value.board       || '—' },
  { label: 'SoC',        value: devData.value.soc         || '—' },
  { label: 'IP Address', value: devData.value.ip          || '—' },
  { label: 'Port',       value: window.location.port || '80'     },
  { label: 'Uptime',     value: stats.uptime.value                },
])

async function openDeviceInfo() {
  deviceInfoOpen.value = true
  try {
    const d = await fetch('/device-info').then(r => r.json())
    devData.value.displayName = d.displayName || d.id || ''
    devData.value.board       = (d.boards && d.boards[0]?.name) || d.board || ''
    devData.value.soc         = d.soc || ''
  } catch (_) {}
}

/* ── Power control ── */
const powerDialog  = ref(false)
const powerTarget  = ref('')
const powerLoading = ref('')
const powerMsg     = ref('')
const powerMsgType = ref('success')

function confirmAction(action) {
  powerTarget.value  = action
  powerMsg.value     = ''
  powerLoading.value = ''
  powerDialog.value  = true
}

async function doPowerAction() {
  const action = powerTarget.value
  powerLoading.value = action
  powerMsg.value     = ''
  try {
    const res = await fetch(`/system/${action}`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    powerMsgType.value = 'success'
    powerMsg.value = action === 'reboot'
      ? 'Rebooting… portal will reconnect automatically.'
      : 'Powering off… the EVM is shutting down.'
  } catch (e) {
    powerMsgType.value = 'error'
    powerMsg.value     = `Failed: ${e.message}`
    powerLoading.value = ''
  }
}

</script>

<style>
/* Global overrides to match TI design token colors */
.v-navigation-drawer {
  background: rgb(var(--v-theme-surface)) !important;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}
.v-app-bar {
  background: rgb(var(--v-theme-surface)) !important;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}
</style>

<style scoped>
/* Sidebar layout */
.sidebar-brand { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); min-height:62px; height:auto; flex-shrink:0; }
.ti-logo { width:38px; height:38px; border-radius:8px; background:white; display:flex; align-items:center; justify-content:center; flex-shrink:0; padding:3px; }
.ti-logo img { width:100%; height:100%; object-fit:contain; }
.brand-main { font-size:15px; font-weight:700; color:rgb(var(--v-theme-on-surface)); line-height:1.2; }
.brand-sub  { font-size:9.5px; font-weight:700; color:#4da6ff; letter-spacing:1.5px; line-height:1.5; }

/* Sidebar nav */
.sidebar-nav { padding: 8px 0; }
.nav-lbl :deep(.v-list-subheader__text) { font-size:10px; font-weight:700; color:#475569; letter-spacing:1.8px; text-transform:uppercase; }
.nav-item :deep(.v-list-item__content) { font-size:13.5px; }
.nav-item :deep(.v-list-item__prepend .v-icon) { font-size:15px; }

/* Connection block (app bar top-right) */
.conn-block { text-align:right; margin-right:4px; }
.conn-row { display:flex; align-items:center; gap:7px; font-size:13px; margin-bottom:2px; }
.conn-dot     { width:8px; height:8px; border-radius:50%; flex-shrink:0; display:inline-block; }
.conn-dot-ok  { background:#22c55e; box-shadow:0 0 8px #22c55e; animation:pulse 2s infinite; }
.conn-dot-err { background:#ef4444; box-shadow:0 0 8px #ef4444; }
.conn-txt { color:rgb(var(--v-theme-on-surface)); white-space:nowrap; }
.conn-ip  { font-size:11px; color:#64748b; text-align:right; }
@keyframes pulse { 0%,100%{box-shadow:0 0 4px #22c55e} 50%{box-shadow:0 0 14px #22c55e} }

/* Status bar */
.statusbar { background:rgb(var(--v-theme-surface)); border-top:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); height:42px; padding:0 20px; display:flex; align-items:center; gap:20px; flex-shrink:0; font-size:12px; }
.sb-item   { display:flex; align-items:center; gap:7px; color:#94a3b8; white-space:nowrap; }
.bar-t { width:58px; height:5px; background:rgb(var(--v-theme-surface-variant)); border-radius:3px; overflow:hidden; }
.bar-f { height:100%; border-radius:3px; transform-origin:left; transition:transform 1s ease; }
.bar-f.g { background:linear-gradient(90deg,#16a34a,#4ade80); }
.sb-ram    { color:#c084fc; font-weight:600; }
.sb-spacer { flex:1; }
.sb-version { color:#475569; font-size:11px; font-family:monospace; white-space:nowrap; }
.sb-copy   { color:#475569; font-size:12px; }
.sb-doc    { color:#4da6ff; text-decoration:none; display:flex; align-items:center; gap:4px; font-size:12px; }
.sb-doc:hover { color:#93c5fd; }

/* System dialogs */
.sys-card { background:rgb(var(--v-theme-surface)) !important; }
.sys-hdr  { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 14px; font-size:15px; font-weight:700; color:rgb(var(--v-theme-on-surface)); border-bottom:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); }
.sys-body { padding:14px 20px 20px; display:flex; flex-direction:column; gap:0; }
.sys-row  { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); font-size:13px; }
.sys-row:last-child { border-bottom:none; }
.sys-lbl  { color:#64748b; }
.sys-val  { color:rgb(var(--v-theme-on-surface)); font-weight:500; }

/* Disconnect overlay */
.disc-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9999;display:flex;align-items:center;justify-content:center; }
.disc-box   { background:#0d1117;border:1px solid rgba(239,68,68,0.4);border-radius:16px;padding:40px 48px;display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center;max-width:420px; }
.disc-icon  { width:72px;height:72px;border-radius:50%;background:rgba(239,68,68,0.1);border:2px solid rgba(239,68,68,0.35);display:flex;align-items:center;justify-content:center; }
.disc-title { font-size:20px;font-weight:700;color:#f1f5f9; }
.disc-msg   { font-size:13px;color:#94a3b8;line-height:1.7; }
.disc-spin  { display:flex;align-items:center;gap:12px;margin-top:4px; }
.disc-sec   { font-size:13px;color:#64748b; }

/* Page transition */
.page-fade-enter-active,
.page-fade-leave-active { transition: opacity 0.15s ease; }
.page-fade-enter-from,
.page-fade-leave-to    { opacity: 0; }
</style>
