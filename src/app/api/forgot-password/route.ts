import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { user, passwordResetTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate email is provided
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          error: 'Email is required',
          code: 'MISSING_EMAIL',
        },
        { status: 400 }
      );
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('SMTP credentials not configured');
      return NextResponse.json(
        {
          error: 'Email service not configured',
          code: 'SMTP_NOT_CONFIGURED',
        },
        { status: 500 }
      );
    }

    // Normalize email to lowercase
    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1);

    // If user found, create password reset token
    if (existingUser.length > 0) {
      const userId = existingUser[0].id;
      const userName = existingUser[0].name;

      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiration to 1 hour from now
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Delete any existing tokens for this user
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, userId));

      // Insert new token
      await db.insert(passwordResetTokens).values({
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
      });

      // Send password reset email
      try {
        console.log('Attempting to send password reset email to:', normalizedEmail);
        await sendPasswordResetEmail(normalizedEmail, token, userName);
        console.log('Password reset email sent successfully to:', normalizedEmail);
      } catch (emailError: any) {
        console.error('Detailed email error:', {
          message: emailError?.message,
          code: emailError?.code,
          response: emailError?.response,
          responseCode: emailError?.responseCode,
          command: emailError?.command,
        });
        return NextResponse.json(
          {
            error: 'Failed to send email: ' + (emailError?.message || 'Unknown error'),
            code: 'EMAIL_SEND_FAILED',
            details: emailError?.code || emailError?.responseCode,
          },
          { status: 500 }
        );
      }
    } else {
      console.log('User not found with email:', normalizedEmail);
    }

    // Always return success message (security best practice - don't reveal if email exists)
    return NextResponse.json(
      {
        message:
          'If an account exists with this email, a password reset link will be sent',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}