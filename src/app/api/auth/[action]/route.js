import { db, ensureIndexes } from '@/lib/db';
import { clearSession, createSession, currentUser, hashPassword, sameOrigin, verifyPassword } from '@/lib/auth';
import { fail, ok, string } from '@/lib/http';

export async function GET(request, { params }) {
  if ((await params).action !== 'me') return fail('Not found', 404);
  const user = await currentUser();
  return ok({ user: user ? { id: String(user._id), name: user.name, email: user.email, role: user.role, clinicId: user.clinicId, doctorId:user.doctorId||null } : null });
}

export async function POST(request, { params }) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const action = (await params).action;
  if (action === 'logout') { await clearSession(); return ok({ success: true }); }
  const body = await request.json().catch(() => ({}));
  const database = await db();
  if (action === 'login') {
    const user = await database.collection('users').findOne({ email: string(body.email).toLowerCase(), active: true });
    if (!user || !verifyPassword(String(body.password || ''), user.passwordHash)) return fail('Invalid email or password', 401);
    await createSession(String(user._id));
    return ok({ success: true });
  }
  if (action === 'register') {
    const clinicName = string(body.clinicName, 150), ownerName = string(body.ownerName, 150);
    const email = string(body.email).toLowerCase(), password = String(body.password || '');
    if (!clinicName || !ownerName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return fail('Enter clinic, owner, valid email and an 8 character password');
    await ensureIndexes();
    const slugBase = clinicName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clinic';
    let slug = slugBase;
    for (let i = 1; await database.collection('clinics').findOne({ slug }); i++) slug = `${slugBase}-${i}`;
    const session = database.client.startSession();
    let userId;
    try {
      await session.withTransaction(async () => {
        const clinic = await database.collection('clinics').insertOne({ name: clinicName, slug, phone: string(body.clinicPhone, 30), address: string(body.address), currency: 'PKR', timezone: 'Asia/Karachi', status: 'active', createdAt: new Date() }, { session });
        const clinicId = String(clinic.insertedId);
        const user = await database.collection('users').insertOne({ clinicId, name: ownerName, email, phone: string(body.ownerPhone, 30), passwordHash: hashPassword(password), role: 'clinic_admin', active: true, createdAt: new Date() }, { session });
        userId = String(user.insertedId);
        await database.collection('doctors').insertOne({ clinicId, userId, name: ownerName, email, specialization: 'Dental Surgeon / Clinic Director', consultationFee: 1500, slotMinutes: 30, workingDays: 'monday,tuesday,wednesday,thursday,friday,saturday', startTime: '10:00', endTime: '20:00', active: true, createdAt: new Date() }, { session });
        await database.collection('services').insertMany([
          { name: 'Consultation & Dental Checkup', standardFee: 1500, durationMinutes: 20 },
          { name: 'Scaling & Polishing', standardFee: 3000, durationMinutes: 30 },
          { name: 'Tooth Restoration / Filling', standardFee: 4000, durationMinutes: 30 },
        ].map(item => ({ ...item, clinicId, active: true, createdAt: new Date() })), { session });
      });
      await createSession(userId);
      return ok({ success: true, slug }, 201);
    } catch (error) {
      if (error.code === 11000) return fail('Email already registered', 409);
      throw error;
    } finally { await session.endSession(); }
  }
  return fail('Not found', 404);
}
