import type { DisplayInfo } from '@shared/displays'
import type { DisplayFixture } from '@shared/runtime'
import type { DisplaySource } from './displaySource'

const LAPTOP: DisplayInfo = { id: 1, primary: true, x: 0, y: 0, width: 1920, height: 1080 }

/** E2E monitors (DESIGN §3): the laptop at 1920×1080 plus the TV, in portrait or landscape, or no TV. */
export const DISPLAY_FIXTURES: Record<DisplayFixture, DisplayInfo[]> = {
  'portrait-tv': [LAPTOP, { id: 2, primary: false, x: 1920, y: 0, width: 1080, height: 1920 }],
  'landscape-tv': [LAPTOP, { id: 3, primary: false, x: 1920, y: 0, width: 1920, height: 1080 }],
  'laptop-only': [LAPTOP],
}

export type FixtureDisplaySource = DisplaySource & {
  /** Simulates plugging, unplugging or rotating the TV at runtime. */
  set: (fixture: DisplayFixture) => void
}

export function createFixtureDisplaySource(initial: DisplayFixture): FixtureDisplaySource {
  let current = initial
  const listeners: Array<() => void> = []
  return {
    list: () => DISPLAY_FIXTURES[current].map((display) => ({ ...display })),
    onChange: (listener) => {
      listeners.push(listener)
    },
    set: (fixture) => {
      current = fixture
      for (const listener of listeners) listener()
    },
  }
}
