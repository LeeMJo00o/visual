import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
console.log("test   2222")

const app = createApp(App)

app.use(createPinia())
console.log("test   3333")
import router from './router'

app.use(router)
app.use(ElementPlus)

app.mount('#app')
