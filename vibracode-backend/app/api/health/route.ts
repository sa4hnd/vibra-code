import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'v0-clone backend is running',
    timestamp: new Date().toISOString(),
  });
}

