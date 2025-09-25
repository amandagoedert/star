'use client'

import ImageChip from '@/assets/images/chip-starlink.png'
import {
  type Cart,
  type CartItem,
  formatPrice,
  getAddress,
  getCart,
  setCart as saveCart,
} from '@/hooks/storage'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MapPin,
  Minus,
  Plus,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import Footer from './_footer'
import Loader from './_loading'
import Menu from './_menu'
import { useTrackedRouter } from './_tracker-push'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { useResetZoom } from '@/hooks/reset-page-zoom'

interface UserAddress {
  bairro: string
  cep: string
  complemento: string
  endereco: string
  rua: string
  cidade?: string
  estado?: string
}

export interface Product {
  id: string
  name: string
  price: number
  description: string
  image: string
  isRequired?: boolean
}

export const EQUIPMENT_PRODUCTS: Product[] = [
  {
    id: 'chip-infinity',
    name: 'Chip Infinity M3',
    price: 197.9,
    description:
      'Internet, ligações e sms ILIMITADOS PARA SEMPRE em qualquer lugar do mundo, sem recargas ou mensalidades. Com um único pagamento, você garante conexão estável e sem restrições, aproveitando a liberdade de se comunicar quando e onde quiser, sem preocupações.',
    image: '/chip-infinity-m3-v2.png',
    isRequired: true,
  },
]

export const ADDITIONAL_PRODUCTS: Product[] = [
  {
    id: 'carregador-portatil',
    name: 'Carregador Portátil Starlink',
    price: 89.9,
    description:
      'Mantenha-se sempre conectado com o Carregador Portátil Starlink. Compacto e de alta performance, ele garante que seus dispositivos permaneçam carregados onde quer que você esteja, assegurando conectividade contínua e sem interrupções.',
    image: '/carregador-portatil.png',
  },
  {
    id: 'roteador-3g',
    name: 'Roteador de 3ª Geração',
    price: 497.9,
    description:
      'Leve sua conexão a um novo nível, oferecendo velocidade, estabilidade e alcance superiores. Com banda tripla, tecnologia MU-MIMO 4x4 e OFDMA, distribui o sinal de forma inteligente, garantindo máximo desempenho para todos os seus dispositivos.',
    image: '/roteador-3-geracao.png',
  },
  {
    id: 'starlink-travel-bag',
    name: 'Starlink Travel Bag',
    price: 1289.9,
    description:
      'A Starlink Travel Bag protege sua Starlink contra impactos e intempéries, com material resistente e compartimentos personalizados. Transporte sua internet com praticidade e tenha conexão garantida onde estiver.',
    image: '/travel-bag.png',
  },
]

export default function OrderPage() {
  useResetZoom()

  const { push } = useTrackedRouter()
  const [userAddress, setUserAddress] = useState<UserAddress | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isOpenModalOrder, setIsOpenModalOrder] = useState(false)
  const [showDetailsEquipment, setShowDetailsEquipment] = useState(false)
  const [showDetailsAdditional, setShowDetailsAdditional] = useState(false)
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false)
  const [cart, setCart] = useState<Record<string, number>>({})

  useEffect(() => {    
    const savedCart = getCart()
    if (savedCart) {
      const cartItems: Record<string, number> = {}
      for (const item of savedCart.items) {
        cartItems[item.id] = item.quantity
      }
      setCart(cartItems)
    } else {
      setCart({ 'chip-infinity': 1 })
    }
  }, [])

  useEffect(() => {
    if (Object.keys(cart).length > 0) {
      const cartItems: CartItem[] = []
      let total = 0

      for (const product of [...EQUIPMENT_PRODUCTS, ...ADDITIONAL_PRODUCTS]) {
        const quantity = cart[product.id]
        if (quantity && quantity > 0) {
          const item: CartItem = {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity,
          }
          cartItems.push(item)
          total += product.price * quantity
        }
      }

      const cartData: Cart = {
        items: cartItems,
        total: total,
        subtotal: total,
      }

      saveCart(cartData)
    }
  }, [cart])

  useEffect(() => {
    if (isOpenModalOrder || showDetailsEquipment || showDetailsAdditional) {
      document.body.classList.add('overflow-y-hidden')
    } else {
      document.body.classList.remove('overflow-y-hidden')
    }
  }, [isOpenModalOrder, showDetailsAdditional, showDetailsEquipment])

  useEffect(() => {
    const addressData = getAddress()
    if (addressData) {
      setUserAddress({
        bairro: addressData.bairro,
        cep: addressData.cep,
        complemento: addressData.complemento,
        endereco: addressData.endereco,
        rua: addressData.rua,
        cidade: addressData.cidade,
        estado: addressData.estado,
      })
    }
    setIsLoadingData(false)
  }, [])

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart(prev => {
      if (newQuantity <= 0) {
        const { [productId]: removed, ...rest } = prev
        return rest
      }
      return { ...prev, [productId]: newQuantity }
    })
  }

  const addToCart = (productId: string) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const { [productId]: removed, ...rest } = prev
      return rest
    })
  }

  const calculateTotal = () => {
    let total = 0

    for (const product of EQUIPMENT_PRODUCTS) {
      const quantity = cart[product.id] || 0
      total += product.price * quantity
    }

    for (const product of ADDITIONAL_PRODUCTS) {
      const quantity = cart[product.id] || 0
      total += product.price * quantity
    }

    return total
  }

  const getCartItems = () => {
    const items: Array<Product & { quantity: number }> = []

    for (const product of [...EQUIPMENT_PRODUCTS, ...ADDITIONAL_PRODUCTS]) {
      const quantity = cart[product.id]
      if (quantity && quantity > 0) {
        items.push({ ...product, quantity })
      }
    }

    return items
  }

  const handleOpenModalOrder = () => {
    setIsOpenModalOrder(true)
  }

  const handleCloseModalOrder = () => {
    setIsOpenModalOrder(false)
  }

  const handleProductClick = (productId: string) => {
    if (cart[productId]) {
      removeFromCart(productId)
    } else {
      addToCart(productId)
    }
  }

  const handleToggleProductInModal = (productId: string) => {
    if (cart[productId]) {
      removeFromCart(productId)
    } else {
      addToCart(productId)
    }
  }

  return (
    <>
      {!isLoadingCheckout && (
        <>
          <main className="w-full max-w-3xl mx-auto bg-black">
            <header className="relative w-full overflow-hidden">
              <Menu className="bg-[#171717] animate-fade animate-once animate-ease-out animate-fill-both" />
            </header>

            <section className="relative px-5 pt-10 animate-fade-up animate-once animate-duration-[600ms] animate-delay-[200ms] animate-ease-out animate-normal animate-fill-both">
              <h1 className="text-2xl text-white font-bold mb-4">
                {formatPrice(197.9)} <s>(de {formatPrice(397.9)})</s> pelo Chip
                Infinity M3, Internet, ligações e sms ILIMITADOS PARA SEMPRE.
              </h1>
              <p>
                Internet, ligações e sms ILIMITADOS PARA SEMPRE em qualquer
                lugar do mundo, sem recargas ou mensalidades. Com um único
                pagamento, você garante conexão estável e sem restrições,
                aproveitando a liberdade de navegar e se comunicar quando e onde
                quiser, sem preocupações.
              </p>
              <div className="flex gap-2 items-center mt-6">
                <MapPin className="size-4 text-white" />
                <span className="text-white font-bold">
                  Endereço de uso do serviço
                </span>
              </div>
              <div className="mt-3">
                {isLoadingData ? (
                  <span className="text-sm text-white/70">
                    Carregando endereço...
                  </span>
                ) : userAddress ? (
                  <span className="text-sm text-white">
                    {userAddress.cidade}, Brasil
                  </span>
                ) : (
                  <span className="text-sm text-white/70">
                    Nenhum endereço encontrado.
                  </span>
                )}
              </div>
              <div className="mt-6">
                <Image
                  alt="Imagem Chip"
                  src={ImageChip}
                  className="w-full pb-10 animate-delay-[300ms] intersect:animate-fade-down intersect:animate-once intersect:animate-ease-out intersect:animate-fill-both"
                />
              </div>
            </section>

            <section className="relative px-5 pt-6 animate-fade-up animate-once animate-duration-[600ms] animate-delay-[200ms] animate-ease-out animate-normal animate-fill-both">
              <p className="font-bold">Equipamento</p>
              {EQUIPMENT_PRODUCTS.map(product => (
                <div
                  key={product.id}
                  className="mt-4 py-4 px-5 rounded-[4px] border border-[#434343] bg-[#292929]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-2 text-white">
                      <span className="font-bold">{product.name}</span>
                      <span>{formatPrice(product.price)}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center">
                      <Button
                        className="bg-black m-0 !p-1 w-auto h-auto rounded-none rounded-l-[4px] border border-[#434343]"
                        onClick={() =>
                          updateQuantity(
                            product.id,
                            Math.max(1, (cart[product.id] || 1) - 1)
                          )
                        }
                      >
                        <Minus size={8} className="text-white" />
                      </Button>
                      <div className="flex items-center justify-center w-7 px-3 text-white border-y border-y-[#434343]">
                        <span className="text-base">
                          {cart[product.id] || 1}
                        </span>
                      </div>
                      <Button
                        className="bg-black m-0 !p-1 w-auto h-auto rounded-none rounded-r-[4px] border border-[#434343]"
                        onClick={() =>
                          updateQuantity(
                            product.id,
                            (cart[product.id] || 1) + 1
                          )
                        }
                      >
                        <Plus size={8} className="text-white" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-3">
                <Button
                  className="px-2 m-0 flex items-center gap-1 bg-transparent text-[#BDBDBD] font-bold text-[13px] border border-[#BDBDBD]"
                  onClick={() => setShowDetailsEquipment(true)}
                >
                  <span>Detalhes do Equipamento</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </section>

            <section className="relative px-5 py-6 animate-fade-up animate-once animate-duration-[600ms] animate-delay-[200ms] animate-ease-out animate-normal animate-fill-both">
              <div className="flex gap-3">
                <p className="font-bold">Produtos adicionais</p>
                <span className="text-xs bg-[#171717] py-1 p-2 rounded-2xl text-white">
                  Opcional
                </span>
              </div>

              {ADDITIONAL_PRODUCTS.map(product => (
                <div
                  key={product.id}
                  className={`mt-3 py-4 px-5 rounded-[4px] border border-[#434343] cursor-pointer transition-colors ${
                    cart[product.id] ? 'bg-[#292929]' : ''
                  }`}
                  onClick={() => handleProductClick(product.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleProductClick(product.id)
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-4 text-white">
                    <span className="font-bold text-sm">{product.name}</span>
                    <span className="font-bold text-sm">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                </div>
              ))}

              <div className="mt-3">
                <Button
                  className="px-2 m-0 flex items-center gap-1 bg-transparent text-[#BDBDBD] font-bold text-[13px] border border-[#BDBDBD]"
                  onClick={() => setShowDetailsAdditional(true)}
                >
                  <span>Detalhes dos Adicionais</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </section>
          </main>

          <div className="sticky bottom-0 left-0 w-full px-5 py-5 bg-[#121212] cursor-pointer animate-fade-up animate-once animate-duration-[600ms] animate-delay-[1200ms] animate-ease-out animate-normal animate-fill-both">
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
                <span>{formatPrice(calculateTotal())}</span>
                <span>
                  <ChevronUp className="w-4" />
                </span>
              </div>
            </div>
            <div className="w-full">
              <Button
                onClick={() => setIsLoadingCheckout(true)}
                className="py-3.5 px-2.5 m-0 mt-4 h-auto w-full bg-white text-black text-base font-bold rounded-lg"
              >
                Concluir a compra
              </Button>
            </div>
          </div>

          <Footer />

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
                    <div className="min-w-[84px] grid grid-cols-3 items-center">
                      <Button
                        className="bg-black m-0 !p-1 w-auto h-auto rounded-none rounded-l-[4px] border border-[#434343]"
                        onClick={() => {
                          if (item.isRequired && item.quantity === 1) return
                          updateQuantity(item.id, item.quantity - 1)
                        }}
                      >
                        <Minus size={8} className="text-white" />
                      </Button>
                      <div className="flex items-center justify-center w-7 px-3 text-white border-y border-y-[#434343]">
                        <span className="text-base">{item.quantity}</span>
                      </div>
                      <Button
                        className="bg-black m-0 !p-1 w-auto h-auto rounded-none rounded-r-[4px] border border-[#434343]"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                      >
                        <Plus size={8} className="text-white" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="w-full flex flex-col gap-4 text-white mt-5">
                  <div className="flex gap-4 items-center justify-between">
                    <span className="font-bold">Total a pagar hoje</span>
                    <div className="flex gap-2">
                      <span className="font-bold">
                        {formatPrice(calculateTotal())}
                      </span>
                      <span>
                        <ChevronUp className="w-4" />
                      </span>
                    </div>
                  </div>
                  <div className="w-full">
                    <Button
                      onClick={() => setIsLoadingCheckout(true)}
                      className="py-3.5 px-2.5 m-0 mt-4 h-auto w-full bg-white text-black text-base font-bold rounded-lg"
                    >
                      Concluir a compra
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {showDetailsEquipment && (
            <div className="fixed inset-0 z-[150] top-0 left-0 min-h-svh w-full bg-black animate-fade animate-duration-[250ms]">
              <div className="h-full overflow-y-auto p-5">
                <div
                  className="mb-5 flex justify-end cursor-pointer"
                  onClick={() => setShowDetailsEquipment(false)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setShowDetailsEquipment(false)
                    }
                  }}
                >
                  <X className="text-[#A6A6A6] w-6 h-6" />
                </div>
                {EQUIPMENT_PRODUCTS.map(product => (
                  <div
                    key={product.id}
                    className={`border border-dashed rounded-[4px] p-5 mb-4 ${
                      cart[product.id] ? 'border-[#3E9679]' : 'border-[#434343]'
                    }`}
                  >
                    <div className="w-full flex justify-start mb-3">
                      <Image
                        alt={product.name}
                        src={product.image}
                        width={108}
                        height={108}
                      />
                    </div>
                    <div className="w-full flex flex-col gap-4 text-white mb-3">
                      <span className="font-bold text-xl">{product.name}</span>
                      <p className="text-base">{product.description}</p>
                      <span className="font-bold text-lg">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                    <div className="w-full">
                      <div
                        className={`w-full border border-[#434343] px-3 py-4 rounded-[4px] text-white ${
                          cart[product.id] ? 'bg-[#292929]' : 'bg-transparent'
                        }`}
                        onClick={() => handleToggleProductInModal(product.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleToggleProductInModal(product.id)
                          }
                        }}
                      >
                        <div className="w-full flex gap-2.5 items-center">
                          <Checkbox
                            checked={!!cart[product.id]}
                            className="border border-[#6C6C6C] bg-[#171717] rounded-[2px] data-[state=checked]:bg-[#3E9679] data-[state=checked]:border-[#3E9679]"
                          />
                          <span className="font-bold text-sm">
                            Adicionar ao carrinho
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showDetailsAdditional && (
            <div className="fixed inset-0 z-[150] top-0 left-0 min-h-svh h-auto w-full bg-black animate-fade animate-duration-[250ms]">
              <div className="h-full overflow-y-auto p-5">
                <div
                  className="mb-5 flex justify-end cursor-pointer"
                  onClick={() => setShowDetailsAdditional(false)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setShowDetailsAdditional(false)
                    }
                  }}
                >
                  <X className="text-[#A6A6A6] w-6 h-6" />
                </div>
                {ADDITIONAL_PRODUCTS.map(product => (
                  <div
                    key={product.id}
                    className={`border border-dashed rounded-[4px] p-5 mb-4 ${
                      cart[product.id] ? 'border-[#3E9679]' : 'border-[#434343]'
                    }`}
                  >
                    <div className="w-full flex justify-start mb-3">
                      <Image
                        alt={product.name}
                        src={product.image}
                        width={108}
                        height={108}
                      />
                    </div>
                    <div className="w-full flex flex-col gap-4 text-white mb-3">
                      <span className="font-bold text-xl">{product.name}</span>
                      <p className="text-base">{product.description}</p>
                      <span className="font-bold text-lg">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                    <div className="w-full">
                      <div
                        className={`w-full border border-[#434343] px-3 py-4 rounded-[4px] text-white ${
                          cart[product.id] ? 'bg-[#292929]' : 'bg-transparent'
                        }`}
                        onClick={() => handleToggleProductInModal(product.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleToggleProductInModal(product.id)
                          }
                        }}
                      >
                        <div className="w-full flex gap-2.5 items-center">
                          <Checkbox
                            checked={!!cart[product.id]}
                            className="border border-[#6C6C6C] bg-[#171717] rounded-[2px] data-[state=checked]:bg-[#3E9679] data-[state=checked]:border-[#3E9679]"
                          />
                          <span className="font-bold text-sm">
                            {cart[product.id]
                              ? 'Remover do carrinho'
                              : 'Adicionar ao carrinho'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isLoadingCheckout && (
        <Loader
          isLoading={isLoadingCheckout}
          timer={5000}
          onTimerEnd={() => {
            document.body.classList.remove('overflow-y-hidden')
            push('/checkout')
          }}
        />
      )}
    </>
  )
}
