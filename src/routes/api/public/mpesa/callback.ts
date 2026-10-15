import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      CheckoutRequestID: z.string().max(100),
      ResultCode: z.coerce.number(),
      ResultDesc: z.string().max(500).optional().default(""),
      CallbackMetadata: z
        .object({ Item: z.array(z.object({ Name: z.string(), Value: z.unknown().optional() })) })
        .optional(),
    }),
  }),
});

const ack = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });

export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        const secret = process.env["MPESA_CALLBACK_SECRET"];
        if (!secret || token !== secret) return new Response("Forbidden", { status: 403 });

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return ack();
        const cb = parsed.data.Body.stkCallback;
        const receipt = cb.CallbackMetadata?.Item.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { settlePayment } = await import("@/lib/mpesa.server");
        // Only known pending requests are settled; unknown IDs are ignored.
        await settlePayment(supabaseAdmin, cb.CheckoutRequestID, {
          resultCode: cb.ResultCode,
          resultDesc: cb.ResultDesc,
          receipt: typeof receipt === "string" ? receipt : null,
        });
        return ack();
      },
    },
  },
});
