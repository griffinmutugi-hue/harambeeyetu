// Server-only payment helpers shared by server functions and the Safaricom callback route.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret, type DarajaCreds } from "./mpesa.server";

export async function loadCredsForOwner(userId: string): Promise<DarajaCreds | null> {
  const { data } = await supabaseAdmin
    .from("organizer_payment_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    shortcodeType: data.shortcode_type as "till" | "paybill",
    shortcode: data.shortcode,
    tillNumber: data.till_number,
    accountRef: data.account_ref,
    passkey: await decryptSecret(data.passkey_enc),
    consumerKey: await decryptSecret(data.consumer_key_enc),
    consumerSecret: await decryptSecret(data.consumer_secret_enc),
  };
}

export type Outcome = {
  resultCode: number;
  resultDesc: string;
  receipt?: string | null;
  amount?: number | null;
};

/**
 * Applies a final result to a pending payment request. Safe to call repeatedly (callback retries,
 * polling fallback): only the call that flips pending -> final records the donation.
 */
export async function settlePayment(checkoutRequestId: string, outcome: Outcome): Promise<void> {
  const success = outcome.resultCode === 0;
  const { data: row } = await supabaseAdmin
    .from("payment_requests")
    .update({
      status: success ? "success" : "failed",
      result_code: outcome.resultCode,
      result_desc: outcome.resultDesc.slice(0, 300),
      mpesa_receipt: outcome.receipt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("checkout_request_id", checkoutRequestId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (!row) {
    // Already settled. If it was settled via the status-query fallback (no receipt) and the callback now
    // brings the real receipt, swap the placeholder reference for it.
    if (success && outcome.receipt) {
      await supabaseAdmin
        .from("donations")
        .update({ mpesa_transaction_id: outcome.receipt })
        .eq("mpesa_transaction_id", `STK-${checkoutRequestId}`);
      await supabaseAdmin
        .from("payment_requests")
        .update({ mpesa_receipt: outcome.receipt })
        .eq("checkout_request_id", checkoutRequestId)
        .is("mpesa_receipt", null);
    }
    return;
  }
  if (!success) return;

  if (outcome.amount != null && Number(outcome.amount) !== Number(row.amount)) {
    console.error("[mpesa] amount mismatch", checkoutRequestId, row.amount, outcome.amount);
  }
  const { error } = await supabaseAdmin.rpc("record_donation", {
    _campaign_id: row.campaign_id,
    _amount: Number(outcome.amount ?? row.amount),
    _donor_name: row.donor_name || undefined,
    _is_anonymous: row.is_anonymous || !row.donor_name,
    _mpesa_transaction_id: outcome.receipt ?? `STK-${checkoutRequestId}`,
  });
  if (error) {
    // Money was paid but couldn't be counted (e.g. campaign closed mid-payment). Needs manual follow-up.
    console.error("[mpesa] PAID BUT NOT RECORDED", checkoutRequestId, error.message);
  }
}
