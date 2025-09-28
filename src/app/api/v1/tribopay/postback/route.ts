import { NextRequest, NextResponse } from 'next/server'

type PostbackPayload = Record<string, unknown> & {
  transaction?: Record<string, unknown>
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

function getFirstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }
  return null
}

function getFirstNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim()
      if (!normalized) continue

      const parsed = Number(normalized)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function normalizeStatus(status: string | null): string {
  if (!status) return 'unknown'
  const normalized = status.toLowerCase()
  return STATUS_MAP[normalized] ?? normalized
}

export async function POST(request: NextRequest) {
  let rawPayload: unknown

  try {
    rawPayload = await request.json()
  } catch (error) {
    console.error('TriboPay postback: corpo inválido', error)
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: 'Não foi possível interpretar o corpo da requisição',
      },
      { status: 400 }
    )
  }

  if (!rawPayload || typeof rawPayload !== 'object') {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: 'O corpo do postback deve ser um objeto JSON',
      },
      { status: 400 }
    )
  }

  const payload = rawPayload as PostbackPayload
  const transactionData =
    typeof payload.transaction === 'object' && payload.transaction !== null
      ? payload.transaction
      : undefined

  const transactionId =
    getFirstString(
      payload['transaction_hash'],
      payload['hash'],
      payload['id'],
      payload['reference'],
      payload['external_reference'],
      transactionData?.['transaction_hash'],
      transactionData?.['hash'],
      transactionData?.['id'],
      transactionData?.['reference'],
      transactionData?.['external_reference']
    ) ?? null

  if (!transactionId) {
    console.warn('TriboPay postback sem identificador de transação', payload)
    return NextResponse.json(
      {
        error: 'missing_transaction_id',
        message: 'Não foi possível identificar a transação enviada pela TriboPay',
      },
      { status: 422 }
    )
  }

  const rawStatus = getFirstString(
    payload['status'],
    transactionData?.['status']
  )
  const status = normalizeStatus(rawStatus)

  const paymentMethod =
    getFirstString(
      payload['payment_method'],
      transactionData?.['payment_method']
    )?.toLowerCase() ?? 'pix'

  const amountRaw = getFirstNumber(payload['amount'], transactionData?.['amount'])
  const amount =
    typeof amountRaw === 'number'
      ? amountRaw >= 1000
        ? amountRaw / 100
        : amountRaw
      : undefined

  const postbackSecret = process.env.TRIBOPAY_POSTBACK_SECRET
  if (postbackSecret) {
    const providedSecret =
      getFirstString(request.headers.get('x-tribopay-secret') ?? undefined) ??
      getFirstString(request.headers.get('x-postback-token') ?? undefined) ??
      getFirstString(request.nextUrl.searchParams.get('token') ?? undefined)

    if (providedSecret !== postbackSecret) {
      console.warn('TriboPay postback rejeitado por segredo inválido', {
        transactionId,
      })
      return NextResponse.json(
        {
          error: 'unauthorized',
          message: 'Segredo do postback inválido',
        },
        { status: 401 }
      )
    }
  }

  console.info('TriboPay postback recebido', {
    transactionId,
    status,
    paymentMethod,
    amount,
  })

  // Integrações adicionais (CRM, banco de dados, e-mail, etc.) podem ser feitas aqui

  return NextResponse.json({
    ok: true,
    transactionId,
    status,
    paymentMethod,
    amount,
    receivedAt: new Date().toISOString(),
  })
}
