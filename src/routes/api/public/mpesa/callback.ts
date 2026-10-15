import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const callbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      CheckoutRequestID: z.string(),
      ResultCode: z.coerce.number(),
      ResultDesc: z.string().optional().default(""),
      CallbackMetadata: z
        .object({
          Item: z.array(
            z.object({ Name: z.string(), Value: z.union([z.string(), z.number()]).optional() }),
          ),
        })
        .optional(),
    }),
  }),
});

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Safaricom doesn't sign callbacks: require our secret token in the URL, and only ever act on
        // CheckoutRequestIDs that match a pending request we created.
        const secret = process.env["MPESA_CALLBACK_SECRET"];
        const token = new URL(request.url).searchParams.get("token");
        if (!secret || !token || token !== secret)
          return new Response("Unauthorized", { status: 401 });

        const parsed = callbackSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json(ACK);

        const cb = parsed.data.Body.stkCallback;
        const meta = new Map((cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]));
        const receipt = meta.get("MpesaReceiptNumber");
        const amount = meta.get("Amount");

        const { settlePayment } = await import("@/lib/payments.server");
        await settlePayment(cb.CheckoutRequestID, {
          resultCode: cb.ResultCode,
          resultDesc: cb.ResultDesc,
          receipt: receipt != null ? String(receipt) : null,
          amount: amount != null ? Number(amount) : null,
        });
        return Response.json(ACK);
      },
    },
  },
});
