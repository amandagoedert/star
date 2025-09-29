'use client'

import { useState, useEffect } from 'react'
import { useTrackedRouter } from './_tracker-push'
import { type Cart, getCart, formatPrice } from '@/hooks/storage'
import { applyCpfMask, removeCpfMask, validateCpf, validateEmail, validatePhone, removePhoneMask } from '@/hooks/masks'

interface PaymentData {
  qrcode: string
  qrcodeImage: string
  expirationDate: string
  transactionId: string
}

export default function TriboPayCheckout() {
  const { push } = useTrackedRouter()
  const [cartData, setCartData] = useState<Cart | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [showCopyTooltip, setShowCopyTooltip] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
  })
  
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const savedCart = getCart()
    setCartData(savedCart)
  }, [])

  const validateForm = () => {
    const errors: Record<string, boolean> = {}
    
    if (!formData.name.trim()) errors.name = true
    if (!validateEmail(formData.email)) errors.email = true
    if (!validatePhone(formData.phone)) errors.phone = true
    if (!validateCpf(formData.cpf)) errors.cpf = true
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field: string, value: string) => {
    let processedValue = value
    
    if (field === 'cpf') {
      processedValue = applyCpfMask(value)
    } else if (field === 'phone') {
      processedValue = value.replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1')
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: processedValue
    }))
    
    // Limpar erro quando usuário começar a digitar
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: false
      }))
    }
  }

  const handlePayment = async () => {
    if (!validateForm()) {
      alert('Por favor, preencha todos os campos corretamente.')
      return
    }

    if (!cartData) {
      alert('Carrinho não encontrado.')
      return
    }

    setIsProcessing(true)

    try {
      const paymentPayload = {
        amount: cartData.total,
        offer_hash: '4sx9hlg2x7',
        payment_method: 'pix',
        customer: {
          name: formData.name,
          email: formData.email,
          phone_number: removePhoneMask(formData.phone),
          document: removeCpfMask(formData.cpf),
          street_name: 'Não informado',
          number: 'S/N',
          complement: '',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zip_code: '00000000'
        },
        cart: cartData.items.map(item => ({
          product_hash: item.id === 'chip-infinity' ? 'tybzriceak' : item.id,
          title: item.name,
          price: Math.round(item.price * 100),
          quantity: item.quantity,
          operation_type: 1,
          tangible: false,
          cover: null
        })),
        installments: 1,
        expire_in_days: 1,
        transaction_origin: 'web'
      }

      console.log('📤 Enviando pagamento:', paymentPayload)

      const response = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentPayload),
      })

      const data = await response.json()
      console.log('📥 Resposta recebida:', data)

      if (!response.ok) {
        throw new Error(data.message || `Erro HTTP ${response.status}`)
      }

      if (data.pix && data.pix.qrcode) {
        setPaymentData({
          qrcode: data.pix.qrcode,
          qrcodeImage: data.pix.qrcodeImage || '',
          expirationDate: data.pix.expirationDate || '',
          transactionId: data.id || ''
        })
      } else {
        throw new Error('PIX não foi gerado corretamente')
      }

    } catch (error: any) {
      console.error('❌ Erro no pagamento:', error)
      alert(`Erro no pagamento: ${error.message}`)
      setIsProcessing(false)
    }
  }

  const handleCopyPix = async () => {
    if (!paymentData?.qrcode) return

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(paymentData.qrcode)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = paymentData.qrcode
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      
      setShowCopyTooltip(true)
      setTimeout(() => setShowCopyTooltip(false), 2000)
    } catch (error) {
      console.error('Erro ao copiar:', error)
      alert('Erro ao copiar código PIX')
    }
  }

  if (paymentData) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
        <div className="max-w-xl w-full">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">PIX Gerado com Sucesso!</h1>
              <p className="text-gray-600">Copie o código abaixo para realizar o pagamento</p>
            </div>

            {/* Resumo do Produto */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Você está adquirindo:</h3>
              {cartData?.items.map(item => (
                <div key={item.id} className="flex items-center py-2 border-b border-gray-200 last:border-b-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm font-bold text-green-700">{formatPrice(item.price)}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-gray-200">
                <dt className="text-lg font-bold text-gray-900">Total:</dt>
                <dd className="text-xl font-semibold text-gray-900">
                  <span className="text-base font-medium">1x de</span> {formatPrice(cartData?.total || 0)}
                </dd>
              </div>
            </div>

            {/* Código PIX */}
            <div className="text-center">
              <p className="text-base font-semibold text-gray-800 mb-3">Copie e cole o código PIX:</p>
              <div className="relative">
                <input
                  type="text"
                  value={paymentData.qrcode}
                  readOnly
                  className="w-full p-3 text-center text-sm bg-gray-50 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <button
                onClick={handleCopyPix}
                className="mt-4 w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                {showCopyTooltip ? 'Copiado!' : 'Copiar Código PIX'}
              </button>
              
              {paymentData.transactionId && (
                <p className="mt-4 text-sm text-gray-600">
                  ID da Transação: {paymentData.transactionId}
                </p>
              )}
              
              <p className="mt-6 text-sm text-gray-700 font-medium">
                Aguardando pagamento...
              </p>
            </div>

            {/* Instruções */}
            <div className="mt-6 bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Como pagar:</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Abra o aplicativo do seu banco</li>
                <li>2. Escolha a opção PIX</li>
                <li>3. Cole o código copiado</li>
                <li>4. Confirme o pagamento</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-xl w-full">
        {/* Identificação */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-4">
          <div className="mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">1</span>
              <h3 className="text-lg font-semibold ml-3 text-gray-800">Identifique-se</h3>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome e sobrenome
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Seu nome completo"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                  formErrors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="seu@email.com"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                  formErrors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
            </div>
            
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Telefone/WhatsApp
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(00) 00000-0000"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                  formErrors.phone ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              />
            </div>
          </div>
        </div>

        {/* Pagamento */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">2</span>
              <h3 className="text-lg font-semibold ml-3 text-gray-800">Pagamento</h3>
            </div>
          </div>

          {/* Método PIX */}
          <div className="mb-6">
            <div className="flex items-center p-4 border border-indigo-600 bg-indigo-50 rounded-lg">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center mr-4">
                <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="flex-1 flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-green-600 mr-2" viewBox="0 0 512 512" fill="currentColor">
                    <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H112.6C132.6 391.2 151.5 383.4 165.7 369.2L242.4 292.5zM262.5 218.9C256.1 224.4 247.9 224.5 242.4 218.9L165.7 142.2C151.5 127.1 132.6 120.2 112.6 120.2H103.3L200.7 22.76C231.1-7.586 280.3-7.586 310.6 22.76L407.8 119.9H392.6C372.6 119.9 353.7 127.7 339.5 141.9L262.5 218.9zM112.6 142.7C126.4 142.7 139.1 148.3 149.7 158.1L226.4 234.8C233.6 241.1 243 245.6 252.5 245.6C261.9 245.6 271.3 241.1 278.5 234.8L355.5 157.8C365.3 148.1 378.8 142.5 392.6 142.5H430.3L488.6 200.8C518.9 231.1 518.9 280.3 488.6 310.6L430.3 368.9H392.6C378.8 368.9 365.3 363.3 355.5 353.5L278.5 276.5C264.6 262.6 240.3 262.6 226.4 276.6L149.7 353.2C139.1 363 126.4 368.6 112.6 368.6H80.78L22.76 310.6C-7.586 280.3-7.586 231.1 22.76 200.8L80.78 142.7H112.6z"/>
                  </svg>
                  <span className="font-medium text-gray-800">PIX</span>
                </div>
                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold">
                  APROVAÇÃO IMEDIATA
                </span>
              </div>
            </div>

            {/* CPF */}
            <div className="mt-4 pl-4 border-l-2 border-gray-200">
              <div className="mb-4">
                <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => handleInputChange('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                    formErrors.cpf ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
              </div>

              {/* Resumo do Produto */}
              {cartData && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800 mb-3">Você está adquirindo:</h3>
                  {cartData.items.map(item => (
                    <div key={item.id} className="flex items-center py-2 border-b border-gray-200 last:border-b-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm font-bold text-green-700">{formatPrice(item.price)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-gray-200">
                    <dt className="text-lg font-bold text-gray-900">Total:</dt>
                    <dd className="text-xl font-semibold text-gray-900">
                      <span className="text-base font-medium">1x de</span> {formatPrice(cartData.total)}
                    </dd>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botão de Pagamento */}
          <div>
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg text-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Processando pagamento, aguarde...' : 'PAGAR AGORA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}