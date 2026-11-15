/** Vite's `?raw` import: the file's text, bundled into main (the print helper script). */
declare module '*?raw' {
  const content: string
  export default content
}
