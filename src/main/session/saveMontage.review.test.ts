import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { saveMontage } from './saveMontage'

it('writes the montage even when the event folder was removed mid-event', async () => {
  const folder = join(await mkdtemp(join(tmpdir(), 'fm-review-')), 'Festa da Júlia')
  await rm(folder, { recursive: true, force: true })
  await expect(saveMontage(folder, new Uint8Array([1, 2, 3]))).resolves.toMatchObject({ fileName: expect.stringMatching(/\.jpg$/) })
})
