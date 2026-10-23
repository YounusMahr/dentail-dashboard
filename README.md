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

- **Fast booking:** one new or existing patient appointment automatically creates a visit session, service-priced PKR invoice and editable bilingual prescription draft. A new patient adds the clinic's configurable Rs 500 checkup fee unless the selected service includes checkup. The receptionist collects payment on the same visit screen; an existing patient is reused for later appointments.
- **Care workspace → Treatment plans:** choose patient, dentist, adult/primary FDI teeth, agreed fee, patient explanation and aftercare. Accepting a draft creates one treatment invoice. Accepted financial details are locked.
- **Sessions:** allocate the treatment fee across visits, optionally link matching appointments and track clinical completion independently from payment. Session allocations cannot exceed the agreed fee. A pending linked lab case blocks session completion.
- **Invoices:** consultation, checkup and treatment fee categories, dentist fees, custom or service items, discounts, partial payments and A4 invoices/receipts. Advance payments reduce the overall balance; session payments also identify the visit. Payment request keys prevent accidental duplicate submissions. Money uses two-decimal validation and atomic database transactions.
- **Prescriptions:** editable English/Urdu/bilingual drafts, structured medicine rows, reusable templates, self-hosted Urdu font, A4 print/PDF via the browser, doctor review/issuance and immutable issued versions with explicit revisions. Browser voice dictation can append draft notes, subject to browser support and microphone permission; no automatic diagnosis or medication selection.
- **Lab work:** laboratory, due date, tooth numbers, plan/session links, cost, ordered/in-progress/received/fitted/remake statuses and status history.
- **Waiting list:** availability dates/times, preferred dentist and required duration. Matching cancelled slots can be offered through the patient portal. Accepting an offer atomically books an available slot; offers do not reserve a slot before acceptance.
- **Patient access:** create/revoke seven-day private links. Patients can see accepted plans, aftercare, session progress, invoices, payment receipts and issued prescriptions, manage future appointments and accept waiting-list offers. Access links are hashed in the database and removed from browser URL fragments after opening.
- **Clinic website:** editable pages, descriptions, images and navigation order; administrator-only draft preview and separate published snapshots. Public pages live under `/clinic/<clinic-slug>/<page-slug>` and link to online booking.
- **Practice insights:** overdue sessions, accepted plans without sessions, lab delays, patient waiting counts and collections less recorded lab/material/provider costs. This is not an accounting profit statement and excludes unrecorded overheads.
- **Patient profile:** compact overview with contact and medical details, appointments, clinical care, billing, files and patient-specific message history. WhatsApp care messages can be switched on or off from the patient file. Uploaded clinical files can be linked to FDI tooth numbers and remain behind clinic authentication.
- Existing patient directory, appointments, doctor schedules, treatments, reports and clinic staff/settings remain available.

## Patient messages

Appointment, session and follow-up reminders are prepared for consented patients. WhatsApp provider connection is configured separately in the care workspace. A pending record is not a sent message. There is no E-mareez connection.

`Care workspace → Message templates` provides editable English/Urdu text for booking confirmations, appointment/session reminders, follow-ups, receipts and waiting-list offers. Variables: `{{patient}}`, `{{clinic}}`, `{{details}}`. Preview uses sample values.

Only patients with recorded WhatsApp consent and a usable phone number produce notifications. The **Book appointment** action saves the visit and sends its confirmation through the connected Evolution instance after the response. Payment and prescription messages are prepared when staff presses **Print receipt & send** or **Print / PDF & send** on the printable document; simply opening a print preview does not message the patient. Draft prescriptions print without sending. Repeated print clicks use one event key per receipt or issued prescription revision. The provider's send result appears under **Follow-ups → Message history**, on the patient profile, and in the notification bell. Status `pending_provider` means queued, while `sent` means accepted by the provider; consent is checked again before dispatch. Print messages contain receipt details or a prescription-ready notice, not the printable document as a WhatsApp/email attachment.

For the WhatsApp QR connection, configure `EVOLUTION_API_URL` and `EVOLUTION_API_KEY` as server-side variables. The key must be the Evolution server's **global** `AUTHENTICATION_API_KEY` because instance creation requires it. On Vercel, set both for Production and redeploy. The dashboard reports `unconfigured`, `unauthorized`, or `unavailable` without revealing the key; it no longer substitutes a hardcoded key. Opening the QR dialog does not create an instance until staff selects Generate QR Code.

The appointment list no longer uses a manual WhatsApp shortcut. The reminder scheduler queues a reminder two days before the appointment for consented WhatsApp and email recipients, then a WhatsApp reminder within the last hour. It dispatches pending messages through the configured providers and deduplicates each reminder. A removed or rescheduled appointment invalidates stale queued messages.

`vercel.json` schedules `GET /api/reminders/run` once daily in Production, within the Vercel Hobby limit. Set `CRON_SECRET` and `REMINDER_CRON_SECRET` on Vercel to the same long random value. For timely two-day and one-hour reminders on the free plan, enable the committed GitHub Actions workflow in `.github/workflows/care-reminders.yml` and set the GitHub repository secret `REMINDER_CRON_SECRET` to that same value. The workflow calls `POST /api/reminders/run` every 15 minutes and can also be run manually. GitHub scheduled runs may be delayed, so the one-hour timing is approximate. The daily Vercel job is a fallback and cannot guarantee the one-hour reminder on its own. Delivery requires a connected Evolution API instance and `RESEND_API_KEY`/`EMAIL_FROM` for email.

Patients can separately opt in to appointment and care emails. Booking creates a confirmation email; pressing the receipt or issued-prescription print button creates the corresponding email. Set `RESEND_API_KEY` and `EMAIL_FROM` on the server to deliver through Resend; otherwise records remain `pending_provider`. A payment email contains receipt details and balance. A prescription email tells the patient to request a private portal link; the document itself is available through the authenticated patient portal and is not attached to email. Demo patient contacts have consent off.

## Verification

```sh
npm run build
node tests/evolution-connection.mjs
node --env-file=.env.local tests/visit-integration.mjs
node --env-file=.env.local tests/integration.mjs
```

The integration check creates a uniquely named `dentalcare_test_*` database on the configured cluster, starts an isolated server on port 3117, verifies real HTTP workflows and removes only that test database. The MongoDB account must be allowed to create/drop test databases. It does not modify the configured clinic database. Add `--preview` to pause with synthetic QA accounts for browser review; send Enter in the test terminal to finish cleanup.

## External services / limits

- WhatsApp delivery depends on a connected provider and explicit patient consent. Email delivery depends on Resend credentials and separate email consent.
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
