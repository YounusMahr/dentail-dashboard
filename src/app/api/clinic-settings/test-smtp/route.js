import nodemailer from 'nodemailer';
import { ObjectId } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/http';

export async function POST(request) {
  const user = await currentUser();
  if (user?.role !== 'clinic_admin' || !user.clinicId || !sameOrigin(request)) return fail('Unauthorized', 403);
  const body = await request.json().catch(() => ({}));
  const database = await db();
  const clinic = await database.collection('clinics').findOne({ _id: new ObjectId(user.clinicId) });
  if (!clinic) return fail('Clinic not found', 404);

  const host = String(body.smtpHost || clinic.smtpHost || '').trim();
  const port = Number(body.smtpPort || clinic.smtpPort) || 587;
  const secure = body.smtpSecure !== undefined ? Boolean(body.smtpSecure) : (clinic.smtpSecure ?? (port === 465));
  const authUser = String(body.smtpUser || clinic.smtpUser || '').trim();
  const authPass = body.smtpPass && body.smtpPass !== '••••••••' ? String(body.smtpPass) : String(clinic.smtpPass || '');
  const fromAddr = String(body.smtpFrom || clinic.smtpFrom || '').trim() || `"${clinic.name || 'Dental Clinic'}" <${authUser}>`;
  const to = String(body.testEmail || user.email || authUser).trim();

  if (!host || !authUser || !authPass) return fail('SMTP Host, Username, and Password are required', 400);
  if (!to || !to.includes('@')) return fail('Valid recipient email is required', 400);

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: authUser, pass: authPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    await transporter.verify();
    await transporter.sendMail({
      from: fromAddr,
      to,
      subject: `SMTP Test · ${clinic.name || 'Dental Clinic'}`,
      text: `Hello,\n\nYour clinic custom SMTP email configuration is working successfully.\n\nSent from ${clinic.name || 'Dental Clinic'} at ${new Date().toISOString()}`,
      html: `<div style="font-family:Arial,sans-serif;color:#183b37;max-width:500px;padding:20px;border:1px solid #d9e9df;border-radius:10px;">
        <h2 style="color:#118c72;margin-top:0;">SMTP Connection Verified!</h2>
        <p>Congratulations, your clinic custom SMTP email service is successfully connected and working.</p>
        <p><strong>Clinic:</strong> ${clinic.name || 'Dental Clinic'}</p>
        <p><strong>SMTP Host:</strong> ${host}:${port} (${secure ? 'SSL' : 'TLS/STARTTLS'})</p>
        <p><strong>From:</strong> ${fromAddr}</p>
        <small style="color:#789184;">Sent automatically from DentalCare Clinic Workspace.</small>
      </div>`
    });

    return ok({ success: true, message: `Test email sent successfully to ${to}` });
  } catch (err) {
    return fail(err.message || 'SMTP connection failed', 400);
  }
}
