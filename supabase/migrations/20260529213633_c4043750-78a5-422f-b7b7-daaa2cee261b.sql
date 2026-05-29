CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  INSERT INTO public.profile (user_id, email) VALUES (NEW.id, NEW.email) ON CONFLICT DO NOTHING;
  INSERT INTO public.automation_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  INSERT INTO public.sources (user_id, key, display_name, kind, enabled, cadence_minutes, config) VALUES
    (NEW.id, 'apify:linkedin_bebity', 'LinkedIn (bebity — primary)', 'apify', false, 120,
     '{"queries":["software engineer"],"locations":["United States"],"remote":true,"rows":100,"published_at":"r604800"}'::jsonb),
    (NEW.id, 'apify:linkedin', 'LinkedIn (curious_coder — fallback)', 'apify', false, 240,
     '{"queries":["software engineer"],"locations":["United States"],"remote":true,"rows":100}'::jsonb),
    (NEW.id, 'apify:indeed_misceres', 'Indeed (misceres — primary)', 'apify', false, 180,
     '{"queries":["software engineer"],"locations":[""],"country":"US","remote":true,"rows":100}'::jsonb),
    (NEW.id, 'apify:ziprecruiter', 'ZipRecruiter', 'apify', false, 180,
     '{"queries":["software engineer"],"locations":["United States"],"rows":100}'::jsonb),
    (NEW.id, 'apify:google_jobs', 'Google Jobs (aggregator)', 'apify', false, 240,
     '{"queries":["software engineer remote"],"locations":["United States"],"rows":100}'::jsonb),
    (NEW.id, 'apify:glassdoor', 'Glassdoor', 'apify', false, 360,
     '{"queries":["software engineer"],"locations":["United States"],"rows":50}'::jsonb),
    (NEW.id, 'apify:wellfound', 'Wellfound (AngelList)', 'apify', false, 360,
     '{"queries":["software engineer"],"locations":[],"remote":true,"rows":50}'::jsonb),
    (NEW.id, 'remoteok', 'RemoteOK (free)', 'rss', false, 60, '{"tags":["dev"]}'::jsonb),
    (NEW.id, 'weworkremotely', 'We Work Remotely (free)', 'rss', false, 60, '{}'::jsonb),
    (NEW.id, 'arbeitnow', 'Arbeitnow (free)', 'rss', false, 60, '{}'::jsonb),
    (NEW.id, 'remotive', 'Remotive (free)', 'rss', false, 60, '{"category":"software-dev","limit":100}'::jsonb),
    (NEW.id, 'workatastartup', 'Work at a Startup (YC)', 'rss', false, 240,
     '{"queries":["engineer"],"remote":true,"rows":100}'::jsonb),
    (NEW.id, 'greenhouse_boards', 'Greenhouse direct boards', 'rss', false, 360,
     '{"boards":["airbnb","stripe","figma","notion","vercel"]}'::jsonb),
    (NEW.id, 'lever_boards', 'Lever direct boards', 'rss', false, 360,
     '{"boards":["netflix","ramp","attentive"]}'::jsonb)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;