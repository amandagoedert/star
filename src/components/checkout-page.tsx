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
import { useCallback, useEffect, useState } from 'react'
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
    qrcodeImage: string
    expirationDate: string
    transactionId: string
  } | null>(null)
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
  const [isOpenModalOrder, setIsOpenModalOrder] = useState(false)

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
        if (processedValue.length === 9) {
          handleCepLookup(removeCepMask(processedValue))
        }
      }

      setFormData(prev => ({ ...prev, [field]: processedValue }))

      if (formErrors[field]) {
        setFormErrors(prev => ({ ...prev, [field]: false }))
      }
    },
    [formErrors]
  )

  const handleCepLookup = async (cep: string) => {
    try {
      const viaCepResponse = await fetch(
        `https://viacep.com.br/ws/${cep}/json/`
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
      }
    } catch (error) {
      console.error('Error looking up CEP:', error)
    }
  }

  const validateForm = useCallback(() => {
    const errors: Record<string, boolean> = {}

    if (!formData.name.trim()) errors.name = true
    if (!validateEmail(formData.email)) errors.email = true
    if (!validatePhone(formData.phone)) errors.phone = true
    if (!validateCpf(formData.cpf)) errors.cpf = true
    if (!formData.cep.trim()) errors.cep = true
    if (!formData.endereco.trim()) errors.endereco = true
    if (!formData.numero.trim()) errors.numero = true
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
    const userData: User = {
      name: formData.name,
      email: formData.email,
      phone: removePhoneMask(formData.phone),
      cpf: removeCpfMask(formData.cpf),
      shippingAddress: {
        cep: formData.cep,
        rua: formData.endereco,
        endereco: formData.endereco,
        complemento: formData.complemento,
        numero: formData.numero,
        bairro: '',
        cidade: formData.cidade,
        estado: formData.estado,
      },
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

      const paymentRequest = {
        name: formData.name,
        email: formData.email,
        cpf: removeCpfMask(formData.cpf),
        phone: removePhoneMask(formData.phone),
        paymentMethod: 'pix',
        amount: cartData.total,
        items: cartData.items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        utms: trackedParams,
      }

      const response = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentRequest),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Payment creation failed')
      }

      if (data.pix) {
        setPaymentData({
          qrcode: data.pix.qrcode,
          qrcodeImage: '',
          expirationDate: data.pix.expirationDate,
          transactionId: data.id,
        })

        await generateQRCode(data.pix.qrcode)

        setIsGeneratedOrder(true)
        setTimeRemaining(600)
        scrollToTop()
      }
    } catch (error) {
      console.error('Payment creation error:', error)
      alert('Erro ao processar pagamento. Tente novamente.')
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

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} minutos`
  }

  const getProgressPercentage = () => {
    return (timeRemaining / 600) * 100
  }

  const generateQRCode = async (pixCode: string) => {
    try {
      const qrCodeUrl = await QRCode.toDataURL(pixCode, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
      setQrCodeDataUrl(qrCodeUrl)
    } catch (error) {
      console.error('Error generating QR Code:', error)
    }
  }

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
                      name="cep"
                      placeholder="CEP/código postal"
                      value={formData.cep}
                      onChange={e => handleInputChange('cep', e.target.value)}
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
                        data-error={formErrors.numero}
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
                      {formErrors.numero && (
                        <span className="text-[#EF9A9A] text-xs mt-1 opacity-100 transition-opacity duration-200">
                          Este campo é obrigatório
                        </span>
                      )}
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
              Assim que o pagamento via Pix for confirmado, te avisaremos
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
              {qrCodeDataUrl ? (
                <Image
                  src={qrCodeDataUrl}
                  alt="QR Code PIX"
                  width={98}
                  height={98}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <LoaderCircle className="w-5 h-5 text-black animate-spin" />
                </div>
              )}
            </div>
            <div className="w-full mt-6">
              <div className="relative w-full flex gap-2">
                <div className="w-full bg-[#292929] rounded-[8px] py-3.5 px-3 text-white text-sm overflow-hidden truncate">
                  {paymentData?.qrcode ||
                    '00020126580014br.gov.bcb...00020126580010002012658001'}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="w-fit bg-[#292929] rounded-[8px] py-3.5 px-3 flex items-center justify-center hover:bg-[#3a3a3a] transition-colors"
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
                    : 'Aguardando Pagamento...'}
                </Button>
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
