# DentalCare — Independent dental practice workspace

A Next.js, Tailwind CSS and MongoDB application for dental clinics. It is not connected to E-mareez or another practice-management service.

## Run

Use Node.js 22+. Copy `.env.example` to `.env.local`, set the MongoDB connection and database name, then run:

```sh
npm install
npm run dev
```

For production: `npm run build`, then `npm start`. Configure HTTPS and database backups with your hosting provider. `.env.local` is ignored by Git.

## Main workflows

- **Care workspace → Treatment plans:** choose patient, dentist, adult/primary FDI teeth, agreed fee, patient explanation and aftercare. Accepting a draft creates one treatment invoice. Accepted financial details are locked.
- **Sessions:** allocate the treatment fee across visits, optionally link matching appointments and track clinical completion independently from payment. Session allocations cannot exceed the agreed fee. A pending linked lab case blocks session completion.
- **Invoices:** consultation, checkup and treatment fee categories, dentist fees, custom or service items, discounts, partial payments and A4 invoices/receipts. Advance payments reduce the overall balance; session payments also identify the visit. Payment request keys prevent accidental duplicate submissions. Money uses two-decimal validation and atomic database transactions.
- **Prescriptions:** editable English/Urdu/bilingual drafts, structured medicine rows, reusable templates, self-hosted Urdu font, A4 print/PDF via the browser, doctor review/issuance and immutable issued versions with explicit revisions. Browser voice dictation can append draft notes, subject to browser support and microphone permission; no automatic diagnosis or medication selection.
- **Lab work:** laboratory, due date, tooth numbers, plan/session links, cost, ordered/in-progress/received/fitted/remake statuses and status history.
- **Waiting list:** availability dates/times, preferred dentist and required duration. Matching cancelled slots can be offered through the patient portal. Accepting an offer atomically books an available slot; offers do not reserve a slot before acceptance.
- **Patient access:** create/revoke seven-day private links. Patients can see accepted plans, aftercare, session progress, invoices, payment receipts and issued prescriptions, manage future appointments and accept waiting-list offers. Access links are hashed in the database and removed from browser URL fragments after opening.
- **Clinic website:** editable pages, descriptions, images and navigation order; administrator-only draft preview and separate published snapshots. Public pages live under `/clinic/<clinic-slug>/<page-slug>` and link to online booking.
- **Practice insights:** overdue sessions, accepted plans without sessions, lab delays, patient waiting counts and collections less recorded lab/material/provider costs. This is not an accounting profit statement and excludes unrecorded overheads.
- **Patient profile:** tooth-specific treatment/plan/file history. Uploaded clinical files can be linked to FDI tooth numbers and remain behind clinic authentication.
- Existing patient directory, appointments, doctor schedules, treatments, reports, clinic staff/settings and platform subscription workflows remain available.

## WhatsApp: templates only for now

API integration and live sending are intentionally deferred at the owner's request. There is no Whapi, Meta or E-mareez connection.

`Care workspace → Message templates` provides editable English/Urdu text for booking confirmations, appointment/session reminders, follow-ups, receipts and waiting-list offers. Variables: `{{patient}}`, `{{clinic}}`, `{{details}}`. Preview uses sample values.

Only patients with recorded WhatsApp consent and a usable phone number produce pending notifications. Booking and payment events prepare records automatically. **Prepare reminders** scans upcoming visits and due follow-ups. Repeated scans deduplicate events. Status `pending_provider` means prepared, not sent or delivered. A future provider integration must recheck consent, source-record status, templates and expiry before sending.

An optional scheduler can call `POST /api/reminders/run` with `Authorization: Bearer <REMINDER_CRON_SECRET>` to prepare reminders. It never sends messages in this version. Manual WhatsApp links in existing screens still open a draft for staff to send themselves.

## Verification

```sh
npm run build
node --env-file=.env.local tests/integration.mjs
```

The integration check creates a uniquely named `dentalcare_test_*` database on the configured cluster, starts an isolated server on port 3117, verifies real HTTP workflows and removes only that test database. The MongoDB account must be allowed to create/drop test databases. It does not modify the configured clinic database. Add `--preview` to pause with synthetic QA accounts for browser review; send Enter in the test terminal to finish cleanup.

## External services / limits

- WhatsApp provider credentials and sending are deferred, not simulated.
- Payments are recorded by staff; online card charging is not connected.
- Clinical dictation depends on browser speech support and may use the browser vendor's speech service. Clinicians review and issue all clinical content.
- Clinic websites use the application's domain and clinic URL. DNS/custom-domain provisioning is a separate hosting task.
- Dental photograph: [Ozkan Guner on Unsplash](https://unsplash.com/es/fotos/un-dentista-trabajando-en-un-paciente-AWqHc49SU-c). Urdu font license is in `public/fonts/OFL.txt`.

## AI Assistant (Groq)

Clinic administrators can open **AI Assistant** in the sidebar. The server uses `openai/gpt-oss-120b` through Groq, with bounded read-only tools for clinic appointments, patients, doctors, invoices, payments, treatment plans, sessions, lab cases and follow-ups. Put `GROQ_API_KEY` in `.env.local` (or the deployment secret store) and restart the server. Never prefix this key with `NEXT_PUBLIC_`; rotate keys shared in chat.

- English, Urdu and Roman Urdu questions; optional date preferences.
- Conversations stored in MongoDB, scoped to both clinic and administrator; last 50 listed. Each conversation supports up to 40 question/answer pairs and can be deleted.
- Exact financial totals are computed in MongoDB across all matches, with paginated record samples and expandable query evidence. Payments are receipts by creation date; invoice balances are current balances, not historical snapshots. All date filtering uses Asia/Karachi.
- Questions, recent conversation context and selected record fields are sent to Groq. Contact details, medical histories, credentials and prescription contents are excluded from tools. Staff should avoid entering unnecessary sensitive details into chat. Review provider terms and applicable clinic data policies before production use.
- Ten questions per administrator per minute, one active request per chat, bounded tool rounds, provider timeouts and friendly error states. No automatic messages, clinical decisions or record changes.
- AI text can still be mistaken. Check the linked records and the independent source totals. Token-by-token output is not used during tool orchestration; the chat shows live progress and then the completed answer.

Verification: `node --env-file=.env.local tests/ai-integration.mjs --live` creates and removes an isolated synthetic test database. `--live` makes a small real Groq request; omit it for database/security checks without provider usage. `--preview` holds the temporary server for browser QA until Enter is sent. It never seeds production data.

## Account and clinic branding

`My account` now includes Clinic profile and Brand identity for clinic administrators, plus Personal profile and Password & security for every signed-in user. The existing Clinic settings menu opens the same editor. Clinic contact email is separate from the sign-in email; personal name and phone can be updated without changing login identity.

Clinic fields: name, bio, phone, email, WhatsApp number, street address, city, country, postal code, HTTPS website, public opening hours and patient notice. Opening hours are display text; doctor schedules continue to control appointment availability. Public details appear on the clinic booking page.

Logo/favicon uploads accept static PNG, JPEG and WebP up to 2 MB. The server decodes and re-encodes images, strips metadata, limits pixel dimensions and stores the resulting PNG in MongoDB. Only clinic admins can upload/remove them. Logos appear in the workspace clinic badge and public page headers; favicons appear on the clinic's dashboard and public pages. Image changes save immediately; text changes use Save changes. Public branding endpoints expose only the selected image for active clinics.

## Universal search and patient photos

The top bar searches clinic records by name, phone/email, invoice number, date/status and record ID, grouping results by module. Patient-name searches also find their linked appointments, sessions, plans, invoices and lab work. Results respect clinic and role permissions, show up to five matches per group, and open the exact record (with a Show all records option). Type at least two characters; refine broad searches for more precise results.

Patient add/edit forms include an optional PNG/JPEG/WebP profile image (2 MB maximum). Images are decoded, resized to 160×160 and re-encoded as WebP with metadata removed. They stay in authenticated patient records and appear in the patient list and profile. They are not exposed through a public photo endpoint or AI tools.

AI Assistant is the first admin navigation item. Its layout uses the available viewport height; the composer stays visible and the conversation scrolls internally. Responsive layouts retain universal search on smaller screens.
