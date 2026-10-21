# Laravel → Next.js feature parity audit

Reference: `laravel-dentists/routes/web.php`, application controllers/models, and corresponding Blade forms. The reference folder is retained unchanged. Next.js remains the running application.

## Module checklist

| Laravel area | Next.js implementation / update |
|---|---|
| Clinic registration, login, tenancy and roles | Existing auth, clinic registration, sessions and role-scoped routes retained. |
| Dashboard | Existing clinic statistics and daily schedule; five quick actions, with role-aware treatment/payment links. |
| Appointment creation | Existing/new patient modes; patient and booking transaction; dentist, procedure, date, available slot and chief complaint. |
| Appointment lifecycle | Status and cancellation reason in appointment editor; date/time changes reschedule the existing record; doctor/shift/break/shared-chair availability checks. |
| Doctor accounts and schedules | Login created with roster; optional password reset on edit; account/profile synchronisation; own schedule edits for dentists; deactivation preserves records. |
| Chair roster | Weekly weekday timetable, shift/break display, chair assignment, weekday presets and slot duration. |
| Patient directory | Photo retained; gender, blood group, medical-alert and name/phone/email filters, paginated results. |
| Patient dossier | Appointment/treatment history, invoice and receipt ledger, outstanding balance, recalls, tooth history. |
| Clinical documents | 15 MB JPEG/PNG/PDF, type, teeth, notes, authenticated preview/download/delete. |
| Clinical treatments | FDI tooth picker and confidential fields retained; linked appointment completion, recall scheduling and service-fee invoice creation saved in one transaction. |
| Billing | Multiple service/custom items, discounts, due date, consultation/checkup fees; upfront payment and receipt saved atomically; partial/session payments retained. |
| Invoice cancellation | Admin can void unpaid invoice. Paid invoices cannot be silently voided; clinical/financial records cannot be hard deleted. |
| Follow-up queue | Overdue/today/next-seven-days/contacted/booked filters; status editing records last contact time. |
| Service catalog | Laravel categories, service fee lookup, active status; referenced invoice services protected from deletion. |
| Staff | Existing role/contact/password/active editor and dentist profile links retained; role/status filtering. |
| Reports | Today/week/month/last-month/year/custom ranges; billed, collected, discounts, outstanding, all receivables, invoice status, chair productivity, doctor performance, categories, top procedures and payment ledger; print. |
| Clinic settings | Existing branding/contact/bio fields; editable unique public slug, currency and timezone preferences. Invoice currency is captured; changing currency after financial records is blocked. |
| Public clinic | Existing service/doctor catalog and booking; shared-chair and shift/break availability. |
| Subscription | Existing plan/renewal request and verified approval retained; manual verified payment and period extension; plan/status/interval controls. |
| Platform | Clinic status, search, per-clinic usage/financial overview, MRR/ARR, active/trial counts and subscription payment ledger. |
| WhatsApp | Templates, consent, manual links and pending-provider queue retained. Live API remains deferred at the user's request. |

## Deliberate differences from reference

- Laravel's checkout generates successful card-payment records without a real gateway charge. Next.js does not reproduce simulated successful payments; verified approval/manual payment is used.
- Next.js retains stricter tenant/role checks and protects historical clinical and financial records from destructive deletion.
- PDF/JPEG/PNG are accepted for clinical files; executable/active document types are not introduced.
- Additional existing Next.js features remain: treatment plans/sessions, lab tracking, prescriptions, public content pages, patient portal, universal search and read-only AI assistance.

## Verification

Final build, synthetic isolated-database workflow checks and UI checks are recorded after implementation. No reference database import or changes to real patient records are part of this audit.
