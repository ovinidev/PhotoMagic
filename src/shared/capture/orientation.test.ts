import { describe, expect, it } from 'vitest'
import { CAMERA_ROTATION_DEG } from '../constants'
import {
  applyMatrix,
  coverFit,
  frameTransform,
  normalizeRotation,
  orientationMatrix,
  orientedSize,
  type Matrix,
  type Size,
} from './orientation'

type Grid = string[][] // rows of pixels, grid[y][x]

/** Independent reference: rotate a grid 90° clockwise. */
function rotateClockwise(grid: Grid): Grid {
  const height = grid.length
  const width = grid[0]!.length
  return Array.from({ length: width }, (_, y) => Array.from({ length: height }, (_, x) => grid[height - 1 - x]![y]!))
}

function mirror(grid: Grid): Grid {
  return grid.map((row) => [...row].reverse())
}

function rotateBy(grid: Grid, degrees: number): Grid {
  let result = grid
  for (let turn = 0; turn < normalizeRotation(degrees) / 90; turn++) result = rotateClockwise(result)
  return result
}

/** Pushes every source pixel center through the matrix, like a canvas draw at 1:1. */
function resample(grid: Grid, matrix: Matrix, out: Size): Grid {
  const result: Grid = Array.from({ length: out.height }, () => Array.from({ length: out.width }, () => '?'))
  grid.forEach((row, y) =>
    row.forEach((pixel, x) => {
      const p = applyMatrix(matrix, { x: x + 0.5, y: y + 0.5 })
      result[Math.floor(p.y)]![Math.floor(p.x)] = pixel
    }),
  )
  return result
}

// A 3×2 landscape "sensor" whose pixels are all distinct, so any wrong pivot or flip shows.
const sensor: Grid = [
  ['a', 'b', 'c'],
  ['d', 'e', 'f'],
]
const sensorSize = { width: 3, height: 2 }

describe('normalizeRotation', () => {
  it('folds multiples of 90 into one turn', () => {
    expect(normalizeRotation(90)).toBe(90)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(-360)).toBe(0)
  })

  it('rejects angles that are not quarter turns', () => {
    expect(() => normalizeRotation(45)).toThrow(RangeError)
    expect(() => normalizeRotation(90.5)).toThrow(RangeError)
  })
})

describe('orientedSize', () => {
  it('turns the 4K landscape sensor into a 2160×3840 portrait', () => {
    expect(orientedSize({ width: 3840, height: 2160 }, CAMERA_ROTATION_DEG)).toEqual({ width: 2160, height: 3840 })
  })

  it('keeps the size on 0 and 180', () => {
    expect(orientedSize(sensorSize, 180)).toEqual(sensorSize)
    expect(orientedSize(sensorSize, 0)).toEqual(sensorSize)
  })
})

describe('orientationMatrix', () => {
  it.each([0, 90, 180, 270, -90])('rotates clockwise by %i° and then mirrors, pixel for pixel', (degrees) => {
    const expected = mirror(rotateBy(sensor, degrees))
    const out = orientedSize(sensorSize, degrees)
    expect(resample(sensor, orientationMatrix(sensorSize, degrees), out)).toEqual(expected)
  })

  it('with the shipped 90°, the sensor left edge becomes the top and the sensor top ends on the left', () => {
    // Rotation then mirror at 90° is a transpose: (x, y) → (y, x).
    expect(orientationMatrix({ width: 3840, height: 2160 }, CAMERA_ROTATION_DEG)).toEqual([0, 1, 1, 0, 0, 0])
    expect(resample(sensor, orientationMatrix(sensorSize, 90), { width: 2, height: 3 })).toEqual([
      ['a', 'd'],
      ['b', 'e'],
      ['c', 'f'],
    ])
  })

  it('flipping the sign of the rotation turns the image upside down', () => {
    const upright = resample(sensor, orientationMatrix(sensorSize, 90), { width: 2, height: 3 })
    const flipped = resample(sensor, orientationMatrix(sensorSize, -90), { width: 2, height: 3 })
    expect(flipped).toEqual(rotateBy(upright, 180))
  })
})

describe('coverFit', () => {
  it('fills a box of the same aspect exactly', () => {
    expect(coverFit({ width: 2160, height: 3840 }, { width: 1080, height: 1920 })).toEqual({ scale: 0.5, x: 0, y: 0 })
  })

  it('crops the overflowing axis in equal parts', () => {
    // A 3:4 portrait (from a 640×480 camera) on the 9:16 TV: sides cropped equally.
    const fit = coverFit({ width: 480, height: 640 }, { width: 1080, height: 1920 })
    expect(fit.scale).toBe(3)
    expect(fit.x).toBe(-180)
    expect(fit.y).toBe(0)
  })
})

describe('frameTransform', () => {
  const source = { width: 3840, height: 2160 }

  it('without a target, is the full-resolution orientation (the still)', () => {
    expect(frameTransform(source, CAMERA_ROTATION_DEG)).toEqual(orientationMatrix(source, CAMERA_ROTATION_DEG))
  })

  it('with a target, is the same orientation scaled into it (the preview)', () => {
    const preview = frameTransform(source, CAMERA_ROTATION_DEG, { width: 1080, height: 1920 })
    const still = frameTransform(source, CAMERA_ROTATION_DEG)
    // Any sensor point lands on the same relative spot in the preview and in the still.
    for (const point of [
      { x: 0, y: 0 },
      { x: 3840, y: 0 },
      { x: 1000, y: 2000 },
    ]) {
      const onStill = applyMatrix(still, point)
      const onPreview = applyMatrix(preview, point)
      expect(onPreview.x).toBeCloseTo(onStill.x / 2)
      expect(onPreview.y).toBeCloseTo(onStill.y / 2)
    }
  })
})
