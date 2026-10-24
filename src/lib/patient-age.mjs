export function ageFromBirthDate(date, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) return null;
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number);
  const age = currentYear - year - (currentMonth < month || currentMonth === month && currentDay < day ? 1 : 0);
  return Number.isInteger(age) && age >= 0 && age <= 120 ? age : null;
}

export function patientAge(patient) {
  if (patient && Object.hasOwn(patient, 'age')) return Number.isInteger(patient.age) && patient.age >= 0 && patient.age <= 120 ? patient.age : null;
  return ageFromBirthDate(patient?.dateOfBirth);
}
