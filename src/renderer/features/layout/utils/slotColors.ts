import type { PhotoIndex } from '@shared/layout'

/**
 * Card colors by photo number, as in the current app's editor (green 1, blue 2, yellow 3; Figure 4),
 * so the operator reads "which photo goes where" at a glance. Translucent, the template shows through.
 */
export const PHOTO_COLORS: Record<PhotoIndex | 'none', { fill: string; ink: string }> = {
  1: { fill: 'rgba(134, 239, 172, 0.78)', ink: '#14532d' },
  2: { fill: 'rgba(147, 197, 253, 0.78)', ink: '#1e3a8a' },
  3: { fill: 'rgba(253, 230, 138, 0.82)', ink: '#713f12' },
  none: { fill: 'rgba(214, 211, 209, 0.6)', ink: '#57534e' },
}

export const photoColor = (photo: PhotoIndex | null) => PHOTO_COLORS[photo ?? 'none']
