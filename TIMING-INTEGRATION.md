# Lead-to-WhatsApp timing

This change adds measurement to the existing MF production integration. It does not change the visual design, favicon, the 1.5-second polling interval, the current `await post`, or the ticket requirement.

## Deployment status

Deployed to production on 2026-10-09 at approximately 15:54 America/Toronto. Apps Script Version 8 uses the same existing /exec URL and MF PRD endpoint. Firebase Hosting version `8d59864dbc24f1bd` was cloned from the exact current live release; only `/assets/app.js` and `/assets/mf-transport.js` changed. All other 32 files and existing configuration remained unchanged. Hosting's existing no-cache policy applies to both scripts.

One marked live form test recorded Leads row 36 and ticket `BRN-on46um1`. MF API: 7271 ms; server before API: 1867 ms; server after API: 191 ms; total server: 9329 ms; click-to-receipt: 19520 ms; click-to-redirect: 19528 ms; receipt-to-redirect: 8 ms; opaque POST settled: 11561 ms; last JSONP query: 1496 ms; two queries. Telemetry outcome: redirect_started. The browser visibly reached the WhatsApp page with this ticket. No WhatsApp message was sent.

These are a single test's measurements, not a performance improvement claim. The observed delay was before receipt delivery, not waiting after it. Transport/startup/polling need further investigation; this data does not attribute their exact individual contribution. The previous 15 tests passed; a repeat via the restored local runtime timed out, so no additional completed test run is claimed.

## Metrics in the existing Leads tab

Values are milliseconds, except the poll count and timestamps. Blank means not captured, never zero.

| Column | Metric | Definition |
|---|---|---|
| W | Tempo API MF (ms) | Server clock: immediately before UrlFetchApp.fetch until return or exception. |
| X | Servidor antes da API (ms) | Server doPost entry to API call; includes validation, lock wait and saving the lead. Excludes browser-to-server network and startup before handler entry. |
| Y | Servidor após API até recibo (ms) | API return to the moment just before publishing the receipt in cache; includes response processing and existing Sheet updates. |
| Z | Servidor até publicar recibo (ms) | doPost entry to the moment just before publishing the receipt in cache. Cache publication itself is not timed. |
| AA | Clique até receber ticket (ms) | Browser monotonic clock: validated submit click to first final JSONP receipt, BEFORE waiting for the original POST. For failures it is final receipt arrival; it does not prove a ticket exists. |
| AB | Clique até iniciar WhatsApp (ms) | Browser monotonic clock: submit click to the instant immediately before recording telemetry and assigning the WhatsApp URL. Tiny synchronous telemetry/navigation preparation is excluded. |
| AC | Ticket recebido até WhatsApp (ms) | AB minus AA; includes waiting for the original opaque POST and final validation/link preparation. |
| AD | Clique até POST terminar (ms) | Browser monotonic clock: submit click to opaque POST settling. A no-cors response or transport error is not proof of API success. |
| AE | Última consulta de recibo (ms) | Browser monotonic clock: last successful JSONP consultation round trip. |
| AF | Consultas de recibo | Count of JSONP consultations, including failed consultations. |
| AG | Clique até falha (ms) | Browser monotonic clock: submit click to failure handling, for failed attempts only. |
| AH | Resultado da medição | `redirect_started` or `failed`. Redirect started does not prove WhatsApp loaded. |
| AI | Medição no navegador (UTC) | Browser wall-clock timestamp for the measurement. Not used to calculate intervals against server timestamps. |
| AJ | Medição registrada | Server timestamp when telemetry was stored. Not WhatsApp load time. |

The header initializer expands the tab to AJ if necessary. Original columns and row identity remain unchanged. Browser measurements are latest-attempt values on that lead row; later retries can replace them. Old records cannot be backfilled faithfully.

## What this can diagnose

- High W: upstream MF API call is slow.
- High X: saving/locking/processing before calling MF is slow.
- High Y: processing and saving after the API return is slow.
- High AC with AD later than AA: the browser already has the ticket but is waiting for the original POST. This is a candidate for a separate performance fix after observing real data.
- High AA beyond server duration: outbound network/startup plus receipt transport/polling contribute. It is not a pure API-return-to-browser duration; browser and Google server clocks are not synchronized, and no cross-clock timestamp subtraction is performed.

The website cannot accurately detect WhatsApp chat loading on another origin or in the native app. That final stage requires an external browser test on a representative device. These measurements stop at starting the redirect with the ticket.

## Logging safety and reliability

Only numeric timings, counts, outcome and timestamps are sent in telemetry. The existing random receipt ID and secret token authenticate the POST; no name, phone, email, API key or WhatsApp URL is included in the timing payload. The server checks the cached token and stored hash before touching the corresponding lead row, validates bounded integers, and reads authoritative server durations from its cache. It never sends another lead to MF or alters ticket/status fields.

The browser uses sendBeacon with text/plain; if queuing fails it falls back to a no-cors keepalive POST. There is no awaited logging request in the redirect path. Delivery is best effort: navigation, network failure, lock contention, token expiry, or browser privacy features can leave timing cells blank. `certificabrasil-last-timing` in sessionStorage and `window.certificaBrasilTiming` retain numeric diagnostics on the site for inspection; no contact data or receipt tokens are stored there. No new GA/Clarity event is added.

## Verification

Run `node --test apps-script/test.cjs site/test-mf-timing.cjs` (15 tests). Tests cover successful/error API timing, a delayed POST after ticket receipt, nonblocking telemetry/fallback, invalid tokens/values, late telemetry, record preservation, and no extra MF calls.

After release, submit a marked fresh test once. Confirm a real ticket, PRD status, W and AA/AB values, and the WhatsApp redirect message with the same ticket. Inspect the last timing in browser sessionStorage if telemetry delivery is missing. Do not claim performance improvement from instrumentation alone.
