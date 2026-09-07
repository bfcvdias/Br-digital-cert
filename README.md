# BR Certificados Québec - launch notes

## Before publishing

1. In `assets/app.js`, replace `YOUR_WHATSAPP_NUMBER` with the business WhatsApp number in international digits only. Optionally add an HTTPS webhook endpoint to send lead data to a CRM or automation.
2. Replace every `SEU-DOMINIO.ca` value in `index.html` with the chosen canonical domain.
3. Publish on Netlify (the included `netlify.toml` makes `/pt/`, `/fr/`, and `/en/` resolve cleanly). Portuguese is the default when the root page is opened.
4. Create a real privacy policy and add its link to the footer before collecting personal information.

## Lead tracking

The form captures name, phone, email, city, language, service, consent, optional message, timestamp, UTM source/campaign/medium/term, landing-page language, and page URL. It stores the latest lead locally as a fallback, posts it to the optional webhook, and creates the WhatsApp message. For reliable team tracking, configure the webhook to a CRM, spreadsheet automation, or server endpoint before launch.

## Claims requiring verification before publication

Do not add the following from the source PDF until the business has documentary support and, where appropriate, legal review: accreditation with ICP-Brasil, SERPRO, or ITI; legal validity/acceptance claims; online marriage claims; any count shown as `[X] countries`; prices, timeframes, and testimonials. The Québécois French-language compliance wording and any claim about Law 96 must be reviewed by a Quebec-qualified professional before being presented as legal advice or compliance status.
