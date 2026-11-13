import { computed, ref, watchEffect } from 'vue'
import en from '../content/en.json'
import id from '../content/id.json'

export type Language = 'en' | 'id'

function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem('language')
    if (saved === 'en' || saved === 'id') return saved
  } catch {
    // Storage may be unavailable.
  }
  return 'en'
}

const language = ref<Language>(getInitialLanguage())

watchEffect(() => {
  document.documentElement.lang = language.value
})

export function useLanguage() {
  function setLanguage(next: Language) {
    language.value = next
    try {
      localStorage.setItem('language', next)
    } catch {
      // Storage may be unavailable.
    }
  }

  const text = computed(() => (language.value === 'id' ? id : en))

  return { language, setLanguage, text }
}
