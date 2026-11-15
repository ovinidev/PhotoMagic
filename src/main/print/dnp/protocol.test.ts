import { describe, expect, it } from 'vitest'
import { encodeRequest, helperCommand, parseResponseLine, printResponseSchema, RESPONSE_PREFIX } from './protocol'

describe('helper protocol', () => {
  it('writes one ASCII line per request, escaping accents', () => {
    const line = encodeRequest(7, {
      action: 'print',
      printer: 'DNP DS-RX1',
      jpegPath: 'C:\\Users\\Op\\Desktop\\Aniversário AJ\\21-45-08.jpg',
      copies: 2,
      documentName: 'Foto Mágica 21-45-08.jpg',
      settings: [],
    })
    expect(line.endsWith('\n')).toBe(true)
    expect(line.trimEnd()).not.toMatch(/[^\x20-\x7e]/)
    expect(line).toContain('Anivers\\u00e1rio AJ')
    expect(JSON.parse(line)).toMatchObject({ id: 7, action: 'print', jpegPath: 'C:\\Users\\Op\\Desktop\\Aniversário AJ\\21-45-08.jpg', copies: 2 })
  })

  it('reads only prefixed lines with an id', () => {
    expect(parseResponseLine(`${RESPONSE_PREFIX}{"id":3,"ok":true}`)).toEqual({ id: 3, payload: { id: 3, ok: true } })
    expect(parseResponseLine('{"id":3,"ok":true}')).toBeNull()
    expect(parseResponseLine(`${RESPONSE_PREFIX}not json`)).toBeNull()
    expect(parseResponseLine(`${RESPONSE_PREFIX}{"ok":true}`)).toBeNull()
  })

  it('parses a rejected setting with what the driver chose instead', () => {
    const parsed = printResponseSchema.parse({ ok: false, stage: 'rejected', message: 'x', role: 'cut', got: { ns: 'n', name: 'Option1' } })
    expect(parsed).toMatchObject({ stage: 'rejected', role: 'cut', got: { name: 'Option1' } })
  })
})

describe('helperCommand', () => {
  it('runs Windows PowerShell 5.1 from System32 with no profile and no prompt', () => {
    const { file, args } = helperCommand('C:\\x\\dnp-helper.ps1', 'C:\\WINDOWS')
    expect(file).toBe('C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
    expect(args.slice(0, 6)).toEqual(['-NoLogo', '-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass'])
    expect(args[6]).toBe('-EncodedCommand')
  })

  it('loads the script by path, quoting apostrophes and keeping accents (UTF-16 base64)', () => {
    const { args } = helperCommand("C:\\Users\\D'Ávila\\AppData\\Roaming\\Foto Mágica\\helpers\\dnp-helper.ps1")
    const decoded = Buffer.from(args[7]!, 'base64').toString('utf16le')
    expect(decoded).toContain("ReadAllText('C:\\Users\\D''Ávila\\AppData\\Roaming\\Foto Mágica\\helpers\\dnp-helper.ps1'")
    expect(decoded).toContain('[ScriptBlock]::Create(')
  })
})
