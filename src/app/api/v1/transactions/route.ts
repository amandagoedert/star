import { NextRequest, NextResponse } from "next/server";

interface BynetCustomer {
  name: string;
  email: string;
  phone: string;
  document: {
    type: "cpf" | "cnpj";
    number: string;
  };
}

interface BynetItem {
  title: string;
  unitPrice: number;
  quantity: number;
  externalRef: string;
  tangible: boolean;
}

interface BynetCreateTransactionRequest {
  amount: number;
  externalRef: string;
  customer: BynetCustomer;
  items: BynetItem[];
  paymentMethod: "pix" | "credit_card" | "boleto";
  metadata?: string;
  postbackUrl?: string;
}

interface BynetPixResponse {
  qrcode?: string;
  payload?: string;
  expirationDate?: string;
  expirationDateTime?: string;
}

interface BynetTransactionResponse {
  transactionId: string;
  id?: string;
  status:
    | "pending"
    | "waiting_payment"
    | "paid"
    | "approved"
    | "cancelled"
    | "expired"
    | "refunded";
  paymentMethod: string;
  amount: number;
  externalRef: string;
  customer: BynetCustomer;
  items: BynetItem[];
  createdAt?: string;
  updatedAt?: string;
  register?: string;
  pix?: BynetPixResponse;
  error?: string;
  message?: string;
}

interface BynetErrorResponse {
  error: string;
  message: string;
  details?: any;
}

interface FrontendItem {
  id?: string;
  name?: string;
  price?: string | number;
  quantity?: string | number;
}

interface CreatePaymentRequest {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  paymentMethod: string;
  amount: number;
  traceable?: boolean;
  referrer?: string;
  userAgent?: string;
  sessionId?: string;
  redirectUrl?: string;
  items?: FrontendItem[];
  utms?: Record<string, any>;
}

interface PaymentPixData {
  qrcode: string;
  qrcodeImage: string;
  expirationDate: string;
  end2EndId: string;
}

interface CreatePaymentResponse {
  status: string;
  id: string;
  pix: PaymentPixData | null;
}

interface PaymentStatusResponse {
  id: string;
  status: string;
  method: string;
  customId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  amount?: number;
}

interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: any;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreatePaymentResponse | ApiErrorResponse>> {
  try {
    const requestData: CreatePaymentRequest = await request.json();

    const {
      name,
      email,
      cpf,
      phone,
      paymentMethod,
      amount,
      traceable,
      referrer,
      userAgent,
      sessionId,
      redirectUrl,
      items,
      utms,
    } = requestData;

    if (!name || !email || !cpf || !phone || !amount) {
      return NextResponse.json(
        { error: "Campos obrigatórios: name, email, cpf, phone, amount" },
        { status: 400 }
      );
    }

    const normalizedItems: BynetItem[] = items?.map((item) => ({
      title: "Método Infinity",
      unitPrice:
        typeof item.price === "number"
          ? Math.round(item.price * 100)
          : Math.round(Number(item.price) * 100),
      quantity: Number(item.quantity || 1),
      externalRef: "",
      tangible: false,
    })) || [
      {
        title: "Método Infinity",
        unitPrice: Math.round(amount * 100),
        quantity: 1,
        externalRef: "",
        tangible: false,
      },
    ];

    const secretKey = process.env.BYNET_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "Configuração de API não encontrada" },
        { status: 500 }
      );
    }

    const authHeader =
      "Basic " + Buffer.from(`${secretKey}:x`).toString("base64");

    const bynetPayload: BynetCreateTransactionRequest = {
      amount: Math.round(amount * 100),
      externalRef: referrer || `order_${Date.now()}`,
      customer: {
        name,
        email,
        phone,
        document: {
          type: "cpf",
          number: cpf.replace(/\D/g, ""),
        },
      },
      items: normalizedItems,
      paymentMethod: "pix",
      metadata: JSON.stringify({
        provider: "Bynet Global",
        utmData: utms,
        sessionId,
        customerData: { name, email, phone },
        userAgent,
        traceable,
      }),
      ...(redirectUrl && { postbackUrl: redirectUrl }),
    };

    console.log("🚀 Send Bynet:", {
      payload: bynetPayload,
    });

    const bynetResponse = await fetch(
      "https://api.bynetglobal.com.br/v1/transactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(bynetPayload),
      }
    );

    const bynetData: BynetTransactionResponse | BynetErrorResponse =
      await bynetResponse.json();

    console.log("📥 Response Bynet:", {
      status: bynetResponse.status,
      data: bynetData,
    });

    if (!bynetResponse.ok || "error" in bynetData) {
      const errorData = bynetData as BynetErrorResponse;
      return NextResponse.json(
        {
          error: errorData.error || "Erro na API de pagamento",
          message: errorData.message,
          details: errorData.details,
        },
        { status: bynetResponse.status || 400 }
      );
    }

    const successData = bynetData as BynetTransactionResponse;

    const frontendResponse: CreatePaymentResponse = {
      status: successData.status || "pending",
      id: successData.id ? successData.id.toString() : "",
      pix: successData.pix
        ? {
            qrcode: successData.pix.qrcode || "",
            qrcodeImage: "", // Não precisamos mais
            expirationDate: successData.pix.expirationDate || "",
            end2EndId: successData.id ? successData.id.toString() : "",
          }
        : null,
    };

    return NextResponse.json(frontendResponse);
  } catch (error: any) {
    console.error("❌ Error API POST:", error);

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        message: "Falha ao processar pagamento",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<PaymentStatusResponse | ApiErrorResponse>> {
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID da transação é obrigatório" },
        { status: 400 }
      );
    }

    const secretKey = process.env.BYNET_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "Configuração de API não encontrada" },
        { status: 500 }
      );
    }

    const authHeader =
      "Basic " + Buffer.from(`${secretKey}:x`).toString("base64");

    const bynetResponse = await fetch(
      `https://api.bynetglobal.com.br/v1/transactions/${id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      }
    );

    if (!bynetResponse.ok) {
      const errorData = await bynetResponse.json();
      return NextResponse.json(
        {
          error: "Falha ao consultar status",
          message: errorData.message,
          details: errorData,
        },
        { status: bynetResponse.status }
      );
    }

    const bynetData: BynetTransactionResponse = await bynetResponse.json();

    console.log("📥 Status transaction:", bynetData);

    const statusMap: Record<string, string> = {
      pending: "pending",
      waiting_payment: "pending",
      paid: "paid",
      approved: "paid",
      cancelled: "cancelled",
      expired: "expired",
      refunded: "refunded",
    };

    const normalizedStatus =
      statusMap[bynetData.status?.toLowerCase()] ||
      bynetData.status?.toLowerCase() ||
      "unknown";

    const frontendResponse: PaymentStatusResponse = {
      id: bynetData.transactionId || bynetData.id || id,
      status: normalizedStatus,
      method: bynetData.paymentMethod || "pix",
      customId: bynetData.externalRef || null,
      createdAt: bynetData.createdAt || bynetData.register || null,
      updatedAt: bynetData.updatedAt || bynetData.register || null,
      amount: bynetData.amount ? bynetData.amount / 100 : 19790,
    };

    return NextResponse.json(frontendResponse);
  } catch (error: any) {
    console.error("❌ Error API GET:", error);

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        message: "Falha ao consultar status",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
