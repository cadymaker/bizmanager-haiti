// lib/bazik.ts
// Client sèvè pou API Bazik (MonCash): otantifikasyon, kreye peman,
// verifye estati, ak verifikasyon siyati webhook.
// Sèvi SÈLMAN sou sèvè a (API routes / server actions). Pa janm enpòte l nan kòd kliyan.

import crypto from "crypto";

const BAZIK_BASE_URL = process.env.BAZIK_BASE_URL ?? "https://api.bazik.io";
const BAZIK_USER_ID = process.env.BAZIK_USER_ID ?? "";
const BAZIK_SECRET_KEY = process.env.BAZIK_SECRET_KEY ?? "";
const BAZIK_WEBHOOK_SECRET = process.env.BAZIK_WEBHOOK_SECRET ?? "";

// Plafon MonCash pa tranzaksyon
export const MONCASH_MAX_GDES = 75000;

export class BazikError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "BazikError";
    this.status = status;
    this.body = body;
  }
}

// ---- Jesyon token (kache an memwa pou chak enstans "warm") ----
interface CachedToken {
  accessToken: string;
  userId: string;
  expiresAt: number; // epoch ms
}
let tokenCache: CachedToken | null = null;

// Doc la kontradiktwa (1h vs 86400s). Nou plafone TTL a a 55 min
// epi nou re-otantifye otomatikman sou yon 401.
const MAX_TOKEN_TTL_MS = 55 * 60 * 1000;

async function fetchToken(): Promise<CachedToken> {
  const res = await fetch(`${BAZIK_BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userID: BAZIK_USER_ID, secretKey: BAZIK_SECRET_KEY }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BazikError("Echèk otantifikasyon Bazik", res.status, data);

  const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
  return {
    accessToken: data.access_token,
    userId: data.user_id ?? BAZIK_USER_ID,
    expiresAt: Date.now() + Math.min(expiresInMs, MAX_TOKEN_TTL_MS) - 60_000,
  };
}

async function getToken(forceRefresh = false): Promise<CachedToken> {
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache;
  }
  tokenCache = await fetchToken();
  return tokenCache;
}

// Ti anvlòp ki re-otantifye yon fwa sou yon 401 epi reeseye
async function bazikFetch(
  path: string,
  init: RequestInit,
  retryOn401 = true
): Promise<Response> {
  const token = await getToken();
  const res = await fetch(`${BAZIK_BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store",
  });
  if (res.status === 401 && retryOn401) {
    await getToken(true);
    return bazikFetch(path, init, false);
  }
  return res;
}

// ---- Kreye yon peman MonCash ----
export interface CreatePaymentParams {
  gdes: number;
  referenceId: string;
  description?: string;
  successUrl?: string;
  errorUrl?: string;
  webhookUrl?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentResult {
  orderId: string;
  redirectUrl: string;
  status: string;
}

export async function createMonCashPayment(
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  if (!(params.gdes > 0)) throw new BazikError("Montan an dwe pi gwo pase 0", 400, null);
  if (params.gdes > MONCASH_MAX_GDES) {
    throw new BazikError(
      `Montan an depase plafon MonCash lan (${MONCASH_MAX_GDES} HTG)`,
      400,
      null
    );
  }

  const token = await getToken();
  const res = await bazikFetch("/moncash/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gdes: params.gdes,
      userID: token.userId,
      referenceId: params.referenceId,
      description: params.description,
      successUrl: params.successUrl,
      errorUrl: params.errorUrl,
      webhookUrl: params.webhookUrl,
      customerFirstName: params.customerFirstName,
      customerLastName: params.customerLastName,
      customerEmail: params.customerEmail,
      metadata: params.metadata ?? {},
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BazikError("Echèk kreyasyon peman Bazik", res.status, data);

  // Analiz defansif — doc la pa montre non chan repons yo egzakteman
  const orderId = data.orderId ?? data.order_id ?? data.id;
  const redirectUrl = data.redirectUrl ?? data.redirect_url ?? data.url;
  if (!orderId || !redirectUrl) {
    throw new BazikError("Repons Bazik la pa gen orderId/redirectUrl", res.status, data);
  }
  return { orderId, redirectUrl, status: data.status ?? "pending" };
}

// ---- Verifye estati yon peman ----
export interface OrderStatus {
  orderId: string;
  status: string; // "successful" | "pending" | "failed" | "cancelled"
  referenceId?: string;
  amount?: number;
  currency?: string;
  raw: unknown;
}

export async function verifyOrder(orderId: string): Promise<OrderStatus> {
  const res = await bazikFetch(`/order/${encodeURIComponent(orderId)}`, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BazikError("Echèk verifikasyon peman Bazik", res.status, data);

  return {
    orderId: data.orderId ?? orderId,
    status: data.status ?? "unknown",
    referenceId: data.referenceId,
    amount: typeof data.amount === "number" ? data.amount : undefined,
    currency: data.currency,
    raw: data,
  };
}

export async function isOrderPaid(orderId: string): Promise<boolean> {
  const { status } = await verifyOrder(orderId);
  return status === "successful";
}

// ---- Verifikasyon siyati webhook (HMAC-SHA256) ----
// IMPÒTAN: rawBody dwe kò a TÈL KEL YE (string brit), pa JSON.parse.
// Fòma: v1=<hex> sou chèn `${timestamp}.${eventId}.${rawBody}`.
export function verifyWebhookSignature(args: {
  rawBody: string;
  timestamp: string | null;
  eventId: string | null;
  signatureHeader: string | null;
}): boolean {
  const { rawBody, timestamp, eventId, signatureHeader } = args;
  if (!timestamp || !eventId || !signatureHeader || !BAZIK_WEBHOOK_SECRET) return false;

  const signedPayload = `${timestamp}.${eventId}.${rawBody}`;
  const expected = `v1=${crypto
    .createHmac("sha256", BAZIK_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex")}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false; // konparezon ki sekirize kont atak sou tan
  return crypto.timingSafeEqual(a, b);
}