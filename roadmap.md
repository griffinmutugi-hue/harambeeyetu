# Roadmap

- [x] Store MPESA_CONSUMER_KEY secret
- [x] Direct-to-organizer M-Pesa STK push (code complete; needs migration applied + env vars + sandbox test)
  - Env: MPESA_ENV (sandbox|production), MPESA_ENCRYPTION_KEY (base64 32 bytes), MPESA_CALLBACK_SECRET, MPESA_CALLBACK_BASE_URL
  - Apply `supabase/migrations/20261015090000_mpesa_stk_push.sql`
