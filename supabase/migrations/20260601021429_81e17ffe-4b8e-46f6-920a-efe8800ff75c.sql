UPDATE public.jobs
SET description_html = replace(replace(replace(replace(replace(replace(
      description_html,
      '&lt;', '<'), '&gt;', '>'), '&quot;', '"'),
      '&#39;', ''''), '&nbsp;', ' '), '&amp;', '&'),
    description = regexp_replace(
      replace(replace(replace(replace(replace(replace(
        description_html,
        '&lt;', '<'), '&gt;', '>'), '&quot;', '"'),
        '&#39;', ''''), '&nbsp;', ' '), '&amp;', '&'),
      '<[^>]+>', ' ', 'g')
WHERE source_key LIKE 'greenhouse:%'
  AND description_html LIKE '&lt;%';