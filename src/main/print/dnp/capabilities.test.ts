import { describe, expect, it } from 'vitest'
import { PSK, chooseCutOption, chooseMedia, chooseResolution, findCutFeature, planTicket, type Capabilities, type CapabilityFeature } from './capabilities'

const PRIVATE = 'http://schemas.dnp.example/2007/printschema'

const option = (ns: string, name: string, displayName: string | null = null, scored: Record<string, number> = {}) => ({ ns, name, displayName, scored })

const cutFeature: CapabilityFeature = {
  ns: PRIVATE,
  name: 'CutOption',
  displayName: '2inch cut',
  options: [option(PRIVATE, 'Option1', 'Disable'), option(PRIVATE, 'Option2', 'Enable (Printer V.1.10 or later)')],
}

/** What a DS-RX1 queue could plausibly report: the private cut, three media sizes, both orientations, two resolutions. */
const dsRx1: Capabilities = {
  features: [
    cutFeature,
    {
      ns: PSK,
      name: 'PageMediaSize',
      displayName: 'Paper Size',
      options: [
        option(PRIVATE, 'PC_5x7', '(5x7)', { MediaSizeWidth: 127_000, MediaSizeHeight: 177_800 }),
        option(PRIVATE, 'PC_6x4', '(6x4)', { MediaSizeWidth: 152_400, MediaSizeHeight: 104_000 }),
        option(PRIVATE, 'PC_6x8', '(6x8)', { MediaSizeWidth: 152_400, MediaSizeHeight: 203_200 }),
      ],
    },
    { ns: PSK, name: 'PageOrientation', displayName: 'Orientation', options: [option(PSK, 'Portrait'), option(PSK, 'Landscape')] },
    {
      ns: PSK,
      name: 'PageResolution',
      displayName: 'Resolution',
      options: [option(PRIVATE, 'Res300', '300x300', { ResolutionX: 300, ResolutionY: 300 }), option(PRIVATE, 'Res600', '300x600', { ResolutionX: 300, ResolutionY: 600 })],
    },
  ],
}

describe('the 2" cut (RF11)', () => {
  it('finds the driver feature shown as 2inch cut', () => {
    expect(findCutFeature(dsRx1)).toEqual({ ok: true, feature: cutFeature })
  })

  it('asks for Enable in 2 tiras and Disable in 1 tira', () => {
    expect(chooseCutOption(cutFeature, true)).toMatchObject({ ok: true, option: { name: 'Option2' } })
    expect(chooseCutOption(cutFeature, false)).toMatchObject({ ok: true, option: { name: 'Option1' } })
  })

  it('falls back to a single private feature mentioning cut', () => {
    const renamed = { ...cutFeature, displayName: 'Cutter' }
    expect(findCutFeature({ features: [renamed] })).toMatchObject({ ok: true, feature: { displayName: 'Cutter' } })
  })

  it('refuses when there is no cut setting, or more than one', () => {
    expect(findCutFeature({ features: [] })).toMatchObject({ ok: false })
    const twins = [
      { ...cutFeature, displayName: 'Cutter' },
      { ...cutFeature, name: 'Other', displayName: 'Cut mode' },
    ]
    expect(findCutFeature({ features: twins })).toMatchObject({ ok: false })
  })

  it('refuses when the option is missing or ambiguous', () => {
    expect(chooseCutOption({ ...cutFeature, options: [option(PRIVATE, 'Option1', 'Disable')] }, true)).toMatchObject({ ok: false })
    const both = [option(PRIVATE, 'a', 'Enable'), option(PRIVATE, 'b', 'Enable (V.1.10)')]
    expect(chooseCutOption({ ...cutFeature, options: both }, true)).toMatchObject({ ok: false })
  })

  it('does not read Disable as Enable', () => {
    expect(chooseCutOption({ ...cutFeature, options: [option(PRIVATE, 'Option1', 'Disable')] }, true)).toMatchObject({ ok: false })
  })
})

describe('paper and resolution', () => {
  it('picks 6x4 by its size, not its name, allowing a little bleed', () => {
    expect(chooseMedia(dsRx1)?.name).toBe('PC_6x4')
  })

  it('prefers the wide 6x4 over the tall 4x6 of the same size, and never the x 2 split, as the real DS-RX1 lists them', () => {
    const size = (width: number, height: number) => ({ MediaSizeWidth: width, MediaSizeHeight: height })
    const features = [
      {
        ns: PSK,
        name: 'PageMediaSize',
        displayName: null,
        options: [
          option(PRIVATE, 'PR_4x6', 'PR (4x6)', size(104_987, 156_125)),
          option(PRIVATE, 'PR_4x6x2', 'PR (4x6) x 2', size(104_987, 156_125)),
          option(PRIVATE, '_6x4x2', '(6x4) x 2', size(156_125, 104_987)),
          option(PRIVATE, 'PC', '(6x4)', size(156_125, 104_987)),
        ],
      },
    ]
    expect(chooseMedia({ features })?.name).toBe('PC')
  })

  it('accepts 6x4 declared either way round', () => {
    const features = [{ ns: PSK, name: 'PageMediaSize', displayName: null, options: [option(PRIVATE, 'x', null, { MediaSizeWidth: 101_600, MediaSizeHeight: 152_400 })] }]
    expect(chooseMedia({ features })?.name).toBe('x')
  })

  it('has no media without a size close to 6x4', () => {
    const features = [{ ns: PSK, name: 'PageMediaSize', displayName: null, options: [option(PRIVATE, 'a5', null, { MediaSizeWidth: 148_000, MediaSizeHeight: 210_000 })] }]
    expect(chooseMedia({ features })).toBeNull()
  })

  it('picks 300×300 DPI when offered', () => {
    expect(chooseResolution(dsRx1)?.name).toBe('Res300')
    expect(chooseResolution({ features: [] })).toBeNull()
  })
})

describe('planTicket', () => {
  it('2 tiras: cut Enable, 6x4, Portrait required; 300 DPI optional', () => {
    const plan = planTicket(dsRx1, true)
    expect(plan).toEqual({
      ok: true,
      settings: [
        { role: 'cut', feature: { ns: PRIVATE, name: 'CutOption' }, option: { ns: PRIVATE, name: 'Option2' }, required: true },
        { role: 'media', feature: { ns: PSK, name: 'PageMediaSize' }, option: { ns: PRIVATE, name: 'PC_6x4' }, required: true },
        { role: 'orientation', feature: { ns: PSK, name: 'PageOrientation' }, option: { ns: PSK, name: 'Portrait' }, required: true },
        { role: 'resolution', feature: { ns: PSK, name: 'PageResolution' }, option: { ns: PRIVATE, name: 'Res300' }, required: false },
      ],
    })
  })

  it('1 tira: cut Disable', () => {
    const plan = planTicket(dsRx1, false)
    expect(plan.ok && plan.settings[0]).toMatchObject({ role: 'cut', option: { name: 'Option1' } })
  })

  it('is cut-unavailable without the cut, before looking at anything else', () => {
    expect(planTicket({ features: [] }, true)).toMatchObject({ ok: false, reason: 'cut-unavailable' })
  })

  it('fails without 6x4 paper or Portrait', () => {
    const noMedia = { features: dsRx1.features.filter((f) => f.name !== 'PageMediaSize') }
    expect(planTicket(noMedia, true)).toMatchObject({ ok: false, reason: 'failed', detail: 'the driver does not offer 6x4 paper' })
    const noPortrait = { features: dsRx1.features.filter((f) => f.name !== 'PageOrientation') }
    expect(planTicket(noPortrait, true)).toMatchObject({ ok: false, reason: 'failed' })
  })

  it('leaves the resolution to the driver when 300×300 is not offered', () => {
    const plan = planTicket({ features: dsRx1.features.filter((f) => f.name !== 'PageResolution') }, true)
    expect(plan.ok && plan.settings.map((s) => s.role)).toEqual(['cut', 'media', 'orientation'])
  })
})
