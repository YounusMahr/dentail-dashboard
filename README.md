# DentalCare Next.js

This is a Next.js and MongoDB dental clinic dashboard.

## Run locally

1. Copy `.env.example` to `.env.local` and enter a MongoDB Atlas connection string.
2. Run `npm install` and `npm run dev` in the project root.
3. Open `http://localhost:3000`.

The configured Atlas database already contains the migrated clinic records. Existing accounts can sign in with their current passwords. New passwords use scrypt. Users should change seeded/demo passwords from **My account**.

## Implemented workflows

- Multi-clinic data scoping, sessions, roles, clinic registration, public clinic page, doctor slots and booking.
- Patient directory, profile history and private JPEG/PNG/PDF documents stored in MongoDB GridFS.
- Appointment scheduling and status changes, doctor shifts and breaks, services, FDI tooth selection, treatment notes and printable treatment summaries.
- Multi-item invoices, partial payments, balances, printable invoices and receipts.
- Follow-ups, manual WhatsApp links, clinic reports, staff, settings, subscription requests and platform approval/suspension.
- Optional reminder endpoint at `POST /api/reminders/run`, protected by `REMINDER_CRON_SECRET` and using the configured WhatsApp credentials. A scheduler must call it once daily.

## External setup still required

- The WhatsApp Cloud credentials and a scheduler are needed for automated reminders. Meta template approval and delivery webhooks are not configured here.
- Subscription charges are verified outside the app. A platform owner enters a payment reference when approving a plan request. There is no integrated card payment gateway.
- Configure HTTPS, backups and production hosting before live clinical use.

The app stores its data in MongoDB collections.
