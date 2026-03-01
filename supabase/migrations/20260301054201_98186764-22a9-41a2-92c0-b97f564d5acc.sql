
-- Create feeds table
CREATE TABLE public.feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'podcast' CHECK (type IN ('podcast', 'newsletter', 'youtube')),
  url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feeds" ON public.feeds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own feeds" ON public.feeds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own feeds" ON public.feeds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own feeds" ON public.feeds FOR DELETE USING (auth.uid() = user_id);

-- Create digests table
CREATE TABLE public.digests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feed_id UUID REFERENCES public.feeds(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  guest TEXT,
  guest_bio TEXT,
  author TEXT,
  url TEXT NOT NULL,
  date TEXT NOT NULL,
  quote TEXT,
  type TEXT NOT NULL DEFAULT 'podcast' CHECK (type IN ('podcast', 'newsletter')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own digests" ON public.digests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own digests" ON public.digests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own digests" ON public.digests FOR DELETE USING (auth.uid() = user_id);

-- Create digest_points table
CREATE TABLE public.digest_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  digest_id UUID NOT NULL REFERENCES public.digests(id) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  detail TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.digest_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own digest points" ON public.digest_points FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.digests WHERE digests.id = digest_points.digest_id AND digests.user_id = auth.uid()));
CREATE POLICY "Users can create their own digest points" ON public.digest_points FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.digests WHERE digests.id = digest_points.digest_id AND digests.user_id = auth.uid()));
CREATE POLICY "Users can delete their own digest points" ON public.digest_points FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.digests WHERE digests.id = digest_points.digest_id AND digests.user_id = auth.uid()));
