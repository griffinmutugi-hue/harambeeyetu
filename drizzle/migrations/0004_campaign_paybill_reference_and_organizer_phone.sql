ALTER TABLE public.campaigns
  ADD COLUMN paybill_reference TEXT,
  ADD COLUMN organizer_mpesa TEXT;

WITH refs AS (
  SELECT
    id,
    'HY-' || upper(substr(replace(id::text, '-', ''), 1, 8)) AS base_ref,
    count(*) OVER (PARTITION BY upper(substr(replace(id::text, '-', ''), 1, 8))) AS prefix_count
  FROM public.campaigns
)
UPDATE public.campaigns AS c
SET paybill_reference = refs.base_ref || CASE
  WHEN refs.prefix_count > 1 THEN '-' || right(replace(refs.id::text, '-', ''), 4)
  ELSE ''
END
FROM refs
WHERE c.id = refs.id;

ALTER TABLE public.campaigns
  ALTER COLUMN paybill_reference SET NOT NULL;

CREATE UNIQUE INDEX campaigns_paybill_reference_key
  ON public.campaigns (paybill_reference);

CREATE OR REPLACE FUNCTION public.generate_campaign_paybill_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  clean_id TEXT;
  base_ref TEXT;
  candidate TEXT;
  suffix_length INTEGER := 4;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.paybill_reference IS DISTINCT FROM OLD.paybill_reference THEN
      RAISE EXCEPTION 'Campaign Paybill reference cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  clean_id := replace(NEW.id::text, '-', '');
  base_ref := 'HY-' || upper(substr(clean_id, 1, 8));
  candidate := base_ref;

  WHILE EXISTS (
    SELECT 1 FROM public.campaigns WHERE paybill_reference = candidate
  ) LOOP
    candidate := base_ref || '-' || upper(substr(clean_id, 9, suffix_length));
    IF suffix_length >= 24 THEN
      RAISE EXCEPTION 'Could not generate a unique campaign Paybill reference';
    END IF;
    suffix_length := least(suffix_length + 4, 24);
  END LOOP;

  NEW.paybill_reference := candidate;
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_generate_paybill_reference
BEFORE INSERT OR UPDATE OF paybill_reference ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.generate_campaign_paybill_reference();

COMMENT ON COLUMN public.campaigns.paybill_reference IS 'Permanent, database-generated donor payment reference. Prefix collisions use a UUID suffix.';
COMMENT ON COLUMN public.campaigns.organizer_mpesa IS 'Private organizer M-Pesa number for future disbursement; never exposed to public campaign readers.';

REVOKE SELECT ON TABLE public.campaigns FROM anon, authenticated;
GRANT SELECT (
  id,
  creator_id,
  organizer_name,
  title,
  story,
  goal_amount,
  current_amount,
  category,
  cover_photo,
  status,
  deadline,
  created_at,
  organizer_photo,
  completed_at,
  paybill_reference
) ON TABLE public.campaigns TO anon, authenticated;
