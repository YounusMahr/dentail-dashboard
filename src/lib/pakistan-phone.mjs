export function pakistanMobile(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92')) digits = digits.slice(2);
  if (/^3\d{9}$/.test(digits)) digits = `0${digits}`;
  if (!/^03\d{9}$/.test(digits)) throw new Error('Enter a valid Pakistani mobile number');
  return digits;
}

export function mobileDisplay(value) {
  return `+92 ${pakistanMobile(value).slice(1)}`;
}
