export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('SMTP credentials not configured');
      // Don't fail registration if email can't be sent
      return NextResponse.json(
        { success: true, warning: 'Email service not configured' },
        { status: 200 }
      );
    }

    await sendWelcomeEmail(email, name);

    return NextResponse.json(
      { success: true, message: 'Welcome email sent' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Welcome email error:', error);
    // Don't fail the request even if email fails
    return NextResponse.json(
      { success: true, warning: 'Email could not be sent' },
      { status: 200 }
    );
  }
}