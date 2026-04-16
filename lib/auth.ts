import crypto from 'crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase';

const SECRET = process.env.SESSION_SECRET || 'dev-secret';

export function hashPin(name: string, pin: string) {
  return crypto.createHash('sha256').update(`${name}:${pin}:${SECRET}`).digest('hex');
}

function sign(payload: string) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function makeToken(name: string, role: string) {
  const payload = `${name}|${role}|${Date.now()}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

export function verifyToken(token?: string): { name: string; role: string } | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64url').toString();
    const parts = raw.split('|');
    if (parts.length !== 4) return null;
    const [name, role, ts, sig] = parts;
    if (sign(`${name}|${role}|${ts}`) !== sig) return null;
    return { name, role };
  } catch {
    return null;
  }
}

export function getSession() {
  const token = cookies().get('sunho_session')?.value;
  return verifyToken(token);
}

export async function requireUser() {
  const s = getSession();
  if (!s) throw new Error('unauthorized');
  return s;
}

export async function requireAdmin() {
  const s = await requireUser();
  if (s.role !== 'admin') throw new Error('forbidden');
  return s;
}

export { supabaseAdmin };
