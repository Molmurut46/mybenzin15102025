export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { passwordResetTokens, account } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    // Validate required fields
    if (!token || !newPassword) {
      return NextResponse.json(
        { 
          error: 'Token and new password are required',
          code: 'MISSING_REQUIRED_FIELDS'
        },
        { status: 400 }
      );
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          error: 'Password must be at least 8 characters long',
          code: 'WEAK_PASSWORD'
        },
        { status: 400 }
      );
    }

    // Find the reset token
    const resetTokenRecord = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    if (resetTokenRecord.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        },
        { status: 404 }
      );
    }

    const resetToken = resetTokenRecord[0];

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetToken.expiresAt);

    if (now > expiresAt) {
      // Delete expired token
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, resetToken.id));

      return NextResponse.json(
        {
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        },
        { status: 404 }
      );
    }

    // Hash the new password using better-auth's password hasher
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(newPassword);

    // Update password in account table
    const updatedAccount = await db
      .update(account)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(account.userId, resetToken.userId),
          eq(account.providerId, 'credential')
        )
      )
      .returning();

    if (updatedAccount.length === 0) {
      console.error('No credential account found for user:', resetToken.userId);
      return NextResponse.json(
        {
          error: 'Unable to reset password. No credential account found.',
          code: 'ACCOUNT_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Delete the used token
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, resetToken.id));

    return NextResponse.json(
      {
        message: 'Password has been reset successfully'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error: ' + error
      },
      { status: 500 }
    );
  }
}