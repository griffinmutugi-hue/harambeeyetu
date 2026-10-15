import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentSettingsView = {
  configured: boolean;
  shortcodeType: "till" | "paybill";
  shortcode: string;
  tillNumber: string;
  accountRef: string;
  displayName: string;
};

export const getPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentSettingsView> => {
    // Secrets are never returned; the browser only learns whether setup exists.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("organizer_payment_settings")
      .select("shortcode_type, shortcode, till_number, account_ref, display_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      configured: !!data,
      shortcodeType: (data?.shortcode_type as "till" | "paybill") ?? "till",
      shortcode: data?.shortcode ?? "",
      tillNumber: data?.till_number ?? "",
      accountRef: data?.account_ref ?? "",
      displayName: data?.display_name ?? "",
    };
  });

const digits = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${min},${max}}$`));

export const savePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shortcodeType: z.enum(["till", "paybill"]),
        shortcode: digits(5, 7),
        tillNumber: z.string().trim().optional().default(""),
        accountRef: z.string().trim().max(20).optional().default(""),
        displayName: z.string().trim().min(2).max(60),
        // Blank secret fields on an existing setup mean "keep what is stored"
        passkey: z.string().trim().max(200).optional().default(""),
        consumerKey: z.string().trim().max(200).optional().default(""),
        consumerSecret: z.string().trim().max(200).optional().default(""),
      })
      .refine(
        (v) => v.shortcodeType !== "till" || v.tillNumber === "" || /^\d{5,7}$/.test(v.tillNumber),
        {
          message: "Till number must be 5–7 digits.",
        },
      )
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("@/lib/mpesa.server");
    const { data: existing } = await supabaseAdmin
      .from("organizer_payment_settings")
      .select("passkey_enc, consumer_key_enc, consumer_secret_enc")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!existing && !(data.passkey && data.consumerKey && data.consumerSecret)) {
      throw new Error("Enter your Daraja passkey, consumer key and consumer secret.");
    }
    const { error } = await supabaseAdmin.from("organizer_payment_settings").upsert({
      user_id: context.userId,
      shortcode_type: data.shortcodeType,
      shortcode: data.shortcode,
      till_number: data.shortcodeType === "till" && data.tillNumber ? data.tillNumber : null,
      account_ref: data.shortcodeType === "paybill" && data.accountRef ? data.accountRef : null,
      display_name: data.displayName,
      passkey_enc: data.passkey ? await encryptSecret(data.passkey) : existing!.passkey_enc,
      consumer_key_enc: data.consumerKey
        ? await encryptSecret(data.consumerKey)
        : existing!.consumer_key_enc,
      consumer_secret_enc: data.consumerSecret
        ? await encryptSecret(data.consumerSecret)
        : existing!.consumer_secret_enc,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't save your payment setup.");
    // Public label + "donations open" signal for all of this organizer's campaigns
    await supabaseAdmin
      .from("campaigns")
      .update({ payout_display_name: data.displayName })
      .eq("creator_id", context.userId);
    return { ok: true };
  });

export const startDonation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        amount: z.number().int().min(1).max(250_000),
        phone: z.string().trim().min(9).max(20),
        donorName: z.string().trim().max(60).optional().default(""),
        isAnonymous: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ requestId: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone, stkPush } = await import("@/lib/mpesa.server");
    const { loadCredsForOwner } = await import("@/lib/payments.server");
    const { campaignLifecycle } = await import("@/lib/campaigns");

    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number, e.g. 0712 345 678.");

    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("id, creator_id, status, deadline")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (!campaign || !campaign.creator_id) throw new Error("Campaign not found.");
    if (!campaignLifecycle(campaign.deadline, campaign.status).isAcceptingDonations) {
      throw new Error("This campaign is no longer accepting donations.");
    }

    // Basic abuse guard: don't let one number spam prompts
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("payment_requests")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", since);
    if ((count ?? 0) >= 3)
      throw new Error("Too many attempts. Please wait a few minutes and try again.");

    const creds = await loadCredsForOwner(campaign.creator_id);
    if (!creds) throw new Error("The organizer hasn't finished setting up payments yet.");

    const base = process.env["MPESA_CALLBACK_BASE_URL"];
    const secret = process.env["MPESA_CALLBACK_SECRET"];
    if (!base || !secret) throw new Error("Payments are not configured yet.");
    const callbackUrl = `${base.replace(/\/$/, "")}/api/public/mpesa/callback?token=${encodeURIComponent(secret)}`;

    const { data: req, error } = await supabaseAdmin
      .from("payment_requests")
      .insert({
        campaign_id: campaign.id,
        phone,
        amount: data.amount,
        donor_name: data.isAnonymous ? null : data.donorName || null,
        is_anonymous: data.isAnonymous || !data.donorName,
      })
      .select("id")
      .single();
    if (error) throw new Error("Couldn't start the payment. Please try again.");

    try {
      const res = await stkPush(creds, {
        phone,
        amount: data.amount,
        callbackUrl,
        reference: "Harambee",
      });
      await supabaseAdmin
        .from("payment_requests")
        .update({
          checkout_request_id: res.checkoutRequestId,
          merchant_request_id: res.merchantRequestId,
        })
        .eq("id", req.id);
    } catch (e) {
      await supabaseAdmin
        .from("payment_requests")
        .update({
          status: "failed",
          result_desc: e instanceof Error ? e.message.slice(0, 300) : "push failed",
        })
        .eq("id", req.id);
      throw e;
    }
    return { requestId: req.id };
  });

export type DonationStatus = {
  status: "pending" | "success" | "failed";
  message: string;
  receipt: string | null;
};

const PENDING_FALLBACK_AFTER_MS = 20_000;
const GIVE_UP_AFTER_MS = 3 * 60_000;

export const getDonationStatus = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<DonationStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { settlePayment, loadCredsForOwner } = await import("@/lib/payments.server");
    const { stkQuery } = await import("@/lib/mpesa.server");

    const read = async () =>
      (
        await supabaseAdmin
          .from("payment_requests")
          .select("*")
          .eq("id", data.requestId)
          .maybeSingle()
      ).data;
    let row = await read();
    if (!row) throw new Error("Payment not found.");

    // Callback never arrived? Ask Safaricom directly once the prompt is a little old.
    const age = Date.now() - new Date(row.created_at).getTime();
    if (row.status === "pending" && row.checkout_request_id && age > PENDING_FALLBACK_AFTER_MS) {
      const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .select("creator_id")
        .eq("id", row.campaign_id)
        .maybeSingle();
      const creds = campaign?.creator_id ? await loadCredsForOwner(campaign.creator_id) : null;
      if (creds) {
        const q = await stkQuery(creds, row.checkout_request_id).catch(() => null);
        if (q) await settlePayment(row.checkout_request_id, q);
        else if (age > GIVE_UP_AFTER_MS) {
          await settlePayment(row.checkout_request_id, {
            resultCode: 1037,
            resultDesc: "Timed out waiting for the PIN",
          });
        }
        row = (await read()) ?? row;
      }
    }

    if (row.status === "success") {
      return { status: "success", message: "Payment received", receipt: row.mpesa_receipt };
    }
    if (row.status === "failed") {
      const code = row.result_code;
      const message =
        code === 1032
          ? "You cancelled the payment."
          : code === 1
            ? "Insufficient M-Pesa balance."
            : code === 1037
              ? "The prompt timed out. Please try again."
              : code === 2001
                ? "Wrong M-Pesa PIN entered."
                : row.result_desc || "The payment didn't go through.";
      return { status: "failed", message, receipt: null };
    }
    return {
      status: "pending",
      message: "Check your phone and enter your M-Pesa PIN",
      receipt: null,
    };
  });
