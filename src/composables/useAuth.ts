import { readonly, ref } from 'vue'
import { supabase } from '../lib/supabase'

const signedIn = ref<boolean | null>(supabase ? null : false)

supabase?.auth.onAuthStateChange((_event, session) => {
  signedIn.value = Boolean(session)
})

/**
 * Shared reactive authentication state derived from the Supabase session listener.
 */
export function useAuth() {
  return {
    signedIn: readonly(signedIn),
  }
}
