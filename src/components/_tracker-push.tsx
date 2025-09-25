'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'ref',
  'aff_id',
  'click_id',
]

function parseQueryParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search)
  const result: Record<string, string> = {}

  for (const key of PARAM_KEYS) {
    const value = params.get(key)
    if (value) result[key] = value
  }

  return result
}

function parseFromExternalKwai(): Record<string, string> {
  const result: Record<string, string> = {}
  const key = Object.keys(localStorage).find(k =>
    k.startsWith('KWAI_UTM_TRACK_')
  )

  if (key) {
    const value = localStorage.getItem(key)
    if (value) {
      const parts = value.split('::')
      if (parts.length > 1) {
        result.utm_source = value
        result.click_id = parts[1]
      }
    }
  }
  return result
}

export function useTrackedRouter() {
  const router = useRouter()

  function captureCurrentParams() {
    const currentUrl = new URL(window.location.href)
    const allParams: Record<string, string> = {}

    for (const [key, value] of currentUrl.searchParams) {
      allParams[key] = value
    }

    if (Object.keys(allParams).length > 0) {
      localStorage.setItem('tracked_params', JSON.stringify(allParams))
      console.log('📊 Parâmetros atualizados na URL e salvos:', allParams)
      return allParams
    }

    return null
  }

  useEffect(() => {
    captureCurrentParams()

    const handleUrlChange = () => {
      captureCurrentParams()
    }

    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = (...args) => {
      originalPushState.apply(history, args)
      setTimeout(handleUrlChange, 200)
    }

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args)
      setTimeout(handleUrlChange, 200)
    }

    window.addEventListener('popstate', handleUrlChange)

    let lastObserverHref = window.location.href
    const urlObserver = new MutationObserver(() => {
      const currentHref = window.location.href
      if (lastObserverHref !== currentHref) {
        lastObserverHref = currentHref
        setTimeout(handleUrlChange, 100)
      }
    })

    urlObserver.observe(document, { subtree: true, childList: true })

    let lastCheckerHref = window.location.href
    const urlChecker = setInterval(() => {
      if (lastCheckerHref !== window.location.href) {
        lastCheckerHref = window.location.href
        handleUrlChange()
      }
    }, 2000)

    return () => {
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      window.removeEventListener('popstate', handleUrlChange)
      urlObserver.disconnect()
      clearInterval(urlChecker)
    }
  }, [])

  function pushWithParams(path: string) {
    let stored = localStorage.getItem('tracked_params')

    if (!stored) {
      const captured = captureCurrentParams()
      if (captured) {
        stored = JSON.stringify(captured)
      }
    }

    if (!stored) return router.push(path)

    const params = JSON.parse(stored)
    const query = new URLSearchParams(params).toString()
    const finalUrl = path.includes('?')
      ? `${path}&${query}`
      : `${path}?${query}`

    router.push(finalUrl)
  }

  return { push: pushWithParams }
}

export function useUrlParamMonitor() {
  useEffect(() => {
    const updateParams = () => {
      const current = parseQueryParams()
      const external = parseFromExternalKwai()

      const final = {
        ...external,
        ...current,
      }

      if (Object.keys(final).length > 0) {
        localStorage.setItem('tracked_params', JSON.stringify(final))
      }
    }

    updateParams()

    const observer = new MutationObserver(updateParams)
    observer.observe(document.body, { childList: true, subtree: true })

    const interval = setInterval(updateParams, 1000)

    return () => {
      clearInterval(interval)
      observer.disconnect()
    }
  }, [])
}
