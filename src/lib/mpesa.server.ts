// Server-only Daraja (M-Pesa) helpers. Credentials come from environment secrets.

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

export function darajaBase() {
  return process.env["MPESA_ENV"] === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export async function getAccessToken() {
  const auth = btoa(`${env("MPESA_CONSUMER_KEY")}:${env("MPESA_CONSUMER_SECRET")}`);
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    console.error("Daraja token error", res.status, await res.text());
    throw new Error("M-Pesa is unavailable right now. Please try again.");
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

function nairobiTimestamp() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function password(timestamp: string) {
  return btoa(`${env("MPESA_SHORTCODE")}${env("MPESA_PASSKEY")}${timestamp}`);
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^[17]\d{8}$/.test(digits)) return "254" + digits;
  return null;
}

export async function stkPush(opts: { phone: string; amount: number; reference: string; description: string }) {
  const token = await getAccessToken();
  const timestamp = nairobiTimestamp();
  const shortcode = env("MPESA_SHORTCODE");
  const isTill = (process.env["MPESA_SHORTCODE_TYPE"] ?? "paybill").toLowerCase() === "till";
  const callback = `${env("PUBLIC_APP_URL").replace(/\/$/, "")}/api/public/mpesa/callback?token=${encodeURIComponent(env("MPESA_CALLBACK_SECRET"))}`;
  const res = await fetch(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password(timestamp),
      Timestamp: timestamp,
      TransactionType: isTill ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
      Amount: Math.round(opts.amount),
      PartyA: opts.phone,
      PartyB: shortcode,
      PhoneNumber: opts.phone,
      CallBackURL: callback,
      AccountReference: opts.reference.slice(0, 12),
      TransactionDesc: opts.description.slice(0, 13),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ResponseCode?: string;
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    errorMessage?: string;
  };
  if (!res.ok || json.ResponseCode !== "0" || !json.CheckoutRequestID) {
    console.error("STK push error", res.status, json);
    throw new Error("We couldn't send the M-Pesa prompt. Check the number and try again.");
  }
  return { checkoutRequestId: json.CheckoutRequestID, merchantRequestId: json.MerchantRequestID ?? null };
}

export async function stkQuery(checkoutRequestId: string) {
  const token = await getAccessToken();
  const timestamp = nairobiTimestamp();
  const res = await fetch(`${darajaBase()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: env("MPESA_SHORTCODE"),
      Password: password(timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { ResultCode?: string; ResultDesc?: string; errorCode?: string };
  // While still processing, Daraja returns an errorCode instead of ResultCode.
  if (json.ResultCode === undefined) return null;
  return { resultCode: Number(json.ResultCode), resultDesc: json.ResultDesc ?? "" };
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Idempotently settle a pending payment request. Only the first caller to flip it from pending records the donation. */
export async function settlePayment(
  admin: Admin,
  checkoutRequestId: string,
  result: { resultCode: number; resultDesc: string; receipt?: string | null },
) {
  const success = result.resultCode === 0;
  const { data: claimed } = await admin
    .from("payment_requests")
    .update({
      status: success ? "success" : "failed",
      result_code: result.resultCode,
      result_desc: result.resultDesc,
      mpesa_receipt: result.receipt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("checkout_request_id", checkoutRequestId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (!claimed || !success) return;
  const { error } = await admin.rpc("record_donation", {
    _campaign_id: claimed.campaign_id,
    _amount: Number(claimed.amount),
    _donor_name: claimed.donor_name ?? undefined,
    _message: claimed.message ?? undefined,
    _is_anonymous: claimed.is_anonymous,
    _mpesa_transaction_id: result.receipt ?? checkoutRequestId,
  });
  if (error) console.error("record_donation failed after confirmed payment", checkoutRequestId, error.message);
}
