import { NextResponse } from 'next/server';

export async function GET() {
  // Basic health check endpoint for container monitoring
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'plnngpkr',
    },
    { status: 200 }
  );
}
