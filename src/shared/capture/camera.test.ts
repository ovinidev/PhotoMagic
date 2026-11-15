import { describe, expect, it } from 'vitest'
import { cameraConstraints, selectCamera, videoInputs } from './camera'

const mic = { deviceId: 'mic', kind: 'audioinput', label: 'Logitech MX Brio Microphone' }
const integrated = { deviceId: 'int', kind: 'videoinput', label: 'Integrated Webcam' }
const brio = { deviceId: 'brio', kind: 'videoinput', label: 'Logitech MX Brio (046d:0944)' }
const obs = { deviceId: 'obs', kind: 'videoinput', label: 'OBS Virtual Camera' }

describe('selectCamera', () => {
  it('prefers the camera whose label contains MX Brio, wherever it is listed', () => {
    expect(selectCamera([mic, integrated, obs, brio])).toBe(brio)
  })

  it('matches the label case-insensitively', () => {
    const lower = { ...brio, label: 'logitech mx brio' }
    expect(selectCamera([integrated, lower])).toBe(lower)
  })

  it('never picks an audio device, even one named MX Brio', () => {
    expect(selectCamera([mic, integrated])).toBe(integrated)
  })

  it('falls back to the first video input without a Brio, or before permission fills the labels', () => {
    expect(selectCamera([obs, integrated])).toBe(obs)
    expect(selectCamera([mic, { ...integrated, label: '' }, { ...brio, label: '' }])).toEqual({ ...integrated, label: '' })
  })

  it('returns null without any camera', () => {
    expect(selectCamera([mic])).toBeNull()
    expect(selectCamera([])).toBeNull()
  })
})

describe('videoInputs', () => {
  it('keeps the system order', () => {
    expect(videoInputs([integrated, mic, brio])).toEqual([integrated, brio])
  })
})

describe('cameraConstraints', () => {
  it('asks for 3840×2160 at 30 fps, without audio, as ideals so a smaller camera still opens', () => {
    expect(cameraConstraints(null)).toEqual({
      audio: false,
      video: { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 } },
    })
  })

  it('pins the chosen device exactly', () => {
    expect(cameraConstraints('brio').video.deviceId).toEqual({ exact: 'brio' })
  })
})
