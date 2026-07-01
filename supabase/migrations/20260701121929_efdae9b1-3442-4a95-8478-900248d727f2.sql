
UPDATE public.ebooks
SET file_url = regexp_replace(file_url, '^https?://[^/]+/storage/v1/object/(?:public|sign)/ebook-files/', '')
WHERE file_url ~ '^https?://[^/]+/storage/v1/object/(?:public|sign)/ebook-files/';

UPDATE public.ebooks
SET file_url = split_part(file_url, '?', 1)
WHERE file_url LIKE '%?%';

UPDATE public.recipe_materials
SET file_url = regexp_replace(file_url, '^https?://[^/]+/storage/v1/object/(?:public|sign)/lesson-materials/', '')
WHERE file_url ~ '^https?://[^/]+/storage/v1/object/(?:public|sign)/lesson-materials/';

UPDATE public.recipe_materials
SET file_url = split_part(file_url, '?', 1)
WHERE file_url LIKE '%?%';
