ALTER TABLE public.worker_commands DROP CONSTRAINT worker_commands_kind_check;
ALTER TABLE public.worker_commands ADD CONSTRAINT worker_commands_kind_check
  CHECK (kind = ANY (ARRAY[
    'scrape','apply','tailor','tailor_resume','compile_resume',
    'test_source','notify_test','deploy_self_test','rebuild_index'
  ]));