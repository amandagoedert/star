'use client'

import IconCopy from '@/assets/images/icon-copy.svg'
import IconPix from '@/assets/images/icon-pix.svg'
import { applyCepMask, removeCepMask } from '@/hooks/cep'
import {
  applyCpfMask,
  applyPhoneMask,
  removeCpfMask,
  removePhoneMask,
  validateCpf,
  validateEmail,
  validatePhone,
} from '@/hooks/masks'
import {
  type Cart,
  type User,
  formatPrice,
  getAddress,
  getCart,
  getTrackedParams,
  getUser,
  setUser,
} from '@/hooks/storage'
import { ChevronDown, ChevronUp, Info, LoaderCircle } from 'lucide-react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import Footer from './_footer'
import Menu from './_menu'
import { useTrackedRouter } from './_tracker-push'
import {
  ADDITIONAL_PRODUCTS,
  EQUIPMENT_PRODUCTS,
  type Product,
} from './order-page'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export default function CheckoutPage() {
  const { push } = useTrackedRouter()
  const [isGeneratedOrder, setIsGeneratedOrder] = useState(false)
  const [isLoadingPayment, setIsLoadingPayment] = useState(false)
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false)
  const [paymentData, setPaymentData] = useState<{
    qrcode: string
    rawCode?: string
    qrcodeImage: string
    expirationDate: string
    transactionId: string
  } | null>(null)
  const [isWaitingPix, setIsWaitingPix] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(600)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    cep: '',
    endereco: '',
    complemento: '',
    numero: '',
    cidade: '',
    estado: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})
  const [cartData, setCartData] = useState<Cart | null>(null)
  const [showCopyTooltip, setShowCopyTooltip] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [qrCodeError, setQrCodeError] = useState<string>('')
  const [pixPollingAttempts, setPixPollingAttempts] = useState(0)
  const [pixDebugLogs, setPixDebugLogs] = useState<string[]>([])
  const [showPixDebug, setShowPixDebug] = useState(false)
  const [extendedPolling, setExtendedPolling] = useState(false)
  const [isOpenModalOrder, setIsOpenModalOrder] = useState(false)
  const cepInputRef = useRef<HTMLInputElement | null>(null)
  const lastCepLookupRef = useRef<string>('')

  useEffect(() => {
    const loadInitialData = async () => {
      const savedAddress = getAddress()
      const savedUser = getUser()
      const savedCart = getCart()

      setCartData(savedCart)

      if (savedUser) {
        setFormData({
          name: savedUser.name,
          email: savedUser.email,
          phone: savedUser.phone,
          cpf: savedUser.cpf,
          cep: savedUser.shippingAddress.cep,
          endereco: savedUser.shippingAddress.endereco,
          complemento: savedUser.shippingAddress.complemento || '',
          numero: savedUser.shippingAddress.numero || '',
          cidade: savedUser.shippingAddress.cidade,
          estado: savedUser.shippingAddress.estado,
        })
      } else if (savedAddress) {
        setFormData(prev => ({
          ...prev,
          cep: savedAddress.cep,
          endereco: savedAddress.endereco,
          complemento: savedAddress.complemento || '',
          cidade: savedAddress.cidade,
          estado: savedAddress.estado,
        }))
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    if (isOpenModalOrder) {
      document.body.classList.add('overflow-y-hidden')
    } else {
      document.body.classList.remove('overflow-y-hidden')
    }
  }, [isOpenModalOrder])

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isGeneratedOrder && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsGeneratedOrder(false)
            setPaymentData(null)
            return 600
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isGeneratedOrder, timeRemaining])

  useEffect(() => {
    let statusCheck: NodeJS.Timeout

    if (paymentData?.transactionId && !isPaymentConfirmed) {
      statusCheck = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/v1/transactions?id=${paymentData.transactionId}`
          )
          const data = await response.json()

          if (data.status === 'paid') {
            setIsPaymentConfirmed(true)
            clearInterval(statusCheck)
          }
        } catch (error) {
          console.error('Error checking payment status:', error)
        }
      }, 5000)
    }

    return () => {
      if (statusCheck) clearInterval(statusCheck)
    }
  }, [paymentData?.transactionId, isPaymentConfirmed])

  const handleInputChange = useCallback(
    (field: string, value: string) => {
      let processedValue = value

      if (field === 'cpf') {
        processedValue = applyCpfMask(value)
      } else if (field === 'phone') {
        processedValue = applyPhoneMask(value)
      } else if (field === 'cep') {
        processedValue = applyCepMask(value)
        const sanitizedCep = removeCepMask(processedValue)
        if (sanitizedCep.length === 8) {
          if (lastCepLookupRef.current !== sanitizedCep) {
            lastCepLookupRef.current = sanitizedCep
            void handleCepLookup(sanitizedCep)
          }
        } else {
          lastCepLookupRef.current = ''
        }
      }

      setFormData(prev => ({ ...prev, [field]: processedValue }))

      if (formErrors[field]) {
        setFormErrors(prev => ({ ...prev, [field]: false }))
      }
    },
    [formErrors, handleCepLookup]
  )

  const handleCepLookup = useCallback(
    async (cep: string) => {
      const normalizedCep = removeCepMask(cep)
      if (normalizedCep.length !== 8) return

      try {
        const viaCepResponse = await fetch(
          `https://viacep.com.br/ws/${normalizedCep}/json/`
        )

        if (viaCepResponse.ok) {
          const viaCepData = await viaCepResponse.json()

          if (!viaCepData.erro) {
            setFormData(prev => ({
              ...prev,
              endereco: viaCepData.logradouro || prev.endereco,
              cidade: viaCepData.localidade || prev.cidade,
              estado: viaCepData.uf || prev.estado,
            }))
          }
        } else {
          lastCepLookupRef.current = ''
        }
      } catch (error) {
        console.error('Error looking up CEP:', error)
        lastCepLookupRef.current = ''
      }
    },
    [setFormData]
  )

  const validateForm = useCallback(() => {
    const errors: Record<string, boolean> = {}

    if (!formData.name.trim()) errors.name = true
    if (!validateEmail(formData.email)) errors.email = true
    if (!validatePhone(formData.phone)) errors.phone = true
    if (!validateCpf(formData.cpf)) errors.cpf = true
    if (!formData.cep.trim()) errors.cep = true
    if (!formData.endereco.trim()) errors.endereco = true
    if (!formData.cidade.trim()) errors.cidade = true
    if (!formData.estado.trim()) errors.estado = true

    setFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors)
      return false
    }

    return true
  }, [formData])

  const saveUserData = useCallback(() => {
    const trimmedNumber = formData.numero.trim()

    const shippingAddress: User['shippingAddress'] = {
      cep: formData.cep,
      rua: formData.endereco,
      endereco: formData.endereco,
      complemento: formData.complemento,
      bairro: '',
      cidade: formData.cidade,
      estado: formData.estado,
    }

    if (trimmedNumber) {
      shippingAddress.numero = trimmedNumber
    }

    const userData: User = {
      name: formData.name,
      email: formData.email,
      phone: removePhoneMask(formData.phone),
      cpf: removeCpfMask(formData.cpf),
      shippingAddress,
    }

    setUser(userData)
  }, [formData])

  const handleCreatePayment = async () => {
    if (!validateForm()) return

    setIsLoadingPayment(true)
    saveUserData()

    try {
      const trackedParams = getTrackedParams()

      if (!cartData) throw new Error('Cart data not found')

      const sanitizedCep = removeCepMask(formData.cep)
      const trimmedNumber = formData.numero.trim()
      // Monta cart no formato esperado (centavos, product_hash fixo principal)
      const cartPayload = cartData.items.map(item => ({
        product_hash: item.id === 'chip-infinity' ? 'tybzriceak' : item.id, // garante hash correto
        title: item.name,
        price: Math.round(item.price * 100),
        quantity: item.quantity,
        operation_type: 1,
        tangible: false,
        cover: null,
      }))

      // Payload principal seguindo exatamente a lógica validada (tribopay-checkout)
      const paymentRequest = {
        amount: cartData.total, // em reais (API interna converte para centavos)
        offer_hash: '4sx9hlg2x7', // força hash conhecido independente do env público
        payment_method: 'pix',
        customer: {
          name: formData.name,
          email: formData.email,
          phone_number: removePhoneMask(formData.phone),
          document: removeCpfMask(formData.cpf),
          street_name: formData.endereco || 'Não informado',
          number: trimmedNumber || 'S/N',
          complement: formData.complemento || '',
          neighborhood: 'Centro',
            // fallback mínimos para evitar rejeição se usuário não preencher algo corretamente
          city: formData.cidade || 'São Paulo',
          state: formData.estado || 'SP',
          zip_code: sanitizedCep || '00000000',
        },
        cart: cartPayload,
        installments: 1,
        expire_in_days: 1,
        transaction_origin: 'web',
        tracking: trackedParams && Object.keys(trackedParams).length > 0 ? trackedParams : undefined,
        postback_url: process.env.NEXT_PUBLIC_TRIBOPAY_POSTBACK_URL,
      }

      console.log('📤 Enviando payload PIX:', paymentRequest)

      const response = await fetch('/api/v1/transactions?debug=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentRequest),
      })

      const data = await response.json()
      console.log('📥 Resposta completa da API (checkout principal):', data)

      if (!response.ok) {
        console.error('❌ Erro HTTP/TriboPay:', {
          status: response.status,
          statusText: response.statusText,
          body: data,
        })
        throw new Error(
          data.message || data.error || `Falha na criação do pagamento (HTTP ${response.status})`
        )
      }

      // Normaliza diferentes possíveis campos de código PIX vindos do backend
      const pixSection = data.pix || data
      let possibleCode = pixSection?.qrcode || pixSection?.code || pixSection?.qr_code || pixSection?.qr_code_text || pixSection?.pix_qr_code || pixSection?.copy_paste || pixSection?.qrCode || ''
      let possibleImage = pixSection?.qrcodeImage || pixSection?.qrcode_base64 || pixSection?.qr_code_image || ''
      if (possibleImage && !possibleImage.startsWith('data:image')) {
        // tenta detectar se é base64 pura
        const base64Regex = /^[A-Za-z0-9+/=]+$/
        if (base64Regex.test(possibleImage.replace(/\s+/g, '')) && possibleImage.length > 100) {
          possibleImage = `data:image/png;base64,${possibleImage}`
        }
      }

      if (possibleCode) {
        setPaymentData({
          qrcode: possibleCode,
          rawCode: possibleCode,
          qrcodeImage: possibleImage || '',
          expirationDate: pixSection?.expirationDate || '',
          transactionId: data.id || '',
        })
        await generateQRCode(possibleCode, possibleImage || undefined)
        setIsGeneratedOrder(true)
        setTimeRemaining(600)
        scrollToTop()
        if (data.debugInfo) {
          setPixDebugLogs(prev => [...prev, 'POST debug: ' + JSON.stringify(data.debugInfo)])
        }
        if (data.id) sessionStorage.setItem('lastTransactionId', data.id)
      } else {
        // Não veio ainda: entrar em modo de espera e tentar recuperar
        console.warn('⏳ PIX ainda não disponível. Iniciando polling...')
        setIsWaitingPix(true)
        setIsGeneratedOrder(true)
        setTimeRemaining(600)
        scrollToTop()
        const transactionId = data.id
        if (transactionId) {
          sessionStorage.setItem('lastTransactionId', transactionId)
          startPixPolling(transactionId)
        } else {
          alert('Transação criada sem ID. Tente novamente.')
          setIsGeneratedOrder(false)
        }
      }
    } catch (error: any) {
      console.error('❌ Erro completo na criação do pagamento:', error)
      
      // Tentar extrair mais detalhes do erro
      let errorMessage = 'Erro ao processar pagamento. Tente novamente.'
      
      if (error.message) {
        errorMessage = error.message
      }
      
      alert(`Erro: ${errorMessage}`)
    } finally {
      setIsLoadingPayment(false)
    }
  }

  const handleCopyPix = async () => {
    if (paymentData?.qrcode) {
      try {
        await navigator.clipboard.writeText(paymentData.qrcode)
        setShowCopyTooltip(true)
        setTimeout(() => setShowCopyTooltip(false), 2000)
      } catch (error) {
        console.error('Failed to copy:', error)
      }
    }
  }

  const handleConfirmPayment = () => {
    if (isPaymentConfirmed) {
      push('/success')
    }
  }

  const handleCepFocus = useCallback(() => {
    if (typeof window === 'undefined') return
    const target = cepInputRef.current
    if (!target) return
    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches
    if (!isMobileViewport) return

    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.scrollBy(0, -40)
    }, 120)
  }, [])

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} minutos`
  }

  const getProgressPercentage = () => {
    return (timeRemaining / 600) * 100
  }

  // Geração robusta do QR Code (com fallback)
  const generateQRCode = async (pixCode: string, preferImage?: string) => {
    if (preferImage && preferImage.startsWith('data:image')) {
      setQrCodeError('')
      setQrCodeDataUrl(preferImage)
      return
    }
    if (!pixCode) return
    try {
      setQrCodeError('')
      const sanitized = pixCode.replace(/\s+/g, '')
      const qrCodeUrl = await QRCode.toDataURL(sanitized, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      })
      setQrCodeDataUrl(qrCodeUrl)
    } catch (error) {
      console.error('Error generating QR Code:', error)
      setQrCodeError('Falha ao gerar QR Code. Use o código copia e cola.')
    }
  }

  // Polling estendido para recuperar PIX tardio
  const startPixPolling = useCallback((transactionId: string, extraWindow = false) => {
    let attempts = 0
    // Estratégia adaptativa: primeiros 5 tentativas a cada 2s, próximas 5 a cada 3s, restantes (até 25) a cada 5s.
    const maxAttempts = extraWindow ? 40 : 25
    setPixPollingAttempts(0)
    const interval = setInterval(async () => {
      attempts++
      setPixPollingAttempts(attempts)
      const delayPhase = attempts <= 5 ? 2000 : attempts <= 10 ? 3000 : 5000
      try {
        const startedAt = performance.now()
        const statusResp = await fetch(`/api/v1/transactions?id=${transactionId}&debug=1`)
        const latency = Math.round(performance.now() - startedAt)
        const statusJson = await statusResp.json()
        const pixSection = statusJson.pix || statusJson
        let possibleCode = pixSection?.qrcode || pixSection?.code || pixSection?.qr_code || pixSection?.qr_code_text || pixSection?.pix_qr_code || pixSection?.copy_paste || pixSection?.qrCode || ''
        let possibleImage = pixSection?.qrcodeImage || pixSection?.qrcode_base64 || pixSection?.qr_code_image || ''
        if (possibleImage && !possibleImage.startsWith('data:image')) {
          const base64Regex = /^[A-Za-z0-9+/=]+$/
          if (base64Regex.test(possibleImage.replace(/\s+/g, '')) && possibleImage.length > 100) {
            possibleImage = `data:image/png;base64,${possibleImage}`
          }
        }
        const debugInfo = statusJson.debugInfo || null
        setPixDebugLogs(prev => [...prev, `Polling #${attempts} (latency ${latency}ms): keys=${Object.keys(pixSection || {}).join(',')} codeLen=${possibleCode?.length || 0} status=${statusJson.status}` + (debugInfo ? ' debug=' + JSON.stringify(debugInfo) : '')])
        if (possibleCode) {
          console.log('✅ PIX recuperado via polling adaptativo.')
          setPaymentData({
            qrcode: possibleCode,
            rawCode: possibleCode,
            qrcodeImage: possibleImage || '',
            expirationDate: pixSection?.expirationDate || '',
            transactionId,
          })
          await generateQRCode(possibleCode, possibleImage || undefined)
          setIsWaitingPix(false)
          clearInterval(interval)
        }
        if (statusJson.status === 'paid') {
          setIsPaymentConfirmed(true)
        }
      } catch (err) {
        setPixDebugLogs(prev => [...prev, `Polling #${attempts} erro: ${(err as any)?.message || err}`])
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval)
        setIsWaitingPix(false)
        if (!paymentData?.qrcode) {
          setQrCodeError('Não foi possível gerar o PIX automaticamente dentro da janela padrão.')
        }
      } else {
        // Ajusta dinamicamente o intervalo
        clearInterval(interval)
        startPixPollingDelayed(transactionId, attempts, maxAttempts, paymentData?.qrcode, extraWindow)
      }
    }, 10) // primeira execução imediata, depois re-agendado
  }, [paymentData?.qrcode])

  const startPixPollingDelayed = (transactionId: string, attempts: number, maxAttempts: number, alreadyCode?: string | null, extraWindow = false) => {
    if (alreadyCode) return
    const nextDelay = attempts < 5 ? 2000 : attempts < 10 ? 3000 : 5000
    setTimeout(() => {
      startPixPolling(transactionId, extraWindow)
    }, nextDelay)
  }

  // Regenerar QR se ainda não renderizado
  useEffect(() => {
    if (paymentData?.qrcode && !qrCodeError) {
      if (!qrCodeDataUrl || (paymentData.qrcodeImage && !qrCodeDataUrl.startsWith('data:image'))) {
        generateQRCode(paymentData.qrcode, paymentData.qrcodeImage)
      }
    }
  }, [paymentData?.qrcode, paymentData?.qrcodeImage, qrCodeDataUrl, qrCodeError])

  const handleRetryPix = () => {
    if (!paymentData?.transactionId) return
    setQrCodeError('')
    setQrCodeDataUrl('')
    setIsWaitingPix(true)
    startPixPolling(paymentData.transactionId, extendedPolling)
  }

  useEffect(() => {
    // Recuperar transação anterior (refresh) se ainda sem pagamento mas ordem gerada
    if (!paymentData && !isGeneratedOrder) {
      const lastId = sessionStorage.getItem('lastTransactionId')
      if (lastId) {
        console.log('🔄 Recuperando transação anterior:', lastId)
        setIsGeneratedOrder(true)
        setIsWaitingPix(true)
        startPixPolling(lastId)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const scrollToFirstError = (errors: Record<string, boolean>) => {
    const firstErrorField = Object.keys(errors)[0]
    const element = document.querySelector(
      `input[name="${firstErrorField}"]`
    ) as HTMLElement
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      element.focus()
    }
  }

  const handleOpenModalOrder = () => {
    setIsOpenModalOrder(true)
  }

  const handleCloseModalOrder = () => {
    setIsOpenModalOrder(false)
  }

  const getCartItems = () => {
    const items: Array<Product & { quantity: number }> = []

    for (const product of [...EQUIPMENT_PRODUCTS, ...ADDITIONAL_PRODUCTS]) {
      const item = cartData?.items.find(cartItem => cartItem.id === product.id)
      if (item) {
        items.push({ ...product, quantity: item.quantity })
      }
    }

    return items
  }

  return (
    <>
      {!isGeneratedOrder && (
        <main className="w-full max-w-3xl mx-auto bg-black">
          <header className="relative w-full overflow-hidden">
            <Menu className="bg-[#171717] animate-fade animate-once animate-ease-out animate-fill-both" />
          </header>

          <section className="relative px-5 pt-10 animate-fade-up animate-once animate-duration-[600ms] animate-delay-[200ms] animate-ease-out animate-normal animate-fill-both">
            <h1 className="text-[32px] text-white font-bold mb-4 uppercase">
              Conclusão da compra
            </h1>

            <div className="mt-8">
              <div className="w-full text-white flex flex-col gap-4">
                <Label className="font-bold text-xl">
                  Informações de contato
                </Label>
                <div className="w-full flex flex-col gap-4">
                  <div className="relative w-full">
                    <Input
                      name="name"
                      placeholder="Nome completo"
                      value={formData.name}
                      onChange={e => handleInputChange('name', e.target.value)}
                      className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A] "
                      data-error={formErrors.name}
                    />
                    <span
                      className="absolute left-3 text-xs px-2 py-1 bg-black 
                  pointer-events-none transition-all duration-300 ease-out
                  top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                  peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                  peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                  peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                    >
                      Nome completo
                    </span>
                    {formErrors.name && (
                      <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                        Este campo é obrigatório
                      </span>
                    )}
                  </div>
                  <div className="relative w-full">
                    <Input
                      name="email"
                      placeholder="E-mail"
                      value={formData.email}
                      onChange={e => handleInputChange('email', e.target.value)}
                      className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                    text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                    focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A]"
                      data-error={formErrors.email}
                    />
                    <span
                      className="absolute left-3 text-xs px-2 py-1 bg-black 
                    pointer-events-none transition-all duration-300 ease-out
                    top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                    peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                    peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                    peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                    >
                      E-mail
                    </span>
                    {formErrors.email && (
                      <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                        Digite um e-mail válido
                      </span>
                    )}
                  </div>
                  <div className="relative w-full">
                    <Input
                      name="phone"
                      placeholder="Número de telefone"
                      value={formData.phone}
                      onChange={e => handleInputChange('phone', e.target.value)}
                      className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                    text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                    focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A]"
                      data-error={formErrors.phone}
                    />
                    <span
                      className="absolute left-3 text-xs px-2 py-1 bg-black 
                    pointer-events-none transition-all duration-300 ease-out
                    top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                    peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                    peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                    peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                    >
                      Número de telefone
                    </span>
                    {formErrors.phone && (
                      <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                        Digite um telefone válido
                      </span>
                    )}
                  </div>
                  <div className="relative w-full">
                    <Input
                      name="cpf"
                      placeholder="CPF"
                      value={formData.cpf}
                      onChange={e => handleInputChange('cpf', e.target.value)}
                      className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                    text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                    focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A]"
                      data-error={formErrors.cpf}
                    />
                    <span
                      className="absolute left-3 text-xs px-2 py-1 bg-black 
                    pointer-events-none transition-all duration-300 ease-out
                    top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                    peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                    peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                    peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                    >
                      CPF
                    </span>
                    {formErrors.cpf && (
                      <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                        Digite um CPF válido
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="w-full text-white flex flex-col gap-4">
                <Label className="font-bold text-xl">Endereço de envio</Label>
                <div className="w-full flex flex-col gap-4">
                  <div className="relative w-full">
                    <Input
                      ref={cepInputRef}
                      name="cep"
                      placeholder="CEP/código postal"
                      value={formData.cep}
                      onFocus={handleCepFocus}
                      onChange={e => handleInputChange('cep', e.target.value)}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      enterKeyHint="next"
                      className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A] "
                      data-error={formErrors.cep}
                    />
                    <span
                      className="absolute left-3 text-xs px-2 py-1 bg-black 
                  pointer-events-none transition-all duration-300 ease-out
                  top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                  peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                  peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                  peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                    >
                      CEP/código postal
                    </span>
                    {formErrors.cep && (
                      <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                        Este campo é obrigatório
                      </span>
                    )}
                  </div>
                  <div className="relative w-full">
                    <Input
                      name="endereco"
                      placeholder="Endereço"
                      value={formData.endereco}
                      onChange={e =>
                        handleInputChange('endereco', e.target.value)
                      }
                      className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A] "
                      data-error={formErrors.endereco}
                    />
                    <span
                      className="absolute left-3 text-xs px-2 py-1 bg-black 
                  pointer-events-none transition-all duration-300 ease-out
                  top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                  peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                  peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                  peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                    >
                      Endereço
                    </span>
                    {formErrors.endereco && (
                      <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                        Este campo é obrigatório
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative w-full">
                      <Input
                        name="complemento"
                        placeholder="Complemento"
                        value={formData.complemento}
                        onChange={e =>
                          handleInputChange('complemento', e.target.value)
                        }
                        className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A] "
                        data-error={false}
                      />
                      <span
                        className="absolute left-3 text-xs px-2 py-1 bg-black 
                  pointer-events-none transition-all duration-300 ease-out
                  top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                  peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                  peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                  peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                      >
                        Complemento
                      </span>
                    </div>
                    <div className="relative w-full">
                      <Input
                        name="numero"
                        placeholder="Número"
                        value={formData.numero}
                        onChange={e =>
                          handleInputChange('numero', e.target.value)
                        }
                        className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A] "
                        data-error={false}
                      />
                      <span
                        className="absolute left-3 text-xs px-2 py-1 bg-black 
                  pointer-events-none transition-all duration-300 ease-out
                  top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                  peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                  peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                  peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                      >
                        Número
                      </span>
                    </div>
                  </div>
                  <div className="relative w-full">
                    <Input
                      name="cidade"
                      placeholder="Cidade"
                      value={formData.cidade}
                      onChange={e =>
                        handleInputChange('cidade', e.target.value)
                      }
                      className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A] "
                      data-error={formErrors.cidade}
                    />
                    <span
                      className="absolute left-3 text-xs px-2 py-1 bg-black 
                  pointer-events-none transition-all duration-300 ease-out
                  top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                  peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                  peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                  peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                    >
                      Cidade
                    </span>
                    {formErrors.cidade && (
                      <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                        Este campo é obrigatório
                      </span>
                    )}
                  </div>
                  <div className="relative w-full">
                    <Input
                      name="estado"
                      placeholder="Estado"
                      value={formData.estado}
                      onChange={e =>
                        handleInputChange('estado', e.target.value)
                      }
                      className="peer bg-[#000000] border border-[#434343] transition-all duration-300 ease-out
                text-white h-auto w-full text-base rounded-[4px] py-4 px-3 focus-visible:ring-0 focus-visible:border-[#FFFFFF] 
                focus-visible:placeholder:opacity-0 data-[error=true]:border-[#EF9A9A] data-[error=true]:focus-visible:border-[#EF9A9A] "
                      data-error={formErrors.estado}
                    />
                    <span
                      className="absolute left-3 text-xs px-2 py-1 bg-black 
                  pointer-events-none transition-all duration-300 ease-out
                  top-4 opacity-0 transform translate-y-0 text-[#8F8989]
                  peer-focus:opacity-100 peer-focus:-translate-y-7 peer-focus:scale-90
                  peer-[:not(:placeholder-shown)]:opacity-100 peer-[:not(:placeholder-shown)]:-translate-y-7 
                  peer-[:not(:placeholder-shown)]:scale-90 peer-data-[error=true]:text-[#EF9A9A]"
                    >
                      Estado
                    </span>
                    {formErrors.estado && (
                      <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                        Este campo é obrigatório
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="w-full text-white flex flex-col gap-4">
                <Label className="font-bold text-xl">Pagamento</Label>
                <div className="w-full flex flex-col gap-4">
                  <div className="relative w-full">
                    <div className="bg-[#101413] p-3 border border-[#3E9679] rounded-[4px] max-w-[119px]">
                      <div className="flex items-center justify-between">
                        <Image
                          alt="Icon Pix"
                          src={IconPix}
                          width={19}
                          className="h-auto"
                        />
                        <div className="relative border border-[#3E9679] rounded-full w-4 h-4">
                          <div
                            className="absolute bg-[#3E9679] rounded-full w-[9px] h-[9px]
                          top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                          />
                        </div>
                      </div>
                      <div className="w-full mt-8">
                        <span className="font-bold text-sm uppercase">Pix</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full p-5 border border-[#434343] border-dashed rounded-[4px]">
                  <div className="flex gap-1 items-center">
                    <Info className="text-white w-4 h-4" />
                    <span className="font-bold text-xs">
                      Informações sobre o pagamento via PIX
                    </span>
                  </div>
                  <p className="text-xs text-white/70 mt-3">
                    O pagamento é instantâneo e liberação imediata. Ao clicar em
                    "Pagar" você será encaminhado para um ambiente seguro, onde
                    encontrará o passo a passo para realizar o pagamento.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="relative px-5 pt-10 animate-fade-up animate-once animate-duration-[600ms] animate-delay-[200ms] animate-ease-out animate-normal animate-fill-both">
            {cartData && (
              <div className="w-full mb-8 p-5 border border-[#434343] rounded-[4px]">
                <div className="text-white">
                  <Label className="font-bold text-xl mb-4 block">
                    Resumo do pedido
                  </Label>
                  <div className="space-y-3">
                    {cartData.items.map(item => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center"
                      >
                        <div>
                          <span className="text-sm">{item.name}</span>
                          <span className="text-xs text-white/70 block">
                            Qtd: {item.quantity}
                          </span>
                        </div>
                        <span className="font-bold">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-[#434343] pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">Total</span>
                        <span className="font-bold text-lg">
                          {formatPrice(cartData.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="relative bottom-0 left-0 w-full px-5 py-5 bg-[#121212] cursor-pointer">
            <div
              onClick={handleOpenModalOrder}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleOpenModalOrder()
                }
              }}
              className="w-full flex gap-4 items-center justify-between text-white"
            >
              <span className="font-bold">Total a pagar hoje</span>
              <div className="flex gap-2 text-[#4FC3F7]">
                <span>
                  {cartData ? formatPrice(cartData.total) : formatPrice(0)}
                </span>
                <ChevronUp className="w-4" />
              </div>
            </div>
            <div className="w-full">
              <Button
                onClick={() => {
                  handleCloseModalOrder()
                  handleCreatePayment()
                }}
                disabled={isLoadingPayment}
                className="py-3.5 px-2.5 m-0 mt-4 h-auto w-full bg-white text-black text-base font-bold rounded-lg disabled:opacity-50"
              >
                {isLoadingPayment ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  'Concluir a compra'
                )}
              </Button>
            </div>
          </div>

          <div className="w-full px-5 pt-5">
            <p className="text-white/70 text-xs">
              Ao fazer este pedido, concordo com os{' '}
              <span className="underline text-white">Termos de Serviço</span> e
              a{' '}
              <span className="underline text-white">
                Política de Privacidade
              </span>{' '}
              da Starlink. Você pode cancelar o pagamento único a qualquer
              momento na sua conta Starlink. Se você cancelar a compra e
              devolver o Chip Infinity M3 dentro de 30 dias a partir da data de
              pagamento, você receberá o reembolso integral do Chip Infinity M3.
            </p>
          </div>

          <Footer />
        </main>
      )}

      {isOpenModalOrder && (
        <>
          <div
            className="bg-black/60 fixed top-0 left-0 w-full h-svh z-40"
            onClick={handleCloseModalOrder}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleCloseModalOrder()
              }
            }}
          />
          <div className="fixed bottom-0 left-0 z-50 w-full bg-[#121212] rounded-[12px] p-5 text-white shadow-2xl animate-fade-up animate-duration-[250ms]">
            <div className="flex justify-between items-center mb-8">
              <span className="font-bold text-xl">Resumo do pedido</span>
              <Button
                onClick={handleCloseModalOrder}
                className="bg-transparent hover:bg-white/10 p-2 w-auto h-auto"
              >
                <ChevronDown className="w-5 h-5 text-white" />
              </Button>
            </div>

            {getCartItems().map(item => (
              <div
                key={item.id}
                className="flex gap-5 items-center justify-between mt-8 pb-5 border-b border-[#363636]"
              >
                <div className="w-full flex flex-col gap-2">
                  <span className="font-bold text-sm">{item.name}</span>
                  <span>{formatPrice(item.price)}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-center">
                    Qtd: {item.quantity}
                  </span>
                </div>
              </div>
            ))}

            <div className="w-full flex flex-col gap-4 text-white mt-5">
              <div className="flex gap-4 items-center justify-between">
                <span className="font-bold">Total a pagar hoje</span>
                <div className="flex gap-2">
                  <span className="font-bold">
                    {cartData ? formatPrice(cartData.total) : formatPrice(0)}
                  </span>
                  <ChevronUp className="w-4" />
                </div>
              </div>
              <div className="w-full">
                <Button
                  onClick={() => {
                    handleCloseModalOrder()
                    handleCreatePayment()
                  }}
                  disabled={isLoadingPayment}
                  className="py-3.5 px-2.5 m-0 mt-4 h-auto w-full bg-white text-black text-base font-bold rounded-lg disabled:opacity-50"
                >
                  {isLoadingPayment ? (
                    <>
                      <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    'Concluir a compra'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {isGeneratedOrder && (
        <div className="w-full p-5 pt-10 bg-black min-h-screen">
          <div className="flex items-center justify-center gap-[10px]">
            <div className="w-2 h-2 rounded-full bg-[#808080] animate-pulse-dot-1" />
            <div className="w-2 h-2 rounded-full bg-[#808080] animate-pulse-dot-2" />
            <div className="w-2 h-2 rounded-full bg-[#808080] animate-pulse-dot-3" />
          </div>
          <div className="w-full mt-[27px] text-center">
            <span className="text-2xl font-bold text-[#F3F4F8]">
              Falta pouco, {formData.name.split(' ')[0]}
            </span>
          </div>
          <div className="w-full mt-[27px] text-center text-balance">
            <span className="text-base text-[#ECEFF1]">
              {isWaitingPix && !paymentData?.qrcode
                ? 'Gerando o código PIX... aguarde alguns instantes.'
                : 'Assim que o pagamento via Pix for confirmado, te avisaremos'}
            </span>
          </div>
          <div className="w-full mt-[27px] p-5 border border-[#434343] rounded-[8px] text-center flex flex-col gap-4 mb-10">
            <span className="text-[#F3F4F8] text-xl font-bold">
              Aqui está o Pix copia e cola
            </span>
            <span className="text-base text-[#ECEFF1]">
              Copie o código ou use a câmera para ler o QR Code e realize o
              pagamento no app do seu banco.
            </span>
            <div className="w-[118px] h-[118px] p-2.5 bg-white rounded-[4px] mt-6 mx-auto">
              {qrCodeDataUrl && !qrCodeError && (
                <Image src={qrCodeDataUrl} alt="QR Code PIX" width={98} height={98} className="w-full h-full object-contain" />
              )}
              {!qrCodeDataUrl && !qrCodeError && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <LoaderCircle className="w-5 h-5 text-black animate-spin" />
                  <span className="text-[10px] text-black font-medium">{isWaitingPix ? 'Gerando...' : 'Preparando QR'}</span>
                </div>
              )}
              {qrCodeError && (
                <div className="w-full h-full flex flex-col items-center justify-center px-1">
                  <span className="text-[10px] text-red-600 font-semibold text-center leading-tight">{qrCodeError}</span>
                </div>
              )}
            </div>
            <div className="w-full mt-6">
              <div className="relative w-full flex gap-2">
                <div className="w-full bg-[#292929] rounded-[8px] py-3.5 px-3 text-white text-sm overflow-hidden truncate">
                  {paymentData?.qrcode
                    ? paymentData.qrcode
                    : isWaitingPix
                    ? 'Gerando PIX...'
                    : 'PIX indisponível'}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="w-fit bg-[#292929] rounded-[8px] py-3.5 px-3 flex items-center justify-center hover:bg-[#3a3a3a] transition-colors disabled:opacity-40"
                  disabled={!paymentData?.qrcode}
                >
                  <Image
                    alt="Icon copiar"
                    src={IconCopy}
                    width={20}
                    className="h-auto"
                  />
                  {showCopyTooltip && (
                    <div className="absolute w-fit min-w-[150px] -top-12 right-0">
                      <div className="py-1 px-2.5 bg-white border border-[#E1E4EA] rounded-[6px]">
                        <span className="text-[#0E121B] text-xs">
                          Código pix copiado
                        </span>
                      </div>
                      <div
                        className="absolute top-full right-4 w-3 h-3 bg-white border-r border-b border-[#E1E4EA] 
                        rounded-br-[3px] transform rotate-45 -translate-y-1/2"
                      />
                    </div>
                  )}
                </button>
              </div>
              <div className="w-full mt-3">
                <Button
                  onClick={handleConfirmPayment}
                  disabled={!isPaymentConfirmed}
                  className="w-full bg-white text-sm text-black py-3.5 px-2.5 m-0 h-auto rounded-[4px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPaymentConfirmed
                    ? 'Confirmar Pagamento'
                    : isWaitingPix
                    ? 'Gerando PIX...'
                    : 'Aguardando Pagamento...'}
                </Button>
              </div>
              {qrCodeError && !paymentData?.qrcode && (
                <div className="w-full mt-4 flex flex-col gap-3 items-center">
                  <span className="text-xs text-red-400 text-center">{qrCodeError}</span>
                  <Button
                    onClick={handleRetryPix}
                    className="w-full bg-white text-black text-xs font-bold h-auto py-3.5"
                  >
                    Tentar novamente gerar PIX
                  </Button>
                  {!extendedPolling && (
                    <Button
                      onClick={() => { setExtendedPolling(true); if(paymentData?.transactionId) { setIsWaitingPix(true); startPixPolling(paymentData.transactionId, true) } }}
                      className="w-full bg-[#292929] text-white text-[11px] font-medium h-auto py-3.5"
                    >
                      Estender tentativa (janela longa)
                    </Button>
                  )}
                </div>
              )}
              {isWaitingPix && (
                <div className="mt-4">
                  <span className="block text-[10px] text-white/60">Tentativas: {pixPollingAttempts}</span>
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowPixDebug(v => !v)}
                  className="text-[11px] underline text-white/60 hover:text-white self-start"
                >
                  {showPixDebug ? 'Ocultar debug' : 'Mostrar debug PIX'}
                </button>
                {showPixDebug && (
                  <div className="max-h-40 overflow-auto text-[10px] bg-[#111] border border-[#333] rounded p-2 font-mono whitespace-pre-wrap text-white/70">
                    {pixDebugLogs.length === 0 ? 'Sem logs ainda.' : pixDebugLogs.map((l,i)=>(<div key={i}>{l}</div>))}
                  </div>
                )}
              </div>
              <div className="w-full mt-6 bg-[#292929] p-5 text-white rounded-[8px]">
                <span className="block font-bold text-sm text-left">
                  Faltam {formatTimeRemaining(timeRemaining)} para o pagamento
                  expirar...
                </span>
                <div className="relative mt-2 bg-[#636363] w-full h-[4px] rounded-full overflow-hidden">
                  <div
                    className="absolute bg-[#CCCCCC] h-[4px] top-0 left-0 transition-all duration-1000"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              </div>
              <div className="w-full mt-6">
                <span className="block font-bold text-center text-xl text-white">
                  Para realizar o pagamento
                </span>
                <div className="mt-6 flex flex-col gap-2">
                  <div className="flex gap-3 items-center text-white text-left py-2">
                    <span className="flex items-center justify-center border border-[#474747] text-white rounded-full w-6 h-6 min-w-6 min-h-6 text-xs">
                      1
                    </span>
                    <span>Abra o aplicativo do seu banco</span>
                  </div>
                  <div className="flex gap-3 items-center text-white text-left py-2">
                    <span className="flex items-center justify-center border border-[#474747] text-white rounded-full w-6 h-6 min-w-6 min-h-6 text-xs">
                      2
                    </span>
                    <span>
                      Escolha a opção Pix e cole o código ou use a câmera do seu
                      celular para pagar com QR Code
                    </span>
                  </div>
                  <div className="flex gap-3 items-center text-white text-left py-2">
                    <span className="flex items-center justify-center border border-[#474747] text-white rounded-full w-6 h-6 min-w-6 min-h-6 text-xs">
                      3
                    </span>
                    <span>Confirme as informações e finalize o pagamento</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
