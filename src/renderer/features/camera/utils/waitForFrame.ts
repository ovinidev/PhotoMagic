type VideoLike = Pick<HTMLVideoElement, 'readyState' | 'videoWidth' | 'addEventListener' | 'removeEventListener'>

/** `HTMLMediaElement.HAVE_CURRENT_DATA`, inlined so tests need no DOM constant. */
const HAVE_CURRENT_DATA = 2

/**
 * Resolves once the video has a decoded frame. Right after the stream goes live the element can
 * still be empty; a guest tapping at that instant must get a photo, not an error. Rejects after
 * `timeoutMs`, so a camera that never delivers still reports a failed capture.
 */
export function waitForFrame(video: VideoLike, timeoutMs = 3000): Promise<void> {
  const ready = () => video.readyState >= HAVE_CURRENT_DATA && video.videoWidth > 0
  if (ready()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const check = () => {
      if (!ready()) return
      cleanup()
      resolve()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('The camera has not delivered a frame yet'))
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      video.removeEventListener('loadeddata', check)
      video.removeEventListener('timeupdate', check)
    }
    video.addEventListener('loadeddata', check)
    video.addEventListener('timeupdate', check)
  })
}
