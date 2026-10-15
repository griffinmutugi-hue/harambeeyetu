-- Direct-to-organizer M-Pesa STK push.
-- Organizer Daraja credentials and payment requests are server-only (service_role); no anon/authenticated access.

CREATE TABLE public.organizer_payment_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  shortcode_type TEXT NOT NULL CHECK (shortcode_type IN ('till', 'paybill')),
  shortcode TEXT NOT NULL,          -- Daraja BusinessShortCode (store number for a Till, paybill number for a Paybill)
  till_number TEXT,                 -- Till only: PartyB (defaults to shortcode when null)
  account_ref TEXT,                 -- Paybill account number shown on the donor's phone
  display_name TEXT NOT NULL,       -- shown to donors: "Payments go to: ..."
  passkey_enc TEXT NOT NULL,        -- AES-GCM encrypted (see src/lib/mpesa.server.ts)
  consumer_key_enc TEXT NOT NULL,
  consumer_secret_enc TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizer_payment_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizer_payment_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.organizer_payment_settings TO service_role;

-- Public, non-secret flag/label on campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS payout_display_name TEXT;

CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  donor_name TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  result_code INTEGER,
  result_desc TEXT,
  mpesa_receipt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_requests_campaign_idx ON public.payment_requests (campaign_id, created_at DESC);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_requests TO service_role;

-- A real M-Pesa receipt can only ever be counted once
CREATE UNIQUE INDEX IF NOT EXISTS donations_mpesa_tx_unique
  ON public.donations (mpesa_transaction_id) WHERE mpesa_transaction_id IS NOT NULL;
