# Operations hardening — handoff

**Снимок:** 24 июля 2026, около 03:40 EEST  
**Рабочая папка:** `/Users/obllako/Documents/studely/claimly`  
**Ветка:** `main`  
**HEAD:** `ead5150`  
**Важно:** изменения ещё не закоммичены, не отправлены в GitHub и не развернуты в production.

## Где остановился

Остановился перед финальным циклом:

1. повторно прогнать проверки после последних двух исправлений;
2. закоммитить весь operations-hardening batch;
3. отправить `main` в GitHub;
4. дождаться Vercel production deployment;
5. проверить live redirect, admin deploy hook и GitHub Actions.

Рабочее дерево намеренно грязное. Не делать `git reset`, не откатывать локальные
файлы и не применять миграции `0007`/`0008` повторно вручную: обе уже применены
к production Supabase.

## Что сделано локально

### Admin и deploy hook

- Сохранение полей offer и scoring attributes переведено на один транзакционный
  RPC `update_offer_with_attributes`.
- Admin Actions возвращают честный deploy result:
  - `triggered`;
  - `skipped`;
  - `failed`.
- Ошибка deploy hook не откатывает уже успешное сохранение в БД.
- UI показывает отдельные сообщения для успешного, пропущенного и неудачного
  rebuild.
- Deploy запускается только когда offer входит в `published` или выходит из
  `published`.
- Переход `draft ↔ archived` не должен запускать rebuild.
- Dashboard-ссылки `?visibility=draft` и `?stale=1` теперь реально фильтруют
  `/admin/offers`.
- Удалены ссылки на ещё не реализованные `/admin/submissions` и
  `/admin/comments`; счётчики остались как неинтерактивные tiles.

### Verification/link checker

- `scripts/check-links.mjs` читает только опубликованные offers из Supabase.
- Классификация:
  - HTTP `< 400` → `pass`;
  - `401/403/405/406/429` → `warn`, bot-blocked;
  - остальные HTTP/network/timeout → `fail`;
  - прошедшая дата expiry имеет приоритет и даёт `expired`.
- Добавлен bounded retry для timeout/network/5xx.
- Неиспользуемые HTTP response bodies отменяются, чтобы Node-процесс не зависал
  на keep-alive sockets.
- Report-only запуск без service-role key завершился сам:
  - 14 offers;
  - 12 healthy;
  - Canva и Perplexity вернули `403` и классифицированы как warnings;
  - 0 dead/expired.
- При наличии service-role key весь batch записывается одним RPC
  `record_link_check_batch`.

### Database

Созданы локальные миграции:

- `supabase/migrations/0007_operations_hardening.sql`
- `supabase/migrations/0008_fix_link_check_rpc_role_guard.sql`

Обе применены в production через Supabase MCP:

- `operations_hardening` — `20260724000605`;
- `fix_link_check_rpc_role_guard` — `20260724001308`.

`0008` исправляет ошибку ранней версии `0007`: внутри `SECURITY DEFINER`
`current_user` равен владельцу функции, поэтому проверка на `service_role`
блокировала и законный вызов.

Проверено:

- `link_checks` получил `result check_result NOT NULL` и `final_url`;
- anon не может вызвать оба новых RPC: PostgreSQL `42501`;
- `record_link_check_batch`:
  - `SECURITY DEFINER`;
  - `anon_execute = false`;
  - `authenticated_execute = false`;
  - `service_role_execute = true`;
- `update_offer_with_attributes`:
  - `SECURITY INVOKER`;
  - `anon_execute = false`;
  - `authenticated_execute = true`;
- пустой вызов batch RPC под `service_role` вернул `written = 0`;
- rollback-smoke для atomic offer update сохранил score `9` и 3 attributes.

Один rollback-smoke для link-check с реальной строкой вернул `written = 1`, но
проверка insert/update была сделана в одном CTE и получила неоднозначный порядок
вычисления. Перед заявлением полноценного DB end-to-end надо повторить тест
последовательными SQL statements внутри `BEGIN … ROLLBACK`.

### Vercel

- Vercel MCP и CLI подключены к:
  - team `team_huvJeqNfV1EGZw8A2ljh62O9`;
  - project `claimly`;
  - project ID `prj_aYvkJheGMeGGxjfAZN5uqCv4e5r1`.
- Создан deploy hook:
  - name `studely-admin-rebuild`;
  - branch `main`.
- Hook URL сохранён как sensitive production env:
  - `VERCEL_DEPLOY_HOOK_URL`.
- Hook URL также сохранён в локальный gitignored `.env`; файл имеет mode `0600`.
- Production env содержит:
  - `PUBLIC_SITE_URL`;
  - `PUBLIC_SUPABASE_URL`;
  - `PUBLIC_SUPABASE_ANON_KEY`;
  - `VERCEL_DEPLOY_HOOK_URL`.
- `vercel.json` содержит host-conditioned permanent redirect:
  - `claimly-seven.vercel.app/:path*`;
  - → `https://studely.app/:path*`.
- `vercel build --prod` успешно преобразовал его в первый Build Output route с
  HTTP `308`.

Production ещё работает со старым commit `ead5150`, поэтому сейчас
`https://claimly-seven.vercel.app/offers?view=table` всё ещё возвращает `200`.
После commit/push/deploy должен возвращать `308` с сохранёнными path/query.

### CI/runtime/dependencies

- Добавлены `.nvmrc` и `.node-version`: Node `24`.
- `package.json`:
  - identity исправлена на `studely`;
  - `engines.node = 24.x`;
  - `sharp = ^0.35.3`;
  - override `path-to-regexp = 6.3.0`;
  - backup/restore/export scripts.
- GitHub Actions переведены на:
  - `actions/checkout@v7`;
  - `actions/setup-node@v7`;
  - `actions/upload-artifact@v7`;
  - Node 24;
  - `npm ci`;
  - unit tests перед build.
- Production dependency audit: `0 vulnerabilities`.
- `npm ci --dry-run` проходит под Node 24.

### Recovery/docs

- Добавлены:
  - `scripts/ops/backup-db.sh`;
  - `scripts/ops/restore-db.sh`;
  - `scripts/ops/export-seed.mjs`;
  - `docs/runbooks/database-recovery.md`;
  - `docs/runbooks/affiliate-programs.md`.
- `backups/` добавлен в `.gitignore`.
- Seed export проверен:
  - 10 categories;
  - 14 offers;
  - файл mode `0600`.
- Missing-env backup/restore paths fail closed.
- Обновлены `README.md`, `docs/FOUNDATION.md` и vault current-state overlays.

## Последние проверки

До последних правок:

- Node 24 Vitest: `58 passed`;
- Astro check: `0 errors`, только 36 существующих hints;
- `npm ci --dry-run`: success;
- production-like Astro build: success, 14 offer pages;
- `npm audit --omit=dev`: 0 vulnerabilities;
- Vercel CLI production build: success;
- merged `.vercel/output/config.json` содержит legacy-host `308`.

После этого добавлена ещё одна regression-проверка:

- ошибка `response.body.cancel()` не должна превращать успешный HTTP result в
  dead link.

RED был подтверждён. Реализация добавлена через `try/catch`, но финальный GREEN и
полный suite после этой самой последней правки ещё не запускались из-за
прерывания. Ожидаемый итоговый test count: **59**.

## Что осталось

### 1. Финальная локальная проверка

```bash
cd /Users/obllako/Documents/studely/claimly

npx --yes node@24 ./node_modules/vitest/vitest.mjs run
npx --yes node@24 ./node_modules/astro/bin/astro.mjs check

set -a
source .env
set +a
PUBLIC_SITE_URL=https://studely.app \
VERCEL_ENV=production \
npx --yes node@24 ./node_modules/astro/bin/astro.mjs build

npm audit --omit=dev --audit-level=moderate
git diff --check
```

Ожидание:

- 59 tests pass;
- Astro: 0 errors;
- build success;
- audit: 0 vulnerabilities;
- `git diff --check`: пусто.

### 2. Повторить link-check RPC rollback-smoke

Использовать отдельные statements, не один CTE:

1. `BEGIN`;
2. `SET LOCAL ROLE service_role`;
3. сохранить исходные `last_checked/status`;
4. вызвать `record_link_check_batch` для одного offer;
5. отдельным `SELECT` подтвердить:
   - 1 новая `link_checks` row;
   - `last_checked` обновился;
   - status соответствует payload;
6. `ROLLBACK`;
7. подтвердить исходное состояние.

### 3. GitHub service-role secret

Сейчас в GitHub есть только:

- `PUBLIC_SUPABASE_URL`;
- `PUBLIC_SUPABASE_ANON_KEY`.

Отсутствует:

- `SUPABASE_SERVICE_ROLE_KEY`.

Supabase MCP OAuth не передаёт management token в Supabase CLI. CLI login требует
ручного browser verification code. Нужно:

```bash
npx --yes supabase@latest login --no-browser --agent no --output-format text
npx --yes supabase@latest projects api-keys \
  --project-ref myehxcjcdjxjysoeiynq \
  --reveal \
  --output json
```

Затем передать service-role/secret key прямо в:

```bash
gh secret set SUPABASE_SERVICE_ROLE_KEY
```

Не печатать ключ в терминальный лог и не сохранять в tracked-файлах.

### 4. Commit и push

Весь dirty worktree относится к одному operations-hardening batch.

Рекомендуемый commit:

```text
feat(ops): harden production operations

- make offer updates and verification batches transactional
- report deploy-hook outcomes honestly
- redirect legacy production host
- add recovery tooling and Node 24 CI

Migrations 0007 and 0008 are already applied in production.
```

После финальных проверок:

```bash
git add \
  .env.example .github .gitignore .node-version .nvmrc \
  README.md docs package.json package-lock.json scripts src \
  supabase/migrations/0007_operations_hardening.sql \
  supabase/migrations/0008_fix_link_check_rpc_role_guard.sql \
  vercel.json

git commit
git push origin main
```

### 5. Проверить CI и production deployment

После push:

```bash
gh run list --limit 10
gh run watch <run-id>
```

Проверить Vercel deployment:

- state `READY`;
- commit SHA равен новому commit;
- Node runtime 24;
- canonical `https://studely.app`.

### 6. Live duplicate-host verification

```bash
curl -I --max-redirs 0 \
  'https://claimly-seven.vercel.app/offers?view=table'
```

Ожидание:

- HTTP `308`;
- `Location: https://studely.app/offers?view=table`.

Проверить также `/`, `/admin`, `/offers/<slug>`.

### 7. Deploy-hook end-to-end

После нового production deployment:

1. войти в `/admin`;
2. сохранить опубликованный offer без изменения данных;
3. UI должен показать `Rebuild triggered`;
4. Vercel должен создать новый production deployment;
5. draft save не должен создавать deployment;
6. `draft → archived` не должен создавать deployment;
7. `draft/archived → published` и `published → draft/archived` должны создавать.

### 8. Link-check workflow end-to-end

После добавления GitHub secret:

```bash
gh workflow run check-links.yml
gh run watch <run-id>
```

Затем проверить Supabase:

- workflow success;
- report: 14 offers, 12 healthy, 2 blocked warnings, 0 problems;
- 14 новых `link_checks` rows;
- все 14 `offers.last_checked` обновлены одним batch;
- Canva/Perplexity остались active/expiring, не стали dead;
- DB write-back status в artifact: `written`.

## Открытые advisor warnings

### `offer_clicks.clicks_insert`

`WITH CHECK (true)` намеренно позволяет публичному `/go/<slug>` писать click row.
Это accepted warning, не случайный admin bypass. Осталось добавить abuse/rate
limiting, когда traffic оправдает инфраструктуру.

### Leaked password protection

Выключено. Сейчас auth magic-link-only, поэтому немедленного password risk нет.
Включить до появления password login/public account password flow.

Performance advisor также показывает старые RLS init-plan, overlapping policies и
missing indexes. Они не входят в текущий hardening batch.

## Изменения во втором репозитории

Vault `/Users/obllako/Documents/studely/studely-vault` тоже имеет незакоммиченные
документальные изменения:

- `HANDOFF.md`;
- `PROJECT_STATUS.md`;
- `README.md`;
- `ROADMAP.md`;
- `TODO.md`;
- новый `OPERATIONS_HARDENING_2026-07-24.md`.

Их коммитить отдельно от application repo.

