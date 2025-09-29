import { NextRequest, NextResponse } from 'next/server'

const TRIBOPAY_BASE_URL = 'https://api.tribopay.com.br/api/public/v1'

interface FrontendItem {
  id?: string
  name?: string
  price?: number | string
  quantity?: number | string
  productHash?: string
  offerHash?: string
  tangible?: boolean
  operationType?: number
  cover?: string | null
}

interface FrontendAddress {
  street_name?: string
  streetName?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  zipCode?: string
}

interface FrontendCustomer {
  name?: string
  email?: string
  phone_number?: string
  document?: string
  street_name?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
}

interface CreatePaymentRequest {
  // Campos novos conforme documentação TriboPay
  amount: number
  offer_hash?: string
  payment_method?: string
  customer?: FrontendCustomer
  cart?: TriboPayCartItem[]
  expire_in_days?: number
  transaction_origin?: string
  tracking?: Record<string, string>
  postback_url?: string
  
  // Campos legados para compatibilidade
  name?: string
  email?: string
  cpf?: string
  phone?: string
  paymentMethod?: string
  items?: FrontendItem[]
  utms?: Record<string, unknown>
  address?: FrontendAddress
  postbackUrl?: string
  offerHash?: string
  transactionOrigin?: string
}

interface TriboPayCustomerPayload {
  name: string
  email: string
  phone_number: string
  document: string
  street_name: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  zip_code: string
}

interface TriboPayCartItem {
  product_hash: string // Obrigatório conforme documentação
  title: string
  cover?: string | null
  price: number
  quantity: number
  operation_type: number
  tangible: boolean
}

interface TriboPayCreateTransactionRequest {
  amount: number
  offer_hash: string
  payment_method: 'pix'
  customer: TriboPayCustomerPayload
  cart: TriboPayCartItem[]
  installments?: number
  expire_in_days?: number
  transaction_origin?: string
  tracking?: Record<string, string>
  postback_url?: string
}

interface TriboPayPixResponse {
  qr_code_text?: string
  qr_code?: string
  emv?: string
  code?: string
  payload?: string
  image_base64?: string
  qrcode_base64?: string
  qrcode_image?: string
  image?: string
  expires_at?: string
  expiration_date?: string
  end_to_end_id?: string
}

interface TriboPayTransactionResponse {
  hash?: string
  transaction_hash?: string
  id?: string
  status?: string
  amount?: number
  payment_method?: string
  offer_hash?: string
  reference?: string
  external_reference?: string
  created_at?: string
  updated_at?: string
  paid_at?: string
  expires_at?: string
  expiration_date?: string
  qr_code?: string
  qr_code_text?: string
  qr_code_image?: string
  pix?: TriboPayPixResponse
  message?: string
  error?: string | Record<string, unknown>
  errors?: unknown
}

interface TriboPayErrorResponse {
  error?: string | Record<string, unknown>
  message?: string
  errors?: Record<string, unknown>
}

interface PaymentPixData {
  qrcode: string
  qrcodeImage: string
  expirationDate: string
  end2EndId: string
}

interface CreatePaymentResponse {
  status: string
  id: string
  pix: PaymentPixData | null
}

interface PaymentStatusResponse {
  id: string
  status: string
  method: string
  customId: string | null
  createdAt: string | null
  updatedAt: string | null
  amount?: number
}

interface ApiErrorResponse {
  error: string
  message?: string
  details?: unknown
}

const STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  processing: 'pending',
  waiting_payment: 'pending',
  created: 'pending',
  paid: 'paid',
  approved: 'paid',
  completed: 'paid',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  refunded: 'refunded',
  failed: 'cancelled',
  expired: 'expired',
}

const DIGITS_REGEX = /\D/g

function sanitizeDigits(value?: string | null): string {
  if (!value) return ''
  return value.replace(DIGITS_REGEX, '')
}

function getFirstNonEmpty(
  ...values: Array<string | undefined | null>
): string | undefined {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

function buildTracking(
  utms?: Record<string, unknown>
): Record<string, string> | undefined {
  if (!utms) return undefined

  const tracking = {
    src: String(utms.src ?? ''),
    utm_source: String(utms.utm_source ?? utms.source ?? ''),
    utm_medium: String(utms.utm_medium ?? ''),
    utm_campaign: String(utms.utm_campaign ?? ''),
    utm_term: String(utms.utm_term ?? ''),
    utm_content: String(utms.utm_content ?? ''),
  }

  const hasValue = Object.values(tracking).some(value => value !== '')
  return hasValue ? tracking : undefined
}

function normalizeCart(
  items: FrontendItem[],
  fallbackAmount: number
): TriboPayCartItem[] {
  if (!items || items.length === 0) {
    return [
      {
        product_hash: 'tybzriceak', // Hash correto do produto principal
        title: 'Pedido Infinity',
        price: Math.max(Math.round(fallbackAmount * 100), 0),
        quantity: 1,
        operation_type: 1,
        tangible: false,
      },
    ]
  }

  return items
    .map(item => {
      const price =
        typeof item.price === 'number'
          ? item.price
          : Number(item.price ?? 0)
      const quantity = Number(item.quantity ?? 1)

      if (!Number.isFinite(price) || price <= 0) return null
      if (!Number.isFinite(quantity) || quantity <= 0) return null

      const normalized: TriboPayCartItem = {
        product_hash: item.productHash || (item.id === 'chip-infinity' ? 'tybzriceak' : item.id) || 'tybzriceak', // Hash correto do produto
        title: item.name ?? 'Item',
        price: Math.round(price * 100),
        quantity,
        operation_type: item.operationType ?? 1,
        tangible: item.tangible ?? false,
      }

      if (typeof item.cover === 'string') normalized.cover = item.cover

      return normalized
    })
    .filter((value): value is TriboPayCartItem => value !== null)
}

async function parseResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('Erro ao interpretar resposta da TriboPay:', error)
    return null
  }
}

function extractPixData(
  data: TriboPayTransactionResponse
): { code: string; image?: string; expiration?: string; endToEndId?: string } | null {
  const pix = data.pix ?? {}
  const code =
    pix.qr_code_text ||
    pix.qr_code ||
    pix.emv ||
    pix.code ||
    pix.payload ||
    (pix as any).pix_qr_code ||
    (pix as any).copy_paste ||
    data.qr_code_text ||
    data.qr_code

  if (!code) return null

  const image =
    pix.image_base64 ||
    pix.qrcode_base64 ||
    pix.qrcode_image ||
    pix.image ||
    data.qr_code_image

  const expiration =
    pix.expiration_date || pix.expires_at || data.expires_at || data.expiration_date

  const endToEndId =
    pix.end_to_end_id || data.transaction_hash || data.hash || data.id

  return { code, image, expiration, endToEndId }
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function collectPixCandidates(data: TriboPayTransactionResponse) {
  const pix = data.pix || ({} as TriboPayPixResponse)
  return {
    pixKeys: Object.keys(pix),
    candidates: {
      qr_code_text: (pix as any).qr_code_text,
      qr_code: (pix as any).qr_code,
      emv: (pix as any).emv,
      code: (pix as any).code,
      payload: (pix as any).payload,
      image_base64: (pix as any).image_base64,
      qrcode_base64: (pix as any).qrcode_base64,
      qrcode_image: (pix as any).qrcode_image,
      image: (pix as any).image,
      topLevel_qr_code_text: (data as any).qr_code_text,
      topLevel_qr_code: (data as any).qr_code,
      topLevel_qr_code_image: (data as any).qr_code_image,
    },
  }
}

async function retrievePixWithRetry(
  idOrHash: string,
  apiToken: string,
  maxAttempts = 12,
  delayMs = 800
): Promise<{ code: string; image?: string; expiration?: string; endToEndId?: string; attempts: number; lastCandidates?: any } | null> {
  let lastCandidates: any = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = `${TRIBOPAY_BASE_URL}/transactions/${idOrHash}?api_token=${encodeURIComponent(apiToken)}`
      const resp = await fetch(url, { headers: { Accept: 'application/json' } })
      const parsed = await parseResponse<TriboPayTransactionResponse>(resp)
      if (parsed) {
        lastCandidates = collectPixCandidates(parsed)
        const pix = extractPixData(parsed)
        if (pix) {
          console.log(`✅ PIX recuperado no attempt ${attempt}`)
          return { ...pix, attempts: attempt, lastCandidates }
        }
      }
    } catch (err) {
      console.warn('⚠️ Falha ao tentar recuperar PIX (tentativa)', attempt, err)
    }
    await wait(delayMs)
  }
  console.warn('⚠️ PIX não disponível após tentativas de retry', { lastCandidates })
  return null
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreatePaymentResponse | ApiErrorResponse>> {
  try {
  const debug = request.nextUrl.searchParams.get('debug') === '1'
  const requestData: CreatePaymentRequest = await request.json()
    console.log('📝 Dados recebidos:', JSON.stringify(requestData, null, 2))

    const apiToken = process.env.TRIBOPAY_API_TOKEN
    if (!apiToken) {
      console.error('❌ Token da API não configurado')
      return NextResponse.json(
        { error: 'Configuração de API não encontrada', message: 'Defina TRIBOPAY_API_TOKEN' },
        { status: 500 }
      )
    }

    // Tentar pegar offer_hash da requisição primeiro, depois do env
    const offerHash = requestData.offer_hash ?? requestData.offerHash ?? process.env.TRIBOPAY_OFFER_HASH
    if (!offerHash) {
      console.error('❌ Offer hash não configurado')
      return NextResponse.json(
        { error: 'Oferta não configurada', message: 'Defina TRIBOPAY_OFFER_HASH ou informe offer_hash na requisição' },
        { status: 500 }
      )
    }
    
    console.log('✅ Offer hash encontrado:', offerHash)
    console.log('📦 Hash do produto principal: tybzriceak')
    console.log('💳 Installments será definido como: 1 (obrigatório para TriboPay)')

    const amountValue = Number(requestData.amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      console.error('❌ Valor inválido:', amountValue)
      return NextResponse.json(
        { error: 'Valor inválido', message: 'Informe um valor de pagamento maior que zero' },
        { status: 400 }
      )
    }

    // Se a requisição tem estrutura nova (conforme documentação)
    if (requestData.customer && requestData.cart) {
      console.log('✅ Usando estrutura nova da documentação TriboPay')
      
      const customerData = requestData.customer
      const customerName = customerData.name
      const customerEmail = customerData.email
      const customerDocument = sanitizeDigits(customerData.document)
      const customerPhone = sanitizeDigits(customerData.phone_number)
      
      if (!customerName || !customerEmail || !customerDocument || !customerPhone) {
        console.error('❌ Campos obrigatórios ausentes no customer:', {
          name: !!customerName,
          email: !!customerEmail, 
          document: !!customerDocument,
          phone: !!customerPhone
        })
        return NextResponse.json(
          {
            error: 'Campos obrigatórios ausentes',
            message: 'Informe nome, email, documento e telefone do cliente',
          },
          { status: 400 }
        )
      }

      const amountInCents = Math.round(amountValue * 100)
      const cartItems = requestData.cart
      
      console.log('🛒 Usando carrinho da requisição:', JSON.stringify(cartItems, null, 2))

      // Validar dados essenciais antes de enviar
      console.log('🔍 Validando dados essenciais:')
      console.log('  - Nome:', customerName?.length, 'chars')
      console.log('  - Email:', customerEmail)
      console.log('  - CPF:', customerDocument?.length, 'digits')
      console.log('  - Telefone:', customerPhone?.length, 'digits')
      console.log('  - Cidade:', customerData.city)
      console.log('  - Estado:', customerData.state)
      console.log('  - CEP:', customerData.zip_code?.length, 'chars')

      const expireInDaysRaw = Number(requestData.expire_in_days ?? process.env.TRIBOPAY_EXPIRE_IN_DAYS ?? 1)
      const expireInDays = Number.isFinite(expireInDaysRaw) && expireInDaysRaw > 0
        ? Math.floor(expireInDaysRaw)
        : 1

      const postbackUrl = requestData.postback_url ?? process.env.TRIBOPAY_POSTBACK_URL
      const transactionOrigin = requestData.transaction_origin ?? process.env.TRIBOPAY_TRANSACTION_ORIGIN ?? 'api'

      const triboPayload: TriboPayCreateTransactionRequest = {
        amount: amountInCents,
        offer_hash: offerHash,
        payment_method: requestData.payment_method as 'pix' ?? 'pix',
        customer: {
          name: customerName,
          email: customerEmail,
          phone_number: customerPhone,
          document: customerDocument,
          street_name: customerData.street_name ?? '',
          number: customerData.number ?? 'S/N',
          complement: customerData.complement ?? '',
          neighborhood: customerData.neighborhood ?? 'Centro',
          city: customerData.city ?? '',
          state: customerData.state ?? '',
          zip_code: customerData.zip_code ?? '',
        },
        cart: cartItems,
        installments: 1, // Obrigatório mesmo para PIX
        expire_in_days: expireInDays,
        transaction_origin: transactionOrigin,
      }

      if (requestData.tracking) triboPayload.tracking = requestData.tracking
      if (postbackUrl) triboPayload.postback_url = postbackUrl

      console.log('📤 Payload final para TriboPay:', JSON.stringify(triboPayload, null, 2))
      
      const requestUrl = `${TRIBOPAY_BASE_URL}/transactions?api_token=${encodeURIComponent(apiToken)}`
      console.log('🌐 URL da requisição:', requestUrl.replace(apiToken, 'TOKEN_HIDDEN'))
      console.log('🔑 Token length:', apiToken.length)
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(triboPayload),
      })

      console.log('🌐 Status da resposta TriboPay:', response.status)
      console.log('🔍 Headers da resposta:', Object.fromEntries(response.headers.entries()))
      
      const responseText = await response.text()
      console.log('📄 Texto bruto da resposta:', responseText)
      
      let responseData: TriboPayTransactionResponse | TriboPayErrorResponse | null = null
      
      if (responseText) {
        try {
          responseData = JSON.parse(responseText)
          console.log('📥 Resposta da TriboPay (parsed):', JSON.stringify(responseData, null, 2))
        } catch (parseError) {
          console.error('❌ Erro ao fazer parse da resposta:', parseError)
          console.log('📄 Resposta não é JSON válido:', responseText)
        }
      } else {
        console.error('❌ Resposta vazia da TriboPay')
      }

      if (!response.ok || !responseData || 'error' in responseData) {
        let errorMessage = 'Erro na API de pagamento'
        let errorDetails: any = null
        
        if (!response.ok) {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`
        }
        
        if (responseData) {
          if (typeof responseData.message === 'string') {
            errorMessage = responseData.message
          }
          errorDetails = responseData.errors || responseData.error || responseData
        } else if (responseText) {
          errorMessage = 'Resposta inválida da TriboPay'
          errorDetails = { rawResponse: responseText }
        } else {
          errorMessage = 'Resposta vazia da TriboPay'
        }

        console.error('❌ Erro completo da TriboPay:', {
          status: response.status,
          statusText: response.statusText,
          message: errorMessage,
          details: errorDetails,
          rawResponse: responseText
        })

        return NextResponse.json(
          {
            error: 'Falha na criação da transação',
            message: errorMessage,
            details: errorDetails,
            httpStatus: response.status,
            rawResponse: responseText?.substring(0, 500) // Primeiros 500 chars
          },
          { status: response.status || 400 }
        )
      }

      const triboResponse = responseData as TriboPayTransactionResponse
      const pixData = extractPixData(triboResponse)
      let debugInfo: any = debug ? { phase: 'initial', candidates: collectPixCandidates(triboResponse) } : undefined
      let finalPix = pixData as (ReturnType<typeof extractPixData> & { attempts?: number; lastCandidates?: any }) | null
      if (!finalPix) {
        // Tentar recuperar via polling (às vezes a API gera depois)
        const txId =
          triboResponse.transaction_hash ||
          triboResponse.hash ||
          triboResponse.id ||
          ''
        if (txId) {
          console.log('⏳ PIX não veio imediato. Iniciando retry...')
          const recovered = await retrievePixWithRetry(txId, apiToken)
          if (recovered) {
            finalPix = recovered
            if (debug) debugInfo = { ...(debugInfo || {}), phase: 'retrieved', attempts: recovered.attempts, lastCandidates: recovered.lastCandidates }
          } else if (debug) {
            debugInfo = { ...(debugInfo || {}), phase: 'not_found_after_retry' }
          }
        }
      }

      const frontendResponse: CreatePaymentResponse = {
        status: triboResponse.status ?? 'pending',
        id:
          triboResponse.transaction_hash ||
          triboResponse.hash ||
          triboResponse.id ||
          '',
        pix: finalPix
          ? {
              qrcode: finalPix.code,
              qrcodeImage: finalPix.image ?? '',
              expirationDate: finalPix.expiration ?? '',
              end2EndId: finalPix.endToEndId ?? '',
            }
          : null,
      }
      if (debug) {
        return NextResponse.json({ ...frontendResponse, debugInfo }, { status: 200 })
      }
      return NextResponse.json(frontendResponse)
    }

    // Fallback para estrutura legada
    console.log('⚠️ Usando estrutura legada (compatibilidade)')
    
    const customerName = getFirstNonEmpty(
      requestData.customer?.name,
      requestData.name
    )
    const customerEmail = getFirstNonEmpty(
      requestData.customer?.email,
      requestData.email
    )
    const customerDocument = sanitizeDigits(
      getFirstNonEmpty(requestData.customer?.document, requestData.cpf)
    )
    const customerPhone = sanitizeDigits(
      getFirstNonEmpty(requestData.customer?.phone_number, requestData.phone)
    )

    const addressSource = requestData.address ?? {}
    const streetName = getFirstNonEmpty(
      addressSource.street_name,
      addressSource.streetName,
      requestData.customer?.street_name
    )
    const numberValue =
      getFirstNonEmpty(addressSource.number, requestData.customer?.number) ?? 'S/N'
    const complementValue =
      getFirstNonEmpty(addressSource.complement, requestData.customer?.complement) ?? ''
    const neighborhoodValue =
      getFirstNonEmpty(addressSource.neighborhood, requestData.customer?.neighborhood) ?? 'Centro'
    const cityValue = getFirstNonEmpty(
      addressSource.city,
      requestData.customer?.city
    )
    const stateValue = getFirstNonEmpty(
      addressSource.state,
      requestData.customer?.state
    )
    const zipCodeValue = sanitizeDigits(
      getFirstNonEmpty(
        addressSource.zip_code,
        addressSource.zipCode,
        requestData.customer?.zip_code
      )
    )

    // Validar campos obrigatórios do cliente
    if (!customerName || !customerEmail || !customerDocument || !customerPhone) {
      console.error('❌ Campos obrigatórios ausentes:', {
        name: !!customerName,
        email: !!customerEmail, 
        document: !!customerDocument,
        phone: !!customerPhone
      })
      return NextResponse.json(
        {
          error: 'Campos obrigatórios ausentes',
          message: 'Informe nome, email, documento e telefone do cliente',
        },
        { status: 400 }
      )
    }

    // Validar campos obrigatórios de endereço
    if (!streetName || !cityValue || !stateValue || !zipCodeValue) {
      console.error('❌ Endereço incompleto:', {
        street: !!streetName,
        city: !!cityValue,
        state: !!stateValue,
        zipCode: !!zipCodeValue
      })
      return NextResponse.json(
        {
          error: 'Endereço incompleto',
          message: 'Informe rua, cidade, estado e CEP do cliente',
        },
        { status: 400 }
      )
    }

    const amountInCents = Math.round(amountValue * 100)

    const cartItems = normalizeCart(requestData.items ?? [], amountValue)
    if (!cartItems.length) {
      cartItems.push({
        product_hash: 'tybzriceak', // Hash correto do produto
        title: 'Pedido Infinity',
        price: amountInCents,
        quantity: 1,
        operation_type: 1,
        tangible: false,
      })
    }
    
    console.log('🛒 Itens do carrinho normalizados:', JSON.stringify(cartItems, null, 2))

    const expireInDaysRaw = Number(process.env.TRIBOPAY_EXPIRE_IN_DAYS ?? 1)
    const expireInDays = Number.isFinite(expireInDaysRaw) && expireInDaysRaw > 0
      ? Math.floor(expireInDaysRaw)
      : 1

    const postbackUrl = requestData.postbackUrl ?? process.env.TRIBOPAY_POSTBACK_URL
    const transactionOrigin =
      requestData.transactionOrigin ?? process.env.TRIBOPAY_TRANSACTION_ORIGIN ?? 'api'

    const triboPayload: TriboPayCreateTransactionRequest = {
      amount: amountInCents,
      offer_hash: offerHash,
      payment_method: 'pix',
      customer: {
        name: customerName,
        email: customerEmail,
        phone_number: customerPhone,
        document: customerDocument,
        street_name: streetName,
        number: numberValue,
        complement: complementValue,
        neighborhood: neighborhoodValue,
        city: cityValue,
        state: stateValue,
        zip_code: zipCodeValue,
      },
      cart: cartItems,
      installments: 1, // Obrigatório mesmo para PIX
      expire_in_days: expireInDays,
      transaction_origin: transactionOrigin,
    }

    console.log('📤 Payload para TriboPay:', JSON.stringify(triboPayload, null, 2))

    const tracking = buildTracking(requestData.utms)
    if (tracking) triboPayload.tracking = tracking
    if (postbackUrl) triboPayload.postback_url = postbackUrl

    const response = await fetch(
      `${TRIBOPAY_BASE_URL}/transactions?api_token=${encodeURIComponent(apiToken)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(triboPayload),
      }
    )

    console.log('🌐 Status da resposta TriboPay:', response.status)
    
    const responseData = await parseResponse<
      TriboPayTransactionResponse | TriboPayErrorResponse
    >(response)
    
    console.log('📥 Resposta da TriboPay:', JSON.stringify(responseData, null, 2))

    if (!response.ok || !responseData || 'error' in responseData) {
      const errorMessage =
        (responseData &&
          typeof responseData.message === 'string' &&
          responseData.message) ||
        'Erro na API de pagamento'

      return NextResponse.json(
        {
          error: 'Falha na criação da transação',
          message: errorMessage,
          details: responseData?.errors ?? responseData?.error,
        },
        { status: response.status || 400 }
      )
    }

    const triboResponse = responseData as TriboPayTransactionResponse
    let recoveredPix = extractPixData(triboResponse)
    let debugInfo: any = debug ? { phase: 'legacy_initial', candidates: collectPixCandidates(triboResponse) } : undefined
    if (!recoveredPix) {
      const txId =
        triboResponse.transaction_hash ||
        triboResponse.hash ||
        triboResponse.id ||
        ''
      console.log('⏳ (LEGACY) PIX não veio imediato. Tentando recuperar...')
      const recovered = await retrievePixWithRetry(txId, apiToken, 8, 800)
      if (recovered) {
        recoveredPix = recovered
        if (debug) debugInfo = { ...(debugInfo || {}), phase: 'legacy_retrieved', attempts: recovered.attempts, lastCandidates: recovered.lastCandidates }
      } else if (debug) {
        debugInfo = { ...(debugInfo || {}), phase: 'legacy_not_found_after_retry' }
      }
    }

    const frontendResponse: CreatePaymentResponse = {
      status: triboResponse.status ?? 'pending',
      id:
        triboResponse.transaction_hash ||
        triboResponse.hash ||
        triboResponse.id ||
        '',
      pix: recoveredPix
        ? {
            qrcode: (recoveredPix as any).code,
            qrcodeImage: (recoveredPix as any).image ?? '',
            expirationDate: (recoveredPix as any).expiration ?? '',
            end2EndId: (recoveredPix as any).endToEndId ?? '',
          }
        : null,
    }
    if (debug) {
      return NextResponse.json({ ...frontendResponse, debugInfo }, { status: 200 })
    }
    return NextResponse.json(frontendResponse)
  } catch (error: any) {
    console.error('❌ Error API POST:', error)
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        message: 'Falha ao processar pagamento',
        details: error?.message,
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<PaymentStatusResponse | ApiErrorResponse>> {
  try {
    const id = request.nextUrl.searchParams.get('id')
    const debug = request.nextUrl.searchParams.get('debug') === '1'

    if (!id) {
      return NextResponse.json(
        { error: 'ID da transação é obrigatório' },
        { status: 400 }
      )
    }

    const apiToken = process.env.TRIBOPAY_API_TOKEN
    if (!apiToken) {
      return NextResponse.json(
        { error: 'Configuração de API não encontrada', message: 'Defina TRIBOPAY_API_TOKEN' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `${TRIBOPAY_BASE_URL}/transactions/${id}?api_token=${encodeURIComponent(apiToken)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    const responseData = await parseResponse<
      TriboPayTransactionResponse | TriboPayErrorResponse
    >(response)

    if (!response.ok || !responseData || 'error' in responseData) {
      const errorMessage =
        (responseData &&
          typeof responseData.message === 'string' &&
          responseData.message) ||
        'Falha ao consultar status'

      return NextResponse.json(
        {
          error: 'Falha ao consultar status',
          message: errorMessage,
          details: responseData?.errors ?? responseData?.error,
        },
        { status: response.status || 400 }
      )
    }

    const triboResponse = responseData as TriboPayTransactionResponse
    const statusKey = triboResponse.status?.toLowerCase() ?? ''
    const normalizedStatus = STATUS_MAP[statusKey] ?? 'unknown'

    // Recuperar PIX se disponível (para permitir frontend obter qrcode posteriormente)
    let recoveredPix = extractPixData(triboResponse)
    if (!recoveredPix) {
      const txId =
        triboResponse.transaction_hash ||
        triboResponse.hash ||
        triboResponse.id ||
        id
      // Aumenta tentativas para melhorar chance de obter PIX tardio
      recoveredPix = await retrievePixWithRetry(txId, apiToken, 8, 700)
    }

    const frontendResponse: (PaymentStatusResponse & { pix?: PaymentPixData | null; debugInfo?: any }) = {
      id:
        triboResponse.transaction_hash ||
        triboResponse.hash ||
        triboResponse.id ||
        (triboResponse.transaction_hash || triboResponse.hash || triboResponse.id || ''),
      status: normalizedStatus,
      method: (triboResponse.payment_method ?? 'pix').toLowerCase(),
      customId: triboResponse.reference || triboResponse.external_reference || null,
      createdAt: triboResponse.created_at ?? null,
      updatedAt: triboResponse.updated_at ?? triboResponse.paid_at ?? null,
      amount:
        typeof triboResponse.amount === 'number'
          ? triboResponse.amount / 100
          : undefined,
      pix: recoveredPix
        ? {
            qrcode: recoveredPix.code,
            qrcodeImage: recoveredPix.image ?? '',
            expirationDate: recoveredPix.expiration ?? '',
            end2EndId: recoveredPix.endToEndId ?? '',
          }
        : null,
    }

    if (debug) {
      const pixRaw = triboResponse.pix || {}
      const codeCandidates = {
        qr_code_text: (pixRaw as any)?.qr_code_text,
        qr_code: (pixRaw as any)?.qr_code,
        emv: (pixRaw as any)?.emv,
        code: (pixRaw as any)?.code,
        payload: (pixRaw as any)?.payload,
        topLevel_qr_code_text: (triboResponse as any)?.qr_code_text,
        topLevel_qr_code: (triboResponse as any)?.qr_code,
      }
      frontendResponse.debugInfo = {
        presentFields: Object.fromEntries(
          Object.entries(codeCandidates).filter(([, v]) => typeof v === 'string' && v.trim().length > 10)
        ),
        hasRecoveredPix: !!recoveredPix,
        statusOriginal: triboResponse.status,
      }
    }

    return NextResponse.json(frontendResponse)
  } catch (error: any) {
    console.error('❌ Error API GET:', error)
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        message: 'Falha ao consultar status',
        details: error?.message,
      },
      { status: 500 }
    )
  }
}
