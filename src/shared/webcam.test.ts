import { describe, expect, it } from 'vitest'
import { NO_WEBCAM_CAPABILITIES, clampToRange, readWebcamCapabilities, webcamConstraintSet } from './webcam'

const BRIO = {
  width: { min: 1, max: 1920 },
  brightness: { min: 0, max: 255, step: 1 },
  contrast: { min: 0, max: 255, step: 1 },
  saturation: { min: 0, max: 255, step: 1 },
  sharpness: { min: 0, max: 255, step: 1 },
  colorTemperature: { min: 2000, max: 7500, step: 10 },
  whiteBalanceMode: ['manual', 'continuous'],
  iso: { min: 0, max: 255, step: 1 },
  hue: { min: -180, max: 180 },
}

describe('readWebcamCapabilities (RF15)', () => {
  it('keeps only the controls the panel draws, under the capability name the camera uses', () => {
    const caps = readWebcamCapabilities(BRIO)
    expect(Object.keys(caps.controls)).toEqual(['brightness', 'contrast', 'saturation', 'sharpness', 'colorTemperature', 'gain'])
    expect(caps.controls.gain).toEqual({ key: 'iso', min: 0, max: 255, step: 1 })
    expect(caps.whiteBalanceModes).toEqual(['continuous', 'manual'])
    expect(caps.powerLineFrequency).toBe(false)
  })

  it('draws backlight only when the camera has it, and fixes power-line frequency at 60 Hz', () => {
    const caps = readWebcamCapabilities({ ...BRIO, backlightCompensation: { min: 0, max: 1, step: 1 }, powerLineFrequency: [50, 60] })
    expect(caps.controls.backlightCompensation).toEqual({ key: 'backlightCompensation', min: 0, max: 1, step: 1 })
    expect(webcamConstraintSet({ controls: {} }, caps)).toEqual({ powerLineFrequency: 60 })
  })

  it('reads nothing from a fixture camera or a broken object', () => {
    expect(readWebcamCapabilities({ width: { min: 1, max: 640 }, brightness: { min: 5, max: 5 } })).toEqual(NO_WEBCAM_CAPABILITIES)
    expect(readWebcamCapabilities(undefined)).toEqual(NO_WEBCAM_CAPABILITIES)
  })
})

describe('webcamConstraintSet (RF15)', () => {
  const caps = readWebcamCapabilities(BRIO)

  it('clamps saved values to the advertised ranges and skips what the camera lacks', () => {
    const set = webcamConstraintSet({ controls: { brightness: 300, gain: 12.4, backlightCompensation: 1 }, whiteBalanceMode: 'continuous' }, caps)
    expect(set).toEqual({ whiteBalanceMode: 'continuous', brightness: 255, iso: 12 })
  })

  it('applies the color temperature only in manual white balance', () => {
    expect(webcamConstraintSet({ controls: { colorTemperature: 4005 }, whiteBalanceMode: 'manual' }, caps)).toEqual({ whiteBalanceMode: 'manual', colorTemperature: 4010 })
    expect(webcamConstraintSet({ controls: { colorTemperature: 4000 }, whiteBalanceMode: 'continuous' }, caps)).toEqual({ whiteBalanceMode: 'continuous' })
  })

  it('rounds to the step inside the range', () => {
    expect(clampToRange(7, { min: 0, max: 10, step: 4 })).toBe(8)
    expect(clampToRange(-3, { min: 0, max: 10, step: 4 })).toBe(0)
  })
})
