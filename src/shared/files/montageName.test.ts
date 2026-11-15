import { describe, expect, it } from 'vitest'
import { isMontageFileName, localTimeStamp, montageFileName } from './montageName'

// `new Date(y, m, d, h, min, s)` is local time, the same clock the file name uses.
const at = (hours: number, minutes: number, seconds: number) => new Date(2026, 10, 15, hours, minutes, seconds)

describe('localTimeStamp', () => {
  it('uses the local 24 h clock with hyphens and leading zeros', () => {
    expect(localTimeStamp(at(21, 45, 8))).toBe('21-45-08')
    expect(localTimeStamp(at(0, 0, 0))).toBe('00-00-00')
    expect(localTimeStamp(at(9, 5, 59))).toBe('09-05-59')
  })
})

describe('montageFileName', () => {
  it('names the first montage of a second HH-mm-ss.jpg', () => {
    expect(montageFileName(at(21, 45, 8), [])).toBe('21-45-08.jpg')
  })

  it('appends -2 and then -3 for montages in the same second', () => {
    expect(montageFileName(at(21, 45, 8), ['21-45-08.jpg'])).toBe('21-45-08-2.jpg')
    expect(montageFileName(at(21, 45, 8), ['21-45-08.jpg', '21-45-08-2.jpg'])).toBe('21-45-08-3.jpg')
  })

  it('fills a gap and ignores other seconds and case', () => {
    expect(montageFileName(at(21, 45, 8), ['21-45-08.JPG', '21-45-08-3.jpg', '21-45-07.jpg'])).toBe('21-45-08-2.jpg')
  })
})

describe('isMontageFileName', () => {
  it.each(['21-45-08.jpg', '00-00-00.jpg', '21-45-08-2.jpg', '21-45-08-12.jpg'])('accepts %j', (name) => {
    expect(isMontageFileName(name)).toBe(true)
  })

  it.each(['template.png', '21-45-08.png', '24-00-00.jpg', '21-60-00.jpg', '21-45-08-1.jpg', '21-45-08-02.jpg', 'foto 1.jpg'])(
    'rejects %j',
    (name) => {
      expect(isMontageFileName(name)).toBe(false)
    },
  )
})
