-- Enforce plan limits at the DB level. Owner role bypasses limits.

CREATE OR REPLACE FUNCTION public.current_plan_for(_user_id uuid)
RETURNS public.plans
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.* FROM public.plans p
  JOIN public.subscriptions s ON s.plan_key = p.key
  WHERE s.user_id = _user_id
    AND s.status IN ('active','trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY p.sort_order DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.enforce_source_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
  v_max integer;
  v_plan public.plans;
BEGIN
  IF public.has_role(NEW.user_id, 'owner') OR public.has_role(NEW.user_id, 'admin') THEN
    RETURN NEW;
  END IF;
  v_plan := public.current_plan_for(NEW.user_id);
  v_max := COALESCE(v_plan.max_sources, (SELECT max_sources FROM public.plans WHERE key = 'free'));
  SELECT count(*) INTO v_count FROM public.sources WHERE user_id = NEW.user_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Source limit reached for your plan (%). Upgrade to add more.', v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_source_quota_trg ON public.sources;
CREATE TRIGGER enforce_source_quota_trg
  BEFORE INSERT ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.enforce_source_quota();

CREATE OR REPLACE FUNCTION public.enforce_apply_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
  v_max integer;
  v_plan public.plans;
BEGIN
  IF public.has_role(NEW.user_id, 'owner') OR public.has_role(NEW.user_id, 'admin') THEN
    RETURN NEW;
  END IF;
  v_plan := public.current_plan_for(NEW.user_id);
  v_max := COALESCE(v_plan.max_applies_per_day, (SELECT max_applies_per_day FROM public.plans WHERE key = 'free'));
  SELECT count(*) INTO v_count FROM public.applications
    WHERE user_id = NEW.user_id AND queued_at::date = CURRENT_DATE;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Daily apply limit reached for your plan (%/day). Upgrade for more.', v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_apply_quota_trg ON public.applications;
CREATE TRIGGER enforce_apply_quota_trg
  BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_apply_quota();