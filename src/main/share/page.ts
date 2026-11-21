import { DOWNLOAD_FILE } from '@shared/share'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)

/** The guest's phone page: the montage and one big download button, pt-BR, no script, no external asset. */
export function sharePage(token: string, fileName: string): string {
  const src = `/p/${token}/${DOWNLOAD_FILE}`
  const name = escapeHtml(`foto-magica-${fileName}`)
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Foto Mágica</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; box-sizing: border-box; background: #111; color: #fff; font-family: system-ui, sans-serif; text-align: center; }
  h1 { margin: 8px 0 0; font-size: 24px; }
  img { width: 100%; max-width: 640px; border-radius: 12px; background: #222; }
  a { display: block; width: 100%; max-width: 640px; box-sizing: border-box; padding: 18px; border-radius: 999px; background: #fff; color: #111; font-size: 20px; font-weight: 700; text-decoration: none; }
  p { margin: 0; color: #bbb; font-size: 15px; }
</style>
</head>
<body>
<h1>Sua Foto Mágica</h1>
<img src="${src}" alt="Sua foto">
<a href="${src}" download="${name}">Baixar foto</a>
<p>Se o botão não funcionar, toque e segure a foto e escolha salvar.</p>
</body>
</html>`
}

/**
 * The event gallery on a phone (DESIGN §17): read-only, pt-BR, no script and no animation. One row
 * per montage of the event, newest first: a small thumbnail and a download link.
 */
export function galleryPage(token: string, eventName: string, fileNames: readonly string[]): string {
  const title = escapeHtml(eventName)
  const items = fileNames
    .map((fileName) => {
      const name = escapeHtml(fileName)
      const label = escapeHtml(fileName.replace(/\.jpg$/, '').replace(/^(\d{2})-(\d{2})-(\d{2})/, '$1:$2:$3'))
      return `<li>
<a class="thumb" href="/e/${token}/f/${name}"><img src="/e/${token}/t/${name}" alt="Foto das ${label}" loading="lazy" width="240" height="161"></a>
<a class="dl" href="/e/${token}/f/${name}" download="foto-magica-${name}">Baixar foto das ${label}</a>
</li>`
    })
    .join('\n')
  const body = fileNames.length ? `<ul>\n${items}\n</ul>` : '<p class="empty">Ainda não há fotos. Volte depois da primeira impressão.</p>'
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fotos: ${title}</title>
<style>
  body { margin: 0; padding: 16px; background: #111; color: #fff; font-family: system-ui, sans-serif; }
  h1 { margin: 4px 0 4px; font-size: 22px; }
  .sub { margin: 0 0 16px; color: #bbb; font-size: 14px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
  li { display: flex; flex-direction: column; gap: 8px; }
  .thumb img { display: block; width: 100%; max-width: 480px; height: auto; border-radius: 10px; background: #222; }
  .dl { display: block; max-width: 480px; box-sizing: border-box; padding: 14px; border-radius: 999px; background: #fff; color: #111; font-size: 17px; font-weight: 700; text-align: center; text-decoration: none; }
  .empty { color: #bbb; font-size: 16px; }
</style>
</head>
<body>
<h1>Fotos da festa ${title}</h1>
<p class="sub">${fileNames.length === 1 ? '1 foto' : `${fileNames.length} fotos`}. Rede local da festa, sem internet. Atualize a página para ver as novas.</p>
${body}
</body>
</html>`
}
