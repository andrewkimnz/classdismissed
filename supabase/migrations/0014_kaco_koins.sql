-- ============================================================================
--  Kaco Koins: a Phase 2 (After School) currency. Every member starts Phase 2
--  with 15, earns +5 per club their class completes (once per completion),
--  and spends them at the storefront.
--
--  Balances are never stored as a running total — always summed on read from
--  koin_transactions, an append-only ledger — so there's nothing to drift out
--  of sync, and a revoked transaction (a club completion undone by staff) just
--  stops counting instead of needing a separate "undo" write.
-- ============================================================================

create table koin_products (
  id             int generated always as identity primary key,
  name           text not null,
  price          int not null check (price > 0),
  stock          int not null check (stock >= 0),
  -- the stock a "Start the event fresh" reset restores — see src/lib/reset.ts
  initial_stock  int not null check (initial_stock >= 0),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table koin_transactions (
  id             int generated always as identity primary key,
  student_id     int not null references students (id) on delete cascade,
  delta          int not null check (delta <> 0),
  description    text not null,
  kind           text not null check (kind in ('starting_balance', 'club_completion', 'purchase')),
  completion_id  int references club_completions (id) on delete set null,
  product_id     int references koin_products (id) on delete set null,
  created_by     int references admins (id) on delete set null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz
);
create index koin_transactions_student_idx on koin_transactions (student_id, id);

-- "Only once": at most one ACTIVE starting-balance row per student, and at most one ACTIVE
-- club-completion row per (student, completion) — tied to the completion itself, not just the
-- club, so revoking a completion and re-awarding the same club later (a fresh completion row)
-- can earn the Koins again, exactly like club_completions' own uniqueness already works.
create unique index koin_tx_start_once_idx on koin_transactions (student_id) where kind = 'starting_balance' and revoked_at is null;
create unique index koin_tx_completion_once_idx on koin_transactions (student_id, completion_id) where kind = 'club_completion' and revoked_at is null;

create trigger koin_products_touch before update on koin_products
  for each row execute function touch_updated_at();
create trigger koin_products_live after insert or update or delete on koin_products
  for each statement execute function bump_live();
create trigger koin_transactions_live after insert or update or delete on koin_transactions
  for each statement execute function bump_live();

alter table koin_products enable row level security;
alter table koin_transactions enable row level security;

insert into koin_products (name, price, stock, initial_stock, sort_order) values
  ('Choco Pie', 10, 60, 60, 0),
  ('Cheese Breadstick', 15, 20, 20, 1),
  ('Koala''s March Cookies', 15, 20, 20, 2),
  ('Shapes', 20, 15, 15, 3),
  ('Vita Lemon Tea', 20, 24, 24, 4),
  ('Sour Strawberry/Grape Candy', 25, 6, 6, 5);
