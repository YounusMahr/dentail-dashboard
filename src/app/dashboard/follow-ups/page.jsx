import NotificationHistory from '@/components/notification-history';

export default function FollowUpHistoryPage() {
  return <div className="mx-auto max-w-6xl space-y-4 pb-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><span className="eyebrow">PATIENT COMMUNICATION</span><h1 className="mb-0">Follow-up history</h1><p className="muted mt-1">Appointment messages, care reminders, receipts and prescription notices in one place.</p></div>
    </div>
    <NotificationHistory />
  </div>;
}
