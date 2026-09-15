<template>
  <div class="mi-page">

    <!-- Page header -->
    <div class="page-hdr">
      <div class="ph-left">
        <div class="ph-icon">
          <v-icon size="22" color="blue-lighten-2">mdi-magnify</v-icon>
        </div>
        <div>
          <div class="ph-title">AI Model Inspector</div>
          <div class="ph-sub">Browse and inspect AI models deployed on the AM62D platform via TIDL inference engine.</div>
        </div>
      </div>
      <span class="ph-badge">TIDL Runtime</span>
    </div>

    <!-- Inspector grid: model list | detail -->
    <div class="inspector-grid">

      <!-- Left: model list -->
      <div class="panel">
        <div class="panel-hdr">
          <span class="panel-ttl">Available Models</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="model-count">{{ models.length }} model{{ models.length !== 1 ? 's' : '' }}</span>
            <v-btn
              icon size="x-small" variant="outlined" density="compact"
              title="Refresh" @click="loadModelList"
            >
              <v-icon size="14">mdi-refresh</v-icon>
            </v-btn>
            <v-btn
              size="x-small" color="primary" variant="flat"
              prepend-icon="mdi-upload" @click="openUpload"
            >Upload</v-btn>
          </div>
        </div>
        <div class="model-list">
          <div
            v-for="(m, i) in models" :key="i"
            class="model-card" :class="{ selected: selectedIdx === i }"
            @click="selectModel(i)"
          >
            <div class="mc-icon" :style="{ background: m.iconBg, border: `1.5px solid ${m.iconBorder}`, color: m.iconColor }" v-html="m._icon" />
            <div class="mc-body">
              <div class="mc-name">{{ m.name }}</div>
              <div class="mc-meta">
                <span class="mc-type">{{ m.type }}</span>
              </div>
            </div>
            <div class="mc-latency">{{ m.badge }}</div>
          </div>
          <div v-if="models.length === 0" class="empty-list">No models found</div>
        </div>
      </div>

      <!-- Right: model detail -->
      <div class="detail-panel">
        <div v-if="selectedIdx === null" class="empty-state">
          <v-icon size="56" style="opacity:0.3">mdi-magnify</v-icon>
          <h3>Select a model to inspect</h3>
          <p>Click any model from the list to view its full Edge AI Model Inspector report.</p>
        </div>
        <iframe
          v-else
          ref="frameEl"
          :src="models[selectedIdx]?.file"
          class="model-frame"
          @load="onFrameLoad"
        />
      </div>

    </div>

    <!-- Upload dialog -->
    <v-dialog v-model="uploadDialog" max-width="430" :scrim-opacity="0.72">
      <v-card class="upload-card" rounded="lg">
        <div class="upload-hdr">
          <div style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;">
            <v-icon color="primary" size="17">mdi-upload</v-icon>
            Upload Model
          </div>
          <v-btn icon size="small" variant="text" @click="uploadDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </div>

        <!-- Drop zone -->
        <div
          class="drop-zone"
          :class="{ 'drop-zone--hover': dropHover }"
          @click="$refs.fileInput.click()"
          @dragover.prevent="dropHover = true"
          @dragleave="dropHover = false"
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" accept=".html,.htm" style="display:none" @change="onFileSelected" />
          <v-icon size="26" color="#475569">mdi-file-upload-outline</v-icon>
          <div class="drop-label" :class="{ 'drop-label--file': uploadFile }">
            {{ uploadFile ? uploadFile.name : 'Click or drag model HTML file here' }}
          </div>
          <div style="font-size:11px;color:#334155;margin-top:3px;">Edge AI Model Inspector HTML export</div>
        </div>

        <!-- Fields -->
        <div style="padding:0 20px;">
          <div class="upload-field">
            <label class="field-lbl">Model Name</label>
            <input v-model="uploadName" class="field-input" type="text" placeholder="e.g. MobileNet v2" />
          </div>
          <div style="margin-bottom:18px;">
            <label class="field-lbl">Task Type</label>
            <select v-model="uploadType" class="field-select">
              <option>Audio Classification</option>
              <option>Speech Enhancement</option>
              <option>Audio Feature Extraction</option>
              <option>Other</option>
            </select>
          </div>

          <div v-if="uploadStatus" class="upload-status" :class="uploadStatusType">{{ uploadStatus }}</div>

          <v-btn
            block color="primary" variant="flat" size="large"
            :disabled="uploadBusy" :loading="uploadBusy"
            prepend-icon="mdi-upload"
            style="margin-bottom:20px;"
            @click="doUpload"
          >Upload &amp; Add to Inspector</v-btn>
        </div>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'

/* ── Static model definitions ── */
const ICON_GRID = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`
const ICON_BOX  = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 3l-4 4-4-4"/><rect x="7" y="11" width="4" height="4"/><rect x="13" y="11" width="4" height="4"/></svg>`
const ICON_YOLO = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/></svg>`
const ICON_UPL  = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>`

const MODELS_STATIC = [
  { name: 'GCRN', type: 'Speech Enhancement', badge: 'TVM+TIDL',
    iconBg: 'radial-gradient(circle at 40% 40%,#1a2a4a,#0a1530)', iconBorder: '#2563eb', iconColor: '#93c5fd',
    file: '/Model-Inspector/GCRN.html', _icon: ICON_GRID },
  { name: 'YAMNet', type: 'Audio Classification', badge: 'TIDL',
    iconBg: 'radial-gradient(circle at 40% 40%,#1a2a4a,#0a1530)', iconBorder: '#2563eb', iconColor: '#93c5fd',
    file: '/Model-Inspector/YAMNet.html', _icon: ICON_GRID },
  { name: 'VGGish', type: 'Audio Classification', badge: 'TIDL',
    iconBg: 'radial-gradient(circle at 40% 40%,#1a2a4a,#0a1530)', iconBorder: '#2563eb', iconColor: '#93c5fd',
    file: '/Model-Inspector/VGGish.html', _icon: ICON_GRID },
]

const STATIC_BY_FILE = {}
MODELS_STATIC.forEach(m => { STATIC_BY_FILE[m.file.split('/').pop()] = m })

const UPLOAD_META_KEY = 'mi-uploaded-models'
function getUploadedMeta() {
  try { return JSON.parse(localStorage.getItem(UPLOAD_META_KEY) || '{}') } catch { return {} }
}
function saveUploadedMeta(filename, meta) {
  const all = getUploadedMeta()
  all[filename] = meta
  localStorage.setItem(UPLOAD_META_KEY, JSON.stringify(all))
}

/* ── State ── */
const models      = ref([])
const selectedIdx = ref(null)
const frameEl     = ref(null)

/* Upload */
const uploadDialog  = ref(false)
const uploadFile    = ref(null)
const uploadName    = ref('')
const uploadType    = ref('Audio Classification')
const uploadStatus  = ref('')
const uploadStatusType = ref('')
const uploadBusy    = ref(false)
const dropHover     = ref(false)
const fileInput     = ref(null)

/* ── Theme sync ── */
const vuetifyTheme = useTheme()

function applyThemeToFrame() {
  try {
    const d = frameEl.value?.contentDocument
    if (!d) return
    const t = vuetifyTheme.global.name.value === 'tiLight' ? 'light' : 'dark'
    d.documentElement.setAttribute('data-theme', t)
  } catch (_) {}
}

watch(() => vuetifyTheme.global.name.value, applyThemeToFrame)

/* ── Helpers ── */
/* ── Load model list ── */
async function loadModelList() {
  let serverFiles = null
  try {
    const r = await fetch('/model-inspector-list')
    if (r.ok) { const d = await r.json(); serverFiles = d.files || null }
  } catch (_) {}

  const uploadedMeta = getUploadedMeta()

  if (serverFiles) {
    const serverSet = new Set(serverFiles)
    const result = []
    MODELS_STATIC.forEach(m => {
      if (serverSet.has(m.file.split('/').pop())) result.push({ ...m })
    })
    serverFiles.forEach(fname => {
      if (STATIC_BY_FILE[fname]) return
      const meta = uploadedMeta[fname] || {}
      result.push({
        name:    meta.name  || fname.replace(/\.html?$/i, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type:    meta.type  || 'AI Model',
        badge:   'Uploaded',
        iconBg:  'radial-gradient(circle at 40% 40%,#0a2d2d,#051a1a)',
        iconBorder: '#0891b2', iconColor: '#22d3ee',
        file:    '/Model-Inspector/' + fname,
        _icon:   ICON_UPL,
      })
    })
    models.value = result
  } else {
    // Server endpoint unavailable — show nothing rather than phantom models
    models.value = []
  }

  if (models.value.length > 0 && selectedIdx.value === null) selectModel(0)
}

function selectModel(i) {
  selectedIdx.value = i
}

/* ── Iframe style injection ── */
function onFrameLoad() {
  const frame = frameEl.value
  if (!frame) return
  try {
    const d = frame.contentDocument
    if (!d || !d.head) return
    const st = d.createElement('style')
    st.textContent = [
      '.visualization-container{flex-direction:row!important;height:calc(100vh - 200px)!important;}',
      '.canvas-wrapper{flex:1!important;min-width:250px!important;height:100%!important;}',
      '.details-panel{width:30%!important;min-width:280px!important;height:100%!important;}',
      '.logo{flex-shrink:0;}',
      '.header-model-name-center{position:static!important;left:auto!important;transform:none!important;flex:1!important;text-align:center!important;overflow:hidden!important;min-width:0!important;}',
      '.header-model-name-center .model-name{max-width:100%!important;}',
      '.tab span{display:inline!important;}',
      '.header-container{flex-direction:row!important;align-items:center!important;flex-wrap:wrap!important;}',
      '.main-tabs{overflow-x:auto;}',
    ].join('')
    d.head.appendChild(st)
    const sc = d.createElement('script')
    sc.textContent = '(function(){var B=1280;function r(){var s=window.top.innerWidth/B;document.documentElement.style.zoom=s<1?s:"";}r();window.addEventListener("resize",r);})();'
    d.head.appendChild(sc)
  } catch (_) {}
  applyThemeToFrame()
}

/* ── Upload ── */
function openUpload() {
  uploadFile.value   = null
  uploadName.value   = ''
  uploadType.value   = 'Audio Classification'
  uploadStatus.value = ''
  uploadBusy.value   = false
  uploadDialog.value = true
}

function onFileSelected(evt) {
  const f = evt.target.files[0]
  if (!f) return
  uploadFile.value = f
  uploadName.value = f.name.replace(/\.html?$/i, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function onDrop(evt) {
  dropHover.value = false
  const f = evt.dataTransfer?.files[0]
  if (!f) return
  uploadFile.value = f
  uploadName.value = f.name.replace(/\.html?$/i, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

async function doUpload() {
  if (!uploadFile.value) {
    uploadStatus.value = 'Select an HTML file first.'
    uploadStatusType.value = 'status-err'
    return
  }
  uploadBusy.value   = true
  uploadStatus.value = 'Uploading...'
  uploadStatusType.value = ''
  try {
    const buf = await uploadFile.value.arrayBuffer()
    const r = await fetch('/upload-model-file?filename=' + encodeURIComponent(uploadFile.value.name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buf,
    })
    if (!r.ok) throw new Error('Server returned HTTP ' + r.status)
    saveUploadedMeta(uploadFile.value.name, {
      name:  uploadName.value.trim() || uploadFile.value.name.replace(/\.html?$/i, ''),
      type:  uploadType.value,
    })
    uploadStatus.value = 'Uploaded successfully!'
    uploadStatusType.value = 'status-ok'
    setTimeout(() => { uploadDialog.value = false; loadModelList() }, 800)
  } catch (e) {
    uploadStatus.value = 'Upload failed: ' + e.message
    uploadStatusType.value = 'status-err'
    uploadBusy.value = false
  }
}

onMounted(loadModelList)
</script>

<style scoped>
.mi-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

/* ── Page header ── */
.page-hdr  { display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
.ph-left   { display:flex; align-items:center; gap:14px; }
.ph-icon   {
  width:50px; height:50px; border-radius:50%; flex-shrink:0;
  background: radial-gradient(circle at 40% 40%,#1a3a7a,#0a1540);
  border: 2px solid #1d4ed8; color: #60a5fa;
  display:flex; align-items:center; justify-content:center;
}
.ph-title  { font-size:21px; font-weight:800; color:rgb(var(--v-theme-on-surface)); margin-bottom:3px; }
.ph-sub    { font-size:13px; color:#64748b; }
.ph-badge  {
  background: rgba(77,166,255,0.1); border: 1px solid rgba(77,166,255,0.3);
  color:#4da6ff; font-size:11px; font-weight:700; padding:4px 12px; border-radius:20px;
}

/* ── Inspector grid ── */
.inspector-grid {
  display: grid;
  grid-template-columns: 310px 1fr;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

/* ── Model list panel ── */
.panel {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-hdr {
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  display: flex; align-items:center; justify-content:space-between; flex-shrink:0;
}
.panel-ttl   { font-size:14px; font-weight:700; color:rgb(var(--v-theme-on-surface)); }
.model-count { font-size:11px; color:#64748b; background:rgb(var(--v-theme-surface-variant)); padding:3px 8px; border-radius:10px; }

.model-list  { flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px; }
.empty-list  { text-align:center; color:#475569; font-size:13px; padding:24px 0; }

.model-card {
  display:flex; align-items:center; gap:12px;
  padding:12px; border:1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius:10px;
  cursor:pointer; transition:all 0.15s;
}
.model-card:hover    { border-color:#4da6ff; background:rgba(77,166,255,0.04); }
.model-card.selected { border-color:#4da6ff; background:rgba(77,166,255,0.09); }

.mc-icon    { width:40px; height:40px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.mc-body    { flex:1; min-width:0; }
.mc-name    { font-size:13px; font-weight:600; color:rgb(var(--v-theme-on-surface)); margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mc-meta    { display:flex; align-items:center; gap:6px; }
.mc-type    { font-size:11px; color:#64748b; }
.mc-latency { font-size:12px; font-weight:700; color:#94a3b8; flex-shrink:0; }

/* ── Detail panel ── */
.detail-panel {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.empty-state {
  flex:1; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:12px;
  color:#475569; text-align:center; padding:40px;
}
.empty-state h3 { font-size:15px; color:#64748b; }
.empty-state p  { font-size:13px; }

.model-frame { width:100%; flex:1; border:none; min-height:0; display:block; height:100%; }

/* ── Upload dialog ── */
.upload-card { background:rgb(var(--v-theme-surface)) !important; }
.upload-hdr  { display:flex; align-items:center; justify-content:space-between; padding:20px 20px 16px; color:rgb(var(--v-theme-on-surface)); }

.drop-zone {
  margin: 0 20px 16px;
  border: 1.5px dashed #1e3a5f;
  background: rgb(var(--v-theme-background));
  border-radius: 8px; padding: 20px; text-align: center; cursor: pointer;
  transition: border-color 0.15s;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.drop-zone--hover { border-color: #3b82f6; }
.drop-label        { font-size:13px; color:#64748b; word-break:break-all; }
.drop-label--file  { color: rgb(var(--v-theme-on-surface)); }

.upload-field  { margin-bottom:12px; }
.field-lbl     { display:block; font-size:11px; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.8px; }
.field-input, .field-select {
  width:100%; background:rgb(var(--v-theme-background));
  border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));
  color:rgb(var(--v-theme-on-surface)); font-size:13px; padding:8px 10px;
  border-radius:6px; outline:none; box-sizing:border-box;
}
.field-select { cursor:pointer; }

.upload-status    { min-height:18px; font-size:12px; margin-bottom:12px; text-align:center; }
.status-ok        { color: #22c55e; }
.status-err       { color: #ef4444; }
</style>
