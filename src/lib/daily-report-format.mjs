const money = value => `Rs ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

export function formatDailyReport({ name, day, totalPatients, newPatients, appointments, bookedToday, billed, received, outstanding }) {
  return `*${name} · Daily Report*\n*Date:* ${day}\n\n*Total patients:* ${totalPatients}\n*New patients today:* ${newPatients}\n*Today's appointments:* ${appointments}\n*Appointments booked today:* ${bookedToday}\n\n*Fees billed today:* ${money(billed)}\n*Payments received today:* ${money(received)}\n*Current outstanding balance:* ${money(outstanding)}\n\nPayments received reflects collections recorded today, not profit.`;
}
