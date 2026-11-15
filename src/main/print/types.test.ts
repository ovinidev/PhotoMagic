import { describe, expect, it } from 'vitest'
import { ticketFor } from './types'

describe('ticketFor (RF11)', () => {
  it('asks for the cut in 2 tiras', () => {
    expect(ticketFor('C:\\a.jpg', 2, 'two-strips')).toEqual({ jpegPath: 'C:\\a.jpg', copies: 2, mode: 'two-strips', cut: true })
  })

  it('asks for no cut in 1 tira', () => {
    expect(ticketFor('C:\\a.jpg', 1, 'one-strip')).toEqual({ jpegPath: 'C:\\a.jpg', copies: 1, mode: 'one-strip', cut: false })
  })
})
