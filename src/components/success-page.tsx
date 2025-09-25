'use client'
import BannerSuccess from '@/assets/images/banner-success.png'
import { ClientOnly, useClientId } from '@/hooks/client'
import { getCart } from '@/hooks/storage'
import { useSuccessTracking } from '@/hooks/tracking'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import Footer from './_footer'
import Menu from './_menu'

const FACEBOOK_PIXEL_ID = '737534842059451'
const FACEBOOK_ACCESS_TOKEN =
  'EAAXcmZBTvYVsBO9kWkGo2ZA2L0O6N2ZBviLMYYY21ZBExOSX2eW9GpPd2ZBMdRGwRxLRgkATYj4UqJX32xIyGCuBhse9EGjvMvw8JfUHr9SdZBqZAJlsD8IZCo8V0YcjqhBcCPMoncOy8tZBy6hcC0coz1gARjyue1hZAzTmKZCOaodg2ZBHnSAqY27W8G2w0noJyKBYKgZDZD'

const getFacebookParams = () => {
  if (typeof document === 'undefined') return {}

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift()
    return undefined
  }

  return {
    fbc: getCookie('_fbc') || undefined,
    fbp: getCookie('_fbp') || undefined,
  }
}

const getUtmParams = () => {
  if (typeof window === 'undefined') return {}

  const urlParams = new URLSearchParams(window.location.search)
  return {
    utm_source: urlParams.get('utm_source') || undefined,
    utm_medium: urlParams.get('utm_medium') || undefined,
    utm_campaign: urlParams.get('utm_campaign') || undefined,
    utm_term: urlParams.get('utm_term') || undefined,
    utm_content: urlParams.get('utm_content') || undefined,
  }
}

const sendFacebookConversion = async (conversionData: {
  value: number
  currency: string
  transactionId: string
  contentIds: string[]
  contentName: string
}) => {
  try {
    const fbParams = getFacebookParams()
    const utmParams = getUtmParams()

    const eventData = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: conversionData.transactionId,
          event_source_url: window.location.href,
          action_source: 'website',
          user_data: {
            ...(fbParams.fbc && { fbc: fbParams.fbc }),
            ...(fbParams.fbp && { fbp: fbParams.fbp }),
            client_user_agent: navigator.userAgent,
          },
          custom_data: {
            value: conversionData.value,
            currency: conversionData.currency,
            content_type: 'product',
            content_ids: conversionData.contentIds,
            content_name: conversionData.contentName,
            num_items: 1,
            ...utmParams,
          },
        },
      ],
      test_event_code:
        process.env.NODE_ENV === 'development' ? 'TEST12345' : undefined,
    }

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${FACEBOOK_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...eventData,
          access_token: FACEBOOK_ACCESS_TOKEN,
        }),
      }
    )

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Facebook Conversions API v22.0 enviado:', result)
    } else {
      console.error('❌ Erro Facebook Conversions API:', result)
    }
  } catch (error) {
    console.error('❌ Erro ao enviar Facebook Conversions API:', error)
  }
}

export default function SuccessPage() {
  const transactionId = useClientId('order')
  const [conversionData, setConversionData] = useState({
    value: 197.9,
    currency: 'BRL',
    transactionId: '',
    contentIds: ['chip-infinity'],
    contentName: 'Chip Infinity M3',
  })

  useSuccessTracking(conversionData)

  useEffect(() => {
    if (transactionId) {
      try {
        const cart = getCart()
        const value = cart?.total || 197.9

        const newConversionData = {
          value,
          currency: 'BRL',
          transactionId,
          contentIds: ['chip-infinity'],
          contentName: 'Chip Infinity M3',
        }

        setConversionData(newConversionData)

        setTimeout(() => {
          sendFacebookConversion(newConversionData)
        }, 2000)
      } catch (_error) {
        console.log('Cart data not available, using default values')
        const defaultData = {
          value: 197.9,
          currency: 'BRL',
          transactionId,
          contentIds: ['chip-infinity'],
          contentName: 'Chip Infinity M3',
        }

        setConversionData(defaultData)

        setTimeout(() => {
          sendFacebookConversion(defaultData)
        }, 2000)
      }
    }
  }, [transactionId])

  return (
    <>
      <main className="w-full max-w-3xl mx-auto bg-black">
        <header className="relative w-full overflow-hidden">
          <Menu className="bg-[#171717] animate-fade animate-once animate-ease-out animate-fill-both" />
        </header>
        <section
          className="relative animate-fade-up animate-once animate-duration-[600ms] animate-delay-[200ms]
          animate-ease-out animate-normal animate-fill-both w-full h-[545px]"
        >
          <div className="absolute z-10 w-full h-full">
            <Image
              alt="Banner sucesso"
              src={BannerSuccess}
              className="w-full object-cover object-center"
              sizes="100vh"
            />
          </div>
          <div className="relative z-30 w-full h-full flex flex-col gap-4 items-center justify-center text-center px-5">
            <h1 className="text-2xl text-white font-bold">Pedido confirmado</h1>
            <p className="text-base text-white">
              Agradecemos pelo seu pedido! Você receberá em breve um e-mail de
              confirmação com informações sobre os próximas passos.
            </p>
            {/* Debug em desenvolvimento - só renderiza no cliente */}
            <ClientOnly>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-2 bg-gray-800 rounded text-xs text-white">
                  <p>🔍 Conversion Value: R$ {conversionData.value}</p>
                  <p>🔍 Transaction ID: {conversionData.transactionId}</p>
                  <p>
                    🔍 Pixels:{' '}
                    {conversionData.transactionId
                      ? '✅ Ready'
                      : '⏳ Loading...'}
                  </p>
                  <p>🔍 FB API: Enviado após 2s</p>
                </div>
              )}
            </ClientOnly>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
