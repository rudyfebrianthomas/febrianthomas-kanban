import '@fontsource/sniglet/400.css'
import '@fontsource/sniglet/800.css'
import 'lenis/dist/lenis.css'
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')
