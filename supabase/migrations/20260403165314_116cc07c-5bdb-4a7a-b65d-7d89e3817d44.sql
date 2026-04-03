
ALTER TABLE public.exclusive_posts
ADD COLUMN ingredients text[] DEFAULT '{}',
ADD COLUMN instructions text,
ADD COLUMN characteristics text[] DEFAULT '{}';
