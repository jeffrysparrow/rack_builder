UPDATE shops
SET settings = json_set(settings, '$.name', 'Totes & Timber'),
    revision = revision + 1
WHERE id = 'toteworks-atx'
  AND json_extract(settings, '$.name') = 'ToteWorks ATX';
