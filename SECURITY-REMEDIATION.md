# Lead security remediation — prepared, not deployed

The live Apps Script deployment was inspected on October 22, 2026. It is version 8 (October 9), runs as the owner, and accepts Anyone. The saved version 8 source matches PR #3's script behavior; differences are comments. MF uses the production endpoint. Its key remains in private Script Properties.

Firebase's current release is shown as fca0c8 (October 22, 11:33 AM). The existing local release record identifies version 457728cf2afca0c8, and its CSP matches the current public response. This is newer than PR #2/#3. **Do not deploy main or this entire branch.** Keep the existing homepage, favicon, consent fixes, removed routes, redirects and other assets. PR #2 and #3 remain drafts. This PR is stacked on #3 to isolate the security diff.

## Implemented in this PR

- Unknown POST actions fail closed; legacySave is removed. Only MF leads and receipt-authenticated timing remain.
- Maximum POST size is 16 KiB; malformed bodies and structured lead fields are rejected.
- Turnstile is verified by Apps Script before any lead is saved or sent to MF. The verifier checks success, allowed hostname, mf_lead action, and cdata equal to the request UUID. Cloudflare rejects expired and replayed tokens. Missing settings, test secrets, verifier errors and budget-storage errors fail closed.
- Persistent Script Properties counters are reserved under ScriptLock. Verification is limited to 60 calls per fixed 10-minute window and 200/day; MF attempts to 20 per fixed 10-minute window and 100/day; normalized phone numbers to 3/hour. Per-phone identifiers use HMAC-SHA256 with a private secret. Failed MF attempts count. Successful/pending receipt retries remain idempotent and do not consume additional verification or MF budget.
- These are global and phone budgets, not IP limits. Apps Script's documented event does not provide a trusted client IP. Fixed windows can allow a burst across a boundary. Limits are conservative starting values and require operational review; distributed traffic can exhaust the daily budget and Apps Script invocation quotas remain exposed. A Cloudflare rule on certificabrasil.ca cannot protect a direct script.google.com request.
- Browser verification loads only upon a valid form submission. Tokens go in POST only; no name, phone or email is sent to Siteverify. Every attempted retry obtains a fresh challenge. Existing ticket text, MF statuses, WhatsApp redirect, receipts, timing and consent behavior are retained.
- security-tests CI uses a standard public-repository runner, pinned checkout, read-only repository permission, no persisted checkout credentials, and no production credentials or external lead calls. No dependencies are installed, no deployment occurs, and Copilot/paid scanning is not enabled.

## Required setup before any production rollout

1. In Cloudflare account **Turnstile**, create a **Free / Managed** widget restricted to certificabrasil.ca and www.certificabrasil.ca. Do not enable pre-clearance or purchase a plan. Put only its public site key in site/assets/lead-bot.js. Keep the secret out of GitHub and chat.
2. In the existing Apps Script project's **Project Settings → Script Properties**, set TURNSTILE_SECRET_KEY and ABUSE_HASH_SECRET (an independently generated random secret with at least 32 characters). Preserve MF_API_KEY. Do not publish yet. Do not use Cloudflare's always-pass test keys in production.
3. Re-read the active Firebase release and retrieve its exact source/configuration. Apply only the app.js submission changes, mf-transport.js token argument/body, new lead-bot.js, and the index.html widget container/script references. Use new asset versions. Apply CSP additions to the **current** policy: add https://challenges.cloudflare.com to script-src and frame-src, preserving the existing hashes, GTM frame source, Google measurement hosts and every other directive. firebase.json in this branch illustrates the additive change against the branch base; it is not the production configuration.
4. Update the privacy notice to describe Cloudflare Turnstile abuse prevention, linking its privacy policy. Analytics and advertising choices must retain their existing behavior.
5. Validate a separate non-production Apps Script with a mock MF endpoint and test spreadsheet plus Cloudflare's documented test keys. Never send artificial leads to MF production. Browser/mobile challenge rendering, production keys, CSP and rejection UX are **not live-validated** by the offline suite.
6. Coordinate client and server activation in a maintenance window. The server is intentionally fail-closed: publishing it before the configured client would reject submissions; publishing a client without real keys would prevent submission. Retain the previous Apps Script deployment version and exact Firebase release for rollback. Publish only after staging validation and a current source/config check; no production deployment was performed here.

## Dashboard status

- Cloudflare's rule named block ip 93.123.109.247 originally used Non-Interactive Challenge. It was changed to **Block**, saved and verified **Active**. Free plan retained. The existing leaked-credential rule does not throttle the lead endpoint.
- GitHub Security rules (22457537) originally enforced only deletion and force-push restrictions. The owner completed Confirm access, and the saved API state was verified active with: PR required, 1 approval, dismiss stale approvals, approval of latest push, resolve conversations, and required security-tests with branches up to date. The bypass list remains empty. An independent reviewer with suitable repository access is needed; the PR author cannot approve their own PR.
- Require security-tests on main after this workflow exists on the relevant PR branches. Existing drafts do not acquire the workflow automatically. Bring the CI/security changes into their eventual reviewed merge chain; do not bypass the rule to merge stale code. Prefer GitHub Actions as the required check source once its first run is registered.

## Validation

Run from repository root:

```
node --test apps-script/test.cjs site/test-mf-timing.cjs site/test-lead-bot.cjs
node tests/google-consent.cjs
node tests/clarity-consent.cjs
```

30 offline tests passed, plus both consent suites. MF and Siteverify were stubbed in all server tests. No synthetic production lead, production deployment, paid-credit service, or key publication was used.

Primary references:
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/plans/
- https://developers.google.com/apps-script/guides/web
