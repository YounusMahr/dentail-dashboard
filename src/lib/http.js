import { NextResponse } from 'next/server';
export const ok = (data, status = 200) => NextResponse.json(data, { status });
export const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });
export const string = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const id = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
