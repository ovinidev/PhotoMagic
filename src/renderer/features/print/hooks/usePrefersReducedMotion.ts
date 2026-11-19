import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Whether Windows asks for reduced motion, kept live. Without `matchMedia` (jsdom) it is `false`. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(QUERY)
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}
