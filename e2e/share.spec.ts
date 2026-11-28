import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { expect, test } from './fixtures'
import { PRINT_TIMEOUT, startEvent, takePhotos } from './event'
import { E2E_SHARE_PORT, enableShare } from './share'

test.describe('offline photo download (DESIGN §17)', () => {
  test('after Imprimir the TV shows the Wi-Fi and photo QR codes, and the link serves the 3 original photos, not the montage', async ({ app, operatorWindow, dirs }) => {
    await enableShare(operatorWindow, { ssid: 'Festa;1', password: 'a:b' })
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    await expect(tv.getByTestId('share-qr')).toHaveCount(0)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })

    await expect(tv.getByText('1. Conecte-se ao Wi-Fi')).toBeVisible()
    await expect(tv.getByText('2. Escaneie para baixar')).toBeVisible()
    await expect(tv.getByTestId('share-qr-wifi')).toHaveAttribute('data-qr-text', String.raw`WIFI:T:WPA;S:Festa\;1;P:a\:b;;`)
    await expect(tv.getByTestId('share-qr-link').locator('img')).toBeVisible()
    const url = await tv.getByTestId('share-qr-link').getAttribute('data-qr-text')
    expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${E2E_SHARE_PORT}/p/[A-Za-z0-9_-]{22}$`))

    const page = await fetch(url!)
    expect(page.status).toBe(200)
    const html = await page.text()
    for (const n of [1, 2, 3]) {
      expect(html).toContain(`Baixar foto ${n}`)
      const photo = await fetch(`${url}/foto-${n}.jpg`)
      expect(photo.headers.get('content-type')).toBe('image/jpeg')
      // The capture as the camera took it: not the 1844×1240 sheet with the template.
      const meta = await sharp(Buffer.from(await photo.arrayBuffer())).metadata()
      expect(`${meta.width}x${meta.height}`).not.toBe('1844x1240')
    }
    expect((await fetch(`${url}/foto.jpg`)).status).toBe(404)
    // The originals are kept next to the montage, in Originais/.
    expect(readdirSync(join(dirs.desktop, 'Festa', 'Originais')).sort()).toEqual(expect.arrayContaining([expect.stringMatching(/_1\.jpg$/), expect.stringMatching(/_3\.jpg$/)]))
    expect((await fetch(`http://127.0.0.1:${E2E_SHARE_PORT}/`)).status).toBe(404)

    // A new round takes the link off the TV; the phone that has it can still download.
    await tv.getByRole('button', { name: 'Nova rodada' }).click()
    await expect(tv.getByTestId('share-qr')).toHaveCount(0)
    expect((await fetch(url!)).status).toBe(200)
  })
  test('during an event the laptop shows the event gallery QR, and the gallery lists the montage until Encerrar evento', async ({ app, operatorWindow }) => {
    await enableShare(operatorWindow, { ssid: 'Festa', password: 'festa2026' })
    await expect(operatorWindow.getByTestId('event-gallery-qr')).toHaveCount(0)
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })

    const footer = operatorWindow.getByTestId('event-gallery-qr')
    await expect(footer).toBeVisible()
    await expect(footer.getByTestId('event-gallery-qr-wifi')).toHaveAttribute('data-qr-text', 'WIFI:T:WPA;S:Festa;P:festa2026;;')
    const url = await footer.getByTestId('event-gallery-qr-link').getAttribute('data-qr-text')
    expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${E2E_SHARE_PORT}/e/[A-Za-z0-9_-]{22}$`))
    expect(await (await fetch(url!)).text()).toContain('Ainda não há fotos')

    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    // The guest QR codes on the TV are untouched by the laptop's gallery QR.
    await expect(tv.getByTestId('share-qr-link')).toBeVisible()

    const html = await (await fetch(url!)).text()
    const file = html.match(/\/e\/[A-Za-z0-9_-]{22}\/f\/(\d{2}-\d{2}-\d{2}(?:-\d+)?\.jpg)\/1/)?.[1]
    expect(file).toBeTruthy()
    expect(html).toContain('3 fotos.')
    expect(html).toContain('Baixar foto 3')
    const photo = await fetch(`${url}/f/${file}/2`)
    expect(photo.headers.get('content-type')).toBe('image/jpeg')
    const meta = await sharp(Buffer.from(await photo.arrayBuffer())).metadata()
    expect(`${meta.width}x${meta.height}`).not.toBe('1844x1240')
    expect((await fetch(`${url}/t/${file}/2`)).status).toBe(200)
    // The montage itself is never served to guests.
    expect((await fetch(`${url}/f/${file}`)).status).toBe(404)
    expect((await fetch(`${url}/f/..%2F${file}/1`)).status).toBe(404)
    // The same link for the whole event.
    await tv.getByRole('button', { name: 'Nova rodada' }).click()
    await expect(footer.getByTestId('event-gallery-qr-link')).toHaveAttribute('data-qr-text', url!)

    await operatorWindow.getByRole('button', { name: 'Encerrar evento' }).click()
    await expect(operatorWindow.getByRole('heading', { name: 'Novo evento' })).toBeVisible()
    await expect(operatorWindow.getByTestId('event-gallery-qr')).toHaveCount(0)
    expect((await fetch(url!)).status).toBe(404)
  })
})
