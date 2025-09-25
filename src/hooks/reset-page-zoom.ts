import { useEffect } from 'react'

export const useResetPageZoom = (
  resetOnMount: boolean = true,
  restoreOnUnmount: boolean = false
) => {
  useEffect(() => {
    const originalZoom = document.body.style.zoom || '1'
    
    if (resetOnMount) {
      document.body.style.zoom = '1'
      
      document.body.style.transform = 'scale(1)'
      document.body.style.transformOrigin = 'top left'
      
      const viewport = document.querySelector('meta[name="viewport"]')
      if (viewport) {
        const originalContent = viewport.getAttribute('content')
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no')
        
        return () => {
          if (restoreOnUnmount && originalContent) {
            viewport.setAttribute('content', originalContent)
          }
        }
      }
    }

    return () => {
      if (restoreOnUnmount) {
        document.body.style.zoom = originalZoom
      }
    }
  }, [resetOnMount, restoreOnUnmount])

  const resetZoom = () => {
    document.body.style.zoom = '1'
  }

  const setZoom = (zoomLevel: number) => {
    document.body.style.zoom = zoomLevel.toString()
  }

  return { resetZoom, setZoom }
}

export const useResetZoom = () => {
  useEffect(() => {
    document.body.style.zoom = '1'
    
    window.dispatchEvent(new Event('resize'))
  }, [])
}

export const usePageZoom = () => {
  const resetZoom = () => {
    document.body.style.zoom = '1'
    window.dispatchEvent(new Event('resize'))
  }

  const setZoom = (level: number) => {
    document.body.style.zoom = level.toString()
    window.dispatchEvent(new Event('resize'))
  }

  const getZoom = (): number => {
    return parseFloat(document.body.style.zoom || '1')
  }

  return { resetZoom, setZoom, getZoom }
}