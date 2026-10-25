import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';

const secret = () => {
  const value = process.env.CLINIC_SMTP_SECRET || '';
  if (value.length < 32) throw new Error('CLINIC_SMTP_SECRET must be at least 32 characters in server environment settings');
  return createHash('sha256').update(value).digest();
};

export function encryptSmtpPassword(password) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secret(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSmtpPassword(value) {
  const [version, iv, tag, data] = String(value || '').split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Stored SMTP password is invalid');
  const decipher = createDecipheriv('aes-256-gcm', secret(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

export function cleanSmtpSettings(body) {
  const host = String(body.host || '').trim().toLowerCase();
  const port = Number(body.port);
  const username = String(body.username || '').trim();
  const fromEmail = String(body.fromEmail || '').trim().toLowerCase();
  const fromName = String(body.fromName || '').trim();
  const password = String(body.password || '');
  if (!/^(?=.{4,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(host) || !host.includes('.') || /(^|\.)(localhost|local|internal)$/.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error('Enter a public SMTP hostname');
  if (![465, 587].includes(port)) throw new Error('SMTP port must be 465 or 587');
  if (!username || username.length > 254) throw new Error('Enter the SMTP username');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) throw new Error('Enter a valid sender email');
  if (!fromName || fromName.length > 100) throw new Error('Enter a sender name up to 100 characters');
  if (password.length > 500) throw new Error('SMTP password is too long');
  return { host, port, username, fromEmail, fromName, password };
}

export function smtpTransport(settings) {
  const password = decryptSmtpPassword(settings.passwordEncrypted);
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: settings.port === 587,
    auth: { user: settings.username, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: true }
  });
}

export function smtpSender(settings) {
  return { name: settings.fromName, address: settings.fromEmail };
}
