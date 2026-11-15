/** Vite's `?raw` import: the file's text, bundled into main (the print helper script). */
declare module '*?raw' {
  const content: string
  export default content
}

/** electron-vite's `?asset` import: the file is copied to the build and this is its path at runtime. */
declare module '*?asset' {
  const path: string
  export default path
}
