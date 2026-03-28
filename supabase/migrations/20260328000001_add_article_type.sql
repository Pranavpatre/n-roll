-- Add 'article' to feeds type constraint
ALTER TABLE public.feeds DROP CONSTRAINT feeds_type_check;
ALTER TABLE public.feeds ADD CONSTRAINT feeds_type_check CHECK (type = ANY (ARRAY['podcast'::text, 'newsletter'::text, 'youtube'::text, 'news'::text, 'article'::text]));

-- Add 'article' to digests type constraint
ALTER TABLE public.digests DROP CONSTRAINT digests_type_check;
ALTER TABLE public.digests ADD CONSTRAINT digests_type_check CHECK (type IN ('podcast', 'newsletter', 'news', 'youtube', 'x', 'article'));
