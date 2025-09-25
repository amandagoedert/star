// lib/tracking.ts
// Configurações
const GTM_ID = 'GTM-XXXXXXX' // Seu GTM ID (se tiver)
const FACEBOOK_PIXEL_ID = '737534842059451'

// Importação dinâmica para evitar SSR issues
const loadTagManager = async () => {
  if (typeof window !== 'undefined') {
    const TagManager = (await import('react-gtm-module')).default
    return TagManager
  }
  return null
}

const loadReactPixel = async () => {
  if (typeof window !== 'undefined') {
    const ReactPixel = (await import('react-facebook-pixel')).default
    return ReactPixel
  }
  return null
}

// Inicializar Google Tag Manager
export const initGTM = async () => {
  const TagManager = await loadTagManager()
  if (TagManager) {
    TagManager.initialize({
      gtmId: GTM_ID,
    })
  }
}

// Inicializar Facebook Pixel
export const initFacebookPixel = async () => {
  const ReactPixel = await loadReactPixel()
  if (ReactPixel) {
    const options = {
      autoConfig: true,
      debug: process.env.NODE_ENV === 'development',
    }

    ReactPixel.init(FACEBOOK_PIXEL_ID, undefined, options)
    ReactPixel.pageView()
  }
}

// Google Ads Conversion
export const fireGoogleConversion = (data: {
  value?: number
  currency?: string
  transactionId?: string
}) => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  if (typeof window !== 'undefined' && (window as any).gtag) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ;(window as any).gtag('event', 'conversion', {
      send_to: 'AW-17235208421/zvnNCLq22OQaEOXRsZpA',
      value: data.value || 197.9,
      currency: data.currency || 'BRL',
      transaction_id: data.transactionId || `order_${Date.now()}`,
    })
    console.log('✅ Google Ads conversion fired')
  }
}

// Facebook Purchase Event
export const fireFacebookPurchase = async (data: {
  value?: number
  currency?: string
  contentIds?: string[]
  contentName?: string
}) => {
  const ReactPixel = await loadReactPixel()
  if (ReactPixel) {
    ReactPixel.track('Purchase', {
      value: data.value || 197.9,
      currency: data.currency || 'BRL',
      content_type: 'product',
      content_ids: data.contentIds || ['chip-infinity'],
      content_name: data.contentName || 'Chip Infinity M3',
      num_items: 1,
    })
    console.log('✅ Facebook Purchase event fired')
  }
}

// Disparar todas as conversões
export const fireAllConversions = async (
  data: {
    value?: number
    currency?: string
    transactionId?: string
    contentIds?: string[]
    contentName?: string
  } = {}
) => {
  fireGoogleConversion({
    value: data.value,
    currency: data.currency,
    transactionId: data.transactionId,
  })

  await fireFacebookPurchase({
    value: data.value,
    currency: data.currency,
    contentIds: data.contentIds,
    contentName: data.contentName,
  })
}
