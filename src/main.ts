import { inject } from '@vercel/analytics'
import { createApp } from 'vue'
import App from './App.vue'

// Vercel Web Analytics (cookieless page views). The Vue component in @vercel/analytics needs
// vue-router, which this app doesn't use, so the framework-neutral injector is used instead.
// In development it logs instead of sending.
inject()

createApp(App).mount('#app')
