export const Loader = (() => {
  let overlay,
    spinner,
    errElement

  function show () {
    overlay.classList.remove('opacity-0', 'pointer-events-none')
    overlay.classList.add('opacity-100', 'pointer-events-auto')
    spinner.classList.remove('hidden')
    errElement.classList.add('hidden')
  }

  function hide (delayMs = 0, errMs = null) {
    setTimeout(() => {
      overlay.classList.remove('opacity-100', 'pointer-events-auto')
      overlay.classList.add('opacity-0', 'pointer-events-none')
      spinner.classList.add('hidden')
    }, delayMs)

    if (errMs !== null) {
      error(errMs)
    }
  }

  function error (message) {
    errElement.textContent = message
    errElement.classList.remove('hidden')
  }

  function register (spinnerId, overlayId, errorId) {
    overlay = document.getElementById(overlayId)
    spinner = document.getElementById(spinnerId)
    errElement = document.getElementById(errorId)
  }

  return { show, hide, error, register }
})()
