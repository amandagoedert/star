// hooks/useTracking.ts
import { useEffect } from 'react'

const FACEBOOK_PIXEL_ID = '737534842059451'

export const useTracking = () => {
  // Inicializar Facebook Pixel
  const initFacebookPixel = async () => {
    if (typeof window !== 'undefined') {
      try {
        const ReactPixel = (await import('react-facebook-pixel')).default

        const options = {
          autoConfig: true,
          debug: process.env.NODE_ENV === 'development',
        }

        ReactPixel.init(FACEBOOK_PIXEL_ID, undefined, options)
        ReactPixel.pageView()
        console.log('✅ Facebook Pixel initialized')
      } catch (error) {
        console.error('❌ Error initializing Facebook Pixel:', error)
      }
    }
  }

  // Google Ads Conversion
  const fireGoogleConversion = (data: {
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
    } else {
      console.warn('⚠️ Google gtag not found')
    }
  }

  // Facebook Purchase Event
  const fireFacebookPurchase = async (data: {
    value?: number
    currency?: string
    contentIds?: string[]
    contentName?: string
  }) => {
    if (typeof window !== 'undefined') {
      try {
        const ReactPixel = (await import('react-facebook-pixel')).default

        ReactPixel.track('Purchase', {
          value: data.value || 197.9,
          currency: data.currency || 'BRL',
          content_type: 'product',
          content_ids: data.contentIds || ['chip-infinity'],
          content_name: data.contentName || 'Chip Infinity M3',
          num_items: 1,
        })
        console.log('✅ Facebook Purchase event fired')
      } catch (error) {
        console.error('❌ Error firing Facebook Purchase:', error)
      }
    }
  }

  // Disparar todas as conversões
  const fireAllConversions = async (
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

  return {
    initFacebookPixel,
    fireGoogleConversion,
    fireFacebookPurchase,
    fireAllConversions,
  }
}

// Hook específico para página de sucesso
export const useSuccessTracking = (conversionData?: {
  value?: number
  currency?: string
  transactionId?: string
  contentIds?: string[]
  contentName?: string
}) => {
  const { fireAllConversions } = useTracking()

  useEffect(() => {
    // Só dispara se tiver transactionId (evita disparar antes da hidratação)
    if (conversionData?.transactionId) {
      const timer = setTimeout(async () => {
        await fireAllConversions(conversionData)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [conversionData?.transactionId, fireAllConversions])
}
