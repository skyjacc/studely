# Affiliate Program Operations

## Current state — 2026-07-24

- 14 published offers.
- `affiliate = false` on all offers.
- No `affiliate_url`, tracking source or campaign configured.
- `/go/<slug>` already logs every outbound click and falls back to official `url`.
- AdSense is under Google review and is outside this runbook.

## Program onboarding gate

Before joining a program, record:

- provider/network legal name;
- program terms and prohibited traffic sources;
- payout event, amount/rate, cookie window and reversal rules;
- countries and student eligibility;
- allowed disclosure wording;
- whether deep links, email, paid search and brand bidding are permitted;
- account owner, recovery method and tax/payment status.

Reject programs that require misleading copy, hide pricing, change Studely score, or conflict with student privacy/minor protections.

## Configure one offer

1. Keep `url` as official non-affiliate fallback.
2. Store partner link in `offers.affiliate_url`.
3. Set `affiliate = true`.
4. Optionally set `tracking_source = 'studely'` and stable `tracking_campaign`.
5. Never put secrets/API credentials in URL fields.
6. Publish through admin and confirm deploy status says “Rebuild triggered”.
7. Open `/go/<slug>?src=admin-test` in private window.
8. Confirm redirect destination, disclosure badge/copy and one `offer_clicks` row.
9. Test link with tracking disabled/ad blocker where relevant.

## Rollback

Set `affiliate = false` and clear `affiliate_url`; `/go` immediately falls back to official URL after DB change because redirect route is dynamic. Trigger rebuild so affiliate disclosure on static offer page disappears.

## Measurement

Track per offer: outbound clicks, partner conversions, approved commissions, reversals and revenue per click. Commercial performance never changes Studely score.
