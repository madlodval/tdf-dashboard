export function fullscreenCharts (callback) {
  const root = document.body

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      if (typeof callback === 'function') {
        callback()
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange)

  if (!document.fullscreenElement) {
    root.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`)
    })
  } else {
    document.exitFullscreen()
  }
}
