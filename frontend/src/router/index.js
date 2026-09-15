import { createRouter, createWebHashHistory } from 'vue-router'
import { defineAsyncComponent } from 'vue'
const Home = defineAsyncComponent(() => import('@/views/Home.vue'))
const Logs = defineAsyncComponent(() => import('@/views/Logs.vue'))
import { routes as deviceRoutes } from '@device/index.js'
import { runningDemoSnapshot, stopRunningDemo } from '@/composables/useDemoSession'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',     redirect: '/home' },
    { path: '/home', component: Home  },
    ...deviceRoutes,
    { path: '/logs', component: Logs  },
  ],
})

router.beforeEach(async (to, from) => {
  if (to.path === from.path) return true
  const running = runningDemoSnapshot()
  if (!running) return true

  const confirmed = window.confirm(
    `“${running.name}” is currently running. Moving to another page will stop the demo. Continue?`
  )
  if (!confirmed) return false

  try {
    await stopRunningDemo()
    return true
  } catch (error) {
    window.alert(`Could not stop “${running.name}”: ${error.message || error}`)
    return false
  }
})

export default router
