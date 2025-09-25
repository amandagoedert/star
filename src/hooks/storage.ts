interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface Cart {
  items: CartItem[]
  total: number
  subtotal: number
}

interface Address {
  cep: string
  rua: string
  endereco: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  numero?: string
}

interface User {
  name: string
  email: string
  phone: string
  cpf: string
  shippingAddress: Address
}

const STORAGE_KEY = 'starlink_data'
const ENCRYPTION_KEY = 'sk_starlink_2024_secure_key_v1'

function encryptData(data: string): string {
  try {
    const combined = ENCRYPTION_KEY + data
    const encoded = btoa(encodeURIComponent(combined))

    let encrypted = ''
    for (let i = 0; i < encoded.length; i++) {
      const charCode =
        encoded.charCodeAt(i) ^
        ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      encrypted += String.fromCharCode(charCode)
    }

    return btoa(encrypted).split('').reverse().join('')
  } catch (error) {
    console.error('Encryption error:', error)
    return data
  }
}

function decryptData(encryptedData: string): string {
  try {
    const reversed = encryptedData.split('').reverse().join('')
    const decoded = atob(reversed)

    let decrypted = ''
    for (let i = 0; i < decoded.length; i++) {
      const charCode =
        decoded.charCodeAt(i) ^
        ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      decrypted += String.fromCharCode(charCode)
    }

    const final = decodeURIComponent(atob(decrypted))

    if (final.startsWith(ENCRYPTION_KEY)) {
      return final.substring(ENCRYPTION_KEY.length)
    }

    throw new Error('Invalid encryption key')
  } catch (error) {
    console.error('Decryption error:', error)
    return encryptedData
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function setStorageData(key: string, data: any): void {
  try {
    const jsonData = JSON.stringify(data)
    const encrypted = encryptData(jsonData)
    localStorage.setItem(`${STORAGE_KEY}_${key}`, encrypted)
  } catch (error) {
    console.error('Storage set error:', error)
  }
}

function getStorageData<T>(key: string): T | null {
  try {
    const encrypted = localStorage.getItem(`${STORAGE_KEY}_${key}`)
    if (!encrypted) return null

    const decrypted = decryptData(encrypted)
    return JSON.parse(decrypted) as T
  } catch (error) {
    console.error('Storage get error:', error)
    return null
  }
}

function removeStorageData(key: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${key}`)
  } catch (error) {
    console.error('Storage remove error:', error)
  }
}

export function setCart(cart: Cart): void {
  setStorageData('carrinho', cart)
}

export function getCart(): Cart | null {
  return getStorageData<Cart>('carrinho')
}

export function setAddress(address: Address): void {
  setStorageData('endereco', address)
}

export function getAddress(): Address | null {
  return getStorageData<Address>('endereco')
}

export function setUser(user: User): void {
  setStorageData('usuario', user)
}

export function getUser(): User | null {
  return getStorageData<User>('usuario')
}

export function clearAllData(): void {
  removeStorageData('carrinho')
  removeStorageData('endereco')
  removeStorageData('usuario')
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price)
}

export function getTrackedParams(): Record<string, string> {
  try {
    const params = localStorage.getItem('tracked_params')
    return params ? JSON.parse(params) : {}
  } catch (error) {
    console.error('Error getting tracked params:', error)
    return {}
  }
}

export type { Address, Cart, CartItem, User }
