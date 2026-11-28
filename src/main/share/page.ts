import type { OriginalIndex } from '@shared/files'
import { photoFile } from '@shared/share'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)

/**
 * The guest's phone page: the round's original photos, as the camera took them (no template), each
 * with its own big download button. pt-BR, no script, no external asset.
 */
export function sharePage(token: string, fileName: string, indexes: readonly OriginalIndex[]): string {
  const base = escapeHtml(fileName.replace(/\.jpg$/, ''))
  const items = indexes
    .map((index) => {
      const src = `/p/${token}/${photoFile(index)}`
      return `<figure>
<img src="${src}" alt="Foto ${index}">
<a href="${src}" download="foto-magica-${base}-${index}.jpg">Baixar foto ${index}</a>
</figure>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Foto Mágica</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; box-sizing: border-box; background: #111; color: #fff; font-family: system-ui, sans-serif; text-align: center; }
  h1 { margin: 8px 0 0; font-size: 24px; }
  figure { margin: 0; width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: 12px; }
  img { width: 100%; border-radius: 12px; background: #222; }
  a { display: block; box-sizing: border-box; padding: 18px; border-radius: 999px; background: #fff; color: #111; font-size: 20px; font-weight: 700; text-decoration: none; }
  p { margin: 0; color: #bbb; font-size: 15px; }
</style>
</head>
<body>
<h1>Suas Fotos Mágicas</h1>
${items || '<p>As fotos desta rodada não estão disponíveis.</p>'}
<p>Se o botão não funcionar, toque e segure a foto e escolha salvar.</p>
</body>
</html>`
}

/**
 * The event gallery on a phone (DESIGN §17): read-only, pt-BR, no script and no animation. One group
 * per round, newest first, with its original photos: a small thumbnail and a download link each.
 */
export function galleryPage(token: string, eventName: string, rounds: readonly { fileName: string; indexes: readonly OriginalIndex[] }[]): string {
  const title = escapeHtml(eventName)
  const shown = rounds.filter((round) => round.indexes.length > 0)
  const photos = shown.reduce((sum, round) => sum + round.indexes.length, 0)
  const items = shown
    .map(({ fileName, indexes }) => {
      const name = escapeHtml(fileName)
      const base = escapeHtml(fileName.replace(/\.jpg$/, ''))
      const label = escapeHtml(fileName.replace(/\.jpg$/, '').replace(/^(\d{2})-(\d{2})-(\d{2})/, '$1:$2:$3'))
      const cells = indexes
        .map(
          (index) => `<li>
<a class="thumb" href="/e/${token}/f/${name}/${index}"><img src="/e/${token}/t/${name}/${index}" alt="Foto ${index} das ${label}" loading="lazy"></a>
<a class="dl" href="/e/${token}/f/${name}/${index}" download="foto-magica-${base}-${index}.jpg">Baixar foto ${index}</a>
</li>`,
        )
        .join('\n')
      return `<section>
<h2>Rodada das ${label}</h2>
<ul>
${cells}
</ul>
</section>`
    })
    .join('\n')
  const body = shown.length ? items : '<p class="empty">Ainda não há fotos. Volte depois da primeira impressão.</p>'
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fotos: ${title}</title>
<style>
  body { margin: 0; padding: 16px; background: #111; color: #fff; font-family: system-ui, sans-serif; }
  h1 { margin: 4px 0 4px; font-size: 22px; }
  h2 { margin: 20px 0 8px; font-size: 17px; color: #ddd; }
  .sub { margin: 0 0 8px; color: #bbb; font-size: 14px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  li { display: flex; flex-direction: column; gap: 6px; }
  .thumb img { display: block; width: 100%; height: auto; border-radius: 8px; background: #222; }
  .dl { display: block; box-sizing: border-box; padding: 10px 4px; border-radius: 999px; background: #fff; color: #111; font-size: 14px; font-weight: 700; text-align: center; text-decoration: none; }
  .empty { color: #bbb; font-size: 16px; }
</style>
</head>
<body>
<h1>Fotos da festa ${title}</h1>
<p class="sub">${photos === 1 ? '1 foto' : `${photos} fotos`}. Rede local da festa, sem internet. Atualize a página para ver as novas.</p>
${body}
</body>
</html>`
}
