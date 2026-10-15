// Server-only Daraja (M-Pesa) helpers. Never import from client code.

export type DarajaCreds = {
  shortcodeType: "till" | "paybill";
  shortcode: string;
  tillNumber: string | null;
  accountRef: string | null;
  passkey: string;
  consumerKey: string;
  consumerSecret: string;
};

function baseUrl(): string {
  return process.env["MPESA_ENV"] === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

/** 254XXXXXXXXX from 07XX…, 01XX…, +254…, 254… */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-()+]/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^[17]\d{8}$/.test(digits)) return "254" + digits;
  return null;
}

function timestamp(): string {
  // Daraja expects YYYYMMDDHHmmss in East Africa Time (UTC+3)
  const d = new Date(Date.now() + 3 * 3600_000);
  return d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

// ---- Encryption for organizer credentials (AES-GCM, key from MPESA_ENCRYPTION_KEY: base64 of 32 bytes) ----

async function aesKey(): Promise<CryptoKey> {
  const raw = process.env["MPESA_ENCRYPTION_KEY"];
  if (!raw) throw new Error("Payments are not configured yet (missing MPESA_ENCRYPTION_KEY).");
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bytes.length !== 32)
    throw new Error("MPESA_ENCRYPTION_KEY must be base64 of exactly 32 bytes.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aesKey(),
      new TextEncoder().encode(plain),
    ),
  );
  return `${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(blob: string): Promise<string> {
  const [iv, ct] = blob.split(".");
  if (!iv || !ct) throw new Error("Corrupt stored credential.");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    await aesKey(),
    unb64(ct),
  );
  return new TextDecoder().decode(pt);
}

// ---- Daraja calls ----

async function accessToken(c: DarajaCreds): Promise<string> {
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: "Basic " + btoa(`${c.consumerKey}:${c.consumerSecret}`) },
  });
  if (!res.ok)
    throw new Error("Couldn't authenticate with M-Pesa. Check the organizer's payment setup.");
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Couldn't authenticate with M-Pesa.");
  return json.access_token;
}

export type StkPushResult = { checkoutRequestId: string; merchantRequestId: string };

export async function stkPush(
  c: DarajaCreds,
  args: { phone: string; amount: number; callbackUrl: string; reference: string },
): Promise<StkPushResult> {
  const token = await accessToken(c);
  const ts = timestamp();
  const body = {
    BusinessShortCode: c.shortcode,
    Password: btoa(`${c.shortcode}${c.passkey}${ts}`),
    Timestamp: ts,
    TransactionType:
      c.shortcodeType === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
    Amount: Math.round(args.amount),
    PartyA: args.phone,
    PartyB: c.shortcodeType === "till" ? (c.tillNumber ?? c.shortcode) : c.shortcode,
    PhoneNumber: args.phone,
    CallBackURL: args.callbackUrl,
    AccountReference: (c.shortcodeType === "paybill" && c.accountRef
      ? c.accountRef
      : args.reference
    ).slice(0, 12),
    TransactionDesc: "Harambee donation",
  };
  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ResponseCode?: string;
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    errorMessage?: string;
  };
  if (!res.ok || json.ResponseCode !== "0" || !json.CheckoutRequestID) {
    console.error("[mpesa] STK push rejected", res.status, json.errorMessage ?? json.ResponseCode);
    throw new Error("M-Pesa couldn't send the prompt. Check the number and try again.");
  }
  return {
    checkoutRequestId: json.CheckoutRequestID,
    merchantRequestId: json.MerchantRequestID ?? "",
  };
}

export type StkQueryResult = { resultCode: number; resultDesc: string } | null;

/** Fallback when the callback never arrives. Returns null while the prompt is still being processed. */
export async function stkQuery(c: DarajaCreds, checkoutRequestId: string): Promise<StkQueryResult> {
  const token = await accessToken(c);
  const ts = timestamp();
  const res = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: c.shortcode,
      Password: btoa(`${c.shortcode}${c.passkey}${ts}`),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ResultCode?: string | number;
    ResultDesc?: string;
  };
  // Daraja answers with an error body while the transaction is still in flight
  if (!res.ok || json.ResultCode === undefined) return null;
  return { resultCode: Number(json.ResultCode), resultDesc: json.ResultDesc ?? "" };
}
