import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const read = () => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches

/** Whether the system asks for reduced motion; follows changes live. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}
