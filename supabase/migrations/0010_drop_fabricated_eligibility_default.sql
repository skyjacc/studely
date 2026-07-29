-- 0010 — remove the last place the schema invents a claim.
--
-- offers.eligibility defaulted to 'Verified students worldwide' (0001_init.sql).
-- That string is published verbatim under "Who can apply", and it asserts two
-- things we cannot back: a verification we have never run, and a worldwide reach
-- most offers do not have.
--
-- The application layer already refuses it — validateOfferInput requires
-- eligibility and has a test locking that in — but the default sits underneath
-- the application. Any insert that bypasses it (the Supabase SQL editor, a future
-- importer, a restore) silently reintroduces the claim. Integrity that only holds
-- on one code path is not integrity.
--
-- Dropping the default makes the omission fail loudly instead: eligibility is NOT
-- NULL, so an insert that forgets it now errors rather than fabricating an answer.
--
-- No backfill: every current row carries hand-written eligibility text (checked
-- before writing this).

alter table public.offers alter column eligibility drop default;
