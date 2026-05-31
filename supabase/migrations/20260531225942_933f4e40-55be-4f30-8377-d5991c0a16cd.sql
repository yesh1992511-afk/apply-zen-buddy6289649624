DROP TRIGGER IF EXISTS jobs_auto_queue_matched_job ON public.jobs;

CREATE TRIGGER jobs_auto_queue_matched_job
AFTER INSERT OR UPDATE OF matched, status, url ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.auto_queue_matched_job();