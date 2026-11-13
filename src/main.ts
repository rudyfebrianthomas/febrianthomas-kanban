import '@fontsource/bagel-fat-one/400.css'
import '@fontsource/sniglet/400.css'
import '@fontsource/sniglet/800.css'
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')
