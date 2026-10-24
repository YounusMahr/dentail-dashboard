import PDFDocument from 'pdfkit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ObjectId } from 'mongodb';

const money = value => `Rs ${Number(value || 0).toLocaleString('en-PK')}`;
const date = value => value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' }) : '';
const image = value => value ? Buffer.from(value.buffer || value) : null;
const line = (doc, label, value) => {
  if (value === undefined || value === null || value === '') return;
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(String(value));
  doc.moveDown(0.4);
};
const section = (doc, title) => {
  doc.moveDown(0.7).font('Helvetica-Bold').fontSize(12).fillColor('#075f52').text(title);
  doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor('#203b3a');
};
async function renderPdf(draw) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Producer: 'DentalCare' } });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  await draw(doc);
  const count = doc.bufferedPageRange().count;
  for (let page = 0; page < count; page++) {
    doc.switchToPage(page);
    doc.font('Helvetica').fontSize(8).fillColor('#748481').text(`Page ${page + 1} of ${count}`, 48, 796, { width: 500, align: 'right' });
  }
  doc.end();
  return done;
}
function header(doc, clinic, title) {
  const logo = image(clinic.logoData);
  if (logo) { try { doc.image(logo, 48, 45, { fit: [48, 48] }); } catch {} }
  const left = logo ? 106 : 48;
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#075f52').text(clinic.name || 'Dental Clinic', left, 48, { width: 440 });
  doc.font('Helvetica').fontSize(9).fillColor('#667b78').text([clinic.address, clinic.city, clinic.phone].filter(Boolean).join(' · '), left, 74, { width: 440 });
  doc.moveTo(48, 108).lineTo(547, 108).strokeColor('#a9cfc7').stroke();
  doc.font('Helvetica-Bold').fontSize(17).fillColor('#173b35').text(title, 48, 125);
  doc.font('Helvetica').fontSize(10).fillColor('#203b3a').moveDown(0.8);
}
async function thermalReceiptPdf(payment, invoice, patient, clinic) {
  const bankRows = [['Bank / wallet', clinic.bankName], ['Account title', clinic.accountTitle], ['Account number', clinic.accountNumber], ['IBAN', clinic.iban]].filter(([, value]) => value);
  const hasQr = !!clinic.paymentQrData;
  const width = 226.77; // 80 mm thermal roll
  const height = 405 + bankRows.length * 28 + (hasQr ? 140 : 0);
  const doc = new PDFDocument({ size: [width, height], margins: { top: 16, bottom: 16, left: 16, right: 16 }, info: { Producer: 'DentalCare' } });
  const chunks = [];
  const finished = new Promise((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const center = (text, size = 10, bold = false) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor('#153b35').text(String(text || ''), { align: 'center' });
  const divider = () => { doc.moveDown(0.5); doc.moveTo(16, doc.y).lineTo(width - 16, doc.y).strokeColor('#a0bdb7').stroke(); doc.moveDown(0.7); };
  const row = (label, value) => { doc.font('Helvetica').fontSize(8).fillColor('#55716c').text(label); doc.font('Helvetica-Bold').fontSize(9).fillColor('#173b35').text(String(value || '—'), { width: width - 32 }); doc.moveDown(0.55); };
  const logo = image(clinic.logoData);
  if (logo) { try { doc.image(logo, (width - 38) / 2, doc.y, { fit: [38, 38] }); doc.y += 43; } catch {} }
  center(clinic.name || 'Dental Clinic', 13, true);
  if (clinic.phone) center(clinic.phone, 8);
  if (clinic.address) center(clinic.address, 8);
  divider(); center('PAYMENT RECEIPT', 11, true); doc.moveDown(0.8);
  row('Receipt no.', String(payment._id).slice(-10).toUpperCase());
  row('Invoice no.', invoice.invoiceNumber || String(invoice._id));
  row('Date', date(payment.createdAt));
  row('Patient', patient.name);
  row('Method', payment.paymentMethod);
  divider();
  row('AMOUNT RECEIVED', money(payment.amount));
  row('Remaining balance', money(invoice.balanceAmount));
  if (bankRows.length || hasQr) {
    divider(); center('ONLINE PAYMENT', 9, true); doc.moveDown(0.6);
    for (const [label, value] of bankRows) row(label, value);
    if (hasQr) { const qr = image(clinic.paymentQrData); try { doc.image(qr, (width - 102) / 2, doc.y + 2, { fit: [102, 102] }); doc.y += 108; center('Scan to pay', 8); } catch {} }
  }
  divider(); center('Thank you for choosing our clinic.', 8);
  doc.end();
  return finished;
}

export async function buildNotificationPdf(database, item, clinic) {
  if (!ObjectId.isValid(item.sourceId || '') || !['payment_receipt', 'prescription_ready', 'prescription_issued'].includes(item.type)) return null;
  const clinicId = item.clinicId, recordId = new ObjectId(item.sourceId);
  if (item.type === 'payment_receipt') {
    const payment = await database.collection('payments').findOne({ _id: recordId, clinicId });
    if (!payment) throw new Error('Payment record not found');
    const [invoice, patient] = await Promise.all([
      database.collection('invoices').findOne({ _id: new ObjectId(payment.invoiceId), clinicId }),
      database.collection('patients').findOne({ _id: new ObjectId(payment.patientId), clinicId })
    ]);
    if (!invoice || !patient) throw new Error('Receipt details are incomplete');
    const buffer = await thermalReceiptPdf(payment, invoice, patient, clinic);
    return { buffer, fileName: `Receipt-${String(payment._id).slice(-10)}.pdf` };
  }
  const prescription = await database.collection('prescriptions').findOne({ _id: recordId, clinicId });
  if (!prescription) throw new Error('Prescription record not found');
  const [patient, doctor] = await Promise.all([
    database.collection('patients').findOne({ _id: new ObjectId(prescription.patientId), clinicId }),
    database.collection('doctors').findOne({ _id: new ObjectId(prescription.doctorId), clinicId })
  ]);
  if (!patient || !doctor) throw new Error('Prescription details are incomplete');
  const urduFont = await readFile(join(process.cwd(), 'public', 'fonts', 'urdu-pdf.ttf'));
  const buffer = await renderPdf(doc => {
    doc.registerFont('ClinicUrdu', urduFont);
    header(doc, clinic, 'PRESCRIPTION');
    line(doc, 'Patient', patient.name);
    line(doc, 'Date', date(prescription.issuedAt || prescription.createdAt));
    line(doc, 'Dentist', doctor.name);
    line(doc, 'Diagnosis', prescription.diagnosis);
    section(doc, 'Rx / MEDICINES');
    const medicines = Array.isArray(prescription.medications) ? prescription.medications : [];
    for (const [index, med] of medicines.entries()) {
      if (doc.y > 675) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#173b35').text(`${index + 1}. ${med.name || 'Medicine'} ${med.strength || ''}`);
      doc.font('Helvetica').fontSize(9).text([med.dose, med.frequency, med.duration].filter(Boolean).join('  ·  '));
      if (med.instructions) doc.text(med.instructions);
      doc.moveDown(0.7);
    }
    if (prescription.instructionsEn) { section(doc, 'INSTRUCTIONS'); doc.text(prescription.instructionsEn); }
    if (prescription.instructionsUr) { section(doc, 'URDU INSTRUCTIONS'); doc.font('ClinicUrdu').fontSize(12).text(prescription.instructionsUr, { align: 'right' }).font('Helvetica').fontSize(10); }
    if (prescription.reviewDate) { section(doc, 'NEXT REVIEW'); doc.text(date(prescription.reviewDate)); }
    doc.moveDown(2).font('Helvetica').fontSize(9).text(`Prescribed by: ${doctor.name}`);
    doc.moveDown().text('Doctor signature / stamp: __________________________');
  });
  return { buffer, fileName: `Prescription-${String(prescription._id).slice(-10)}-r${prescription.revision || 1}.pdf` };
}
