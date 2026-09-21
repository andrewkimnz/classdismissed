-- Class mottos were removed from the product. Drop the now-unused column.
alter table classes drop column if exists motto;
