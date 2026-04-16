import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
export async function POST() {
  cookies().delete('sunho_session');
  return NextResponse.json({ ok: true });
}
