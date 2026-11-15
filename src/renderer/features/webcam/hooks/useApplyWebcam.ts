import { useEffect, useMemo } from 'react'
import { readWebcamCapabilities, webcamConstraintSet } from '@shared/webcam'
import { useWebcamState } from './useWebcamState'

/** The parts of a `MediaStreamTrack` this hook uses, so tests can pass a stand-in. */
export type AdjustableTrack = {
  getCapabilities?: () => unknown
  applyConstraints: (constraints: { advanced: Array<Record<string, number | string>> }) => Promise<void>
}

/**
 * TV side of the webcam adjustments (DESIGN §5): reads the open track's capabilities, reports them
 * to main (or `null` with no camera), and applies the saved values whenever the track or the values
 * change, including right after the camera opens. A rejected constraint is logged, never thrown.
 */
export function useApplyWebcam(track: AdjustableTrack | null): void {
  const view = useWebcamState()
  const capabilities = useMemo(() => (track ? readWebcamCapabilities(track.getCapabilities?.()) : null), [track])

  useEffect(() => {
    window.fotomagica.webcam.report({ capabilities })
  }, [capabilities])

  const values = view.status === 'ready' ? view.value.values : null
  useEffect(() => {
    if (!track || !capabilities || !values) return
    const set = webcamConstraintSet(values, capabilities)
    if (Object.keys(set).length === 0) return
    track.applyConstraints({ advanced: [set] }).catch((error: unknown) => console.warn('[webcam] constraints rejected', error))
  }, [track, capabilities, values])
}
