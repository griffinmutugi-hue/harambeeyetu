CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  donor_name TEXT,
  message TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  result_code INTEGER,
  result_desc TEXT,
  mpesa_receipt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX payment_requests_status_idx ON public.payment_requests(status);