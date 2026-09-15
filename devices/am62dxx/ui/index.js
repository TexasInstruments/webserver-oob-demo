import AudioDsp       from './views/AudioDsp.vue'
import DspCompute     from './views/DspCompute.vue'
import ModelInspector from './views/ModelInspector.vue'

export const routes = [
  { path: '/audio-dsp',       component: AudioDsp       },
  { path: '/dsp-compute',     component: DspCompute     },
  { path: '/model-inspector', component: ModelInspector },
]

export const navItems = [
  {
    section: 'Demos',
    items: [
      { icon: 'mdi-waveform',   title: 'Audio Intelligence', to: '/audio-dsp'   },
      { icon: 'mdi-chart-bar',  title: 'DSP Acceleration',              to: '/dsp-compute' },
    ],
  },
  {
    section: 'Tools',
    items: [
      { icon: 'mdi-magnify', title: 'AI Model Inspector', to: '/model-inspector' },
    ],
  },
]

export const connectedLabel = 'AM62D EVM'

export const deviceTitle = { white: 'SITARA AM62D ', blue: 'DSP + Edge AI Experience Portal' }

export const heroDesc = 'Explore real-time audio analytics and AI demos showcasing the power of the TI AM62D platform with C7x DSP acceleration.'

export const heroButton = { label: 'Get Started', to: '/audio-dsp' }

export const demoCards = [
  {
    to: '/audio-dsp', name: 'Audio Intelligence',
    desc: 'Real-time audio analytics powered by the C7x DSP — AI-enabled noise reduction, speech enhancement, and acoustic event detection.',
    icon: 'mdi-waveform',
    iconBg: 'radial-gradient(circle at 40% 40%,#1a3a7a,#0a1540)', iconBorder: '#1d4ed8', iconColor: '#60a5fa',
  },
  {
    to: '/dsp-compute', name: 'DSP Acceleration',
    desc: 'High-performance C7x DSP compute demos — 2D FFT, biquad filter chain, and workload offload via RPMsg-DMA.',
    icon: 'mdi-chart-bar',
    iconBg: 'radial-gradient(circle at 40% 40%,#3a1a00,#1f0d00)', iconBorder: '#d97706', iconColor: '#fbbf24',
  },
  {
    to: '/model-inspector', name: 'AI Model Inspector',
    desc: 'Upload and browse AI model inspection reports — view model architecture, layer details, and performance metrics for AM62D deployments.',
    icon: 'mdi-magnify',
    iconBg: 'radial-gradient(circle at 40% 40%,#3b1c68,#1e0d40)', iconBorder: '#7c3aed', iconColor: '#c084fc',
  },
]

export const sdkInfo = [
  { label: 'SDK Version',      version: '12.01.00.04', icon: 'mdi-application-brackets-outline', iconBg: 'rgba(37,99,235,0.2)',   iconBd: '1px solid rgba(37,99,235,0.4)',   iconColor: '#60a5fa' },
  { label: 'MCU+ SDK Version', version: '12.01.00.20', icon: 'mdi-chip',                         iconBg: 'rgba(5,150,105,0.2)',   iconBd: '1px solid rgba(5,150,105,0.4)',   iconColor: '#34d399' },
  { label: 'TIDL Version',     version: '11.02.16.00', icon: 'mdi-code-braces',                  iconBg: 'rgba(124,58,237,0.2)',  iconBd: '1px solid rgba(124,58,237,0.4)',  iconColor: '#c084fc' },
]

export const chipImages = {
  dark:  '/am62d-chip-dark.png',
  light: '/am62d-chip-light.png',
}

export const aboutText = 'This portal runs on the AM62D EVM. Use the sidebar to navigate demos and monitor system status in real time.'
