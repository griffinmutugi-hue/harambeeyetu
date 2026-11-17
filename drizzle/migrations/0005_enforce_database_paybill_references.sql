ALTER TABLE public.campaigns
  ALTER COLUMN paybill_reference SET DEFAULT '';

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