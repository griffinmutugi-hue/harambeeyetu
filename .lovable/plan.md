# Harambee Yetu — real database, accounts, and live campaigns

Right now every campaign lives only in the visitor's own browser, so nothing is shared between people. This plan moves campaigns, donations, and updates into a real cloud database, adds accounts, and rewires the four screens to read and write real data.

## What changes for people using the app

- **Anyone can browse and donate.** No account needed to give.
- **Starting a harambee needs an account.** Sign up with email and password, or with Google, in one step from the "Start a Harambee" button.
- **Campaigns are public.** Once created, a campaign appears in everyone's feed and its link works for anyone.
- **Donating is real.** Pressing the M-Pesa button records the gift, adds the donor's name (or "Anonymous") to the supporter list, and moves the progress bar for everyone. No money moves yet — the payment step stays a placeholder.
- **The four demo causes stay.** They are copied into the database as real starter campaigns so the feed still feels alive.
- **Campaign updates.** Organisers can post short progress notes on their own campaign; everyone sees them on the campaign page.

## Screens touched

1. **Home feed** — lists active campaigns from the database, newest first, with the same category filters and running total.
2. **Campaign page** — loads the campaign, its supporters, and its updates from the database. Donate sheet writes a real donation.
3. **Create page** — requires sign-in; photo is uploaded to cloud storage; the campaign is saved and you land on the share screen.
4. **Sign-in page (new)** — email/password plus Google, and a way to sign out from the header.

## Technical notes

**Backend:** enable Lovable Cloud (Postgres + auth + storage).

**Tables** (public schema, RLS on, explicit grants):

- `profiles` — replaces the requested standalone `users` table. Accounts live in the managed auth store; `profiles` holds `id` (FK to the auth user, cascade delete), `name`, `email`, `phone`, `profile_photo`, `created_at`. Auto-created on signup by a trigger. Storing names/emails in a separate hand-rolled `users` table would fork identity from auth and break the FKs.
- `campaigns` — `id`, `creator_id` → `profiles.id`, `title`, `story`, `goal_amount numeric`, `current_amount numeric default 0`, `category text` (check: medical/education/community/other), `cover_photo`, `status text default 'active'` (check: active/completed/cancelled), `deadline date`, `created_at`.
- `donations` — `id`, `campaign_id` → `campaigns.id` (cascade), `donor_id` → `profiles.id` nullable, `amount`, `message`, `is_anonymous boolean default false`, `mpesa_transaction_id`, `created_at`.
- `campaign_updates` — `id`, `campaign_id` → `campaigns.id` (cascade), `creator_id` → `profiles.id`, `content`, `created_at`.

**Policies:**
- `campaigns`: public SELECT for `status = 'active'`; owner SELECT of own rows in any status; INSERT/UPDATE/DELETE limited to `auth.uid() = creator_id`.
- `donations`: public SELECT (display name resolved server-side; anonymous rows expose no donor); INSERT allowed to anon and authenticated with validation.
- `campaign_updates`: public SELECT; write limited to the campaign's creator.
- `profiles`: SELECT own row; public reads go through the campaign fetchers, not direct profile reads.

**current_amount integrity:** a `SECURITY DEFINER` Postgres function `record_donation(...)` inserts the donation and increments `campaigns.current_amount` in one transaction, called from a server function. Anonymous callers set `donor_id = null`, `is_anonymous = true`, and a dummy `mpesa_transaction_id` (`DEMO-<random>`). No Daraja integration.

**Data access:** `createServerFn` modules under `src/lib/`:
- `campaigns.functions.ts` — `listActiveCampaigns`, `getCampaignWithDonations` (public, publishable-key server client), `createCampaign`, `listMyCampaigns`, `postUpdate` (via `requireSupabaseAuth`).
- `donations.functions.ts` — `submitDonation` (public; calls `record_donation`).

Public routes (`/`, `/campaign/$id`) keep SSR and call only the public fetchers, so shared links and OG tags keep working. `/create` moves under `src/routes/_authenticated/` with the managed gate; a new public `/auth` route handles email/password + Google (via the Lovable OAuth helper, with the provider enabled at the same time).

**Photos:** public storage bucket `campaign-photos`; the create form uploads the file and stores its public URL instead of the current base64 data URL. Campaign pages then get a real absolute image URL for `og:image`.

**Seeding:** the migration includes literal INSERTs for the four existing campaigns and their donor rows, owned by a system profile, with the bundled demo images uploaded to the bucket first so `cover_photo` holds real URLs.

**Removed:** the localStorage store in `src/lib/campaigns.ts` (types and `formatKES`/`categoryLabel` helpers stay, backed by generated database types).
