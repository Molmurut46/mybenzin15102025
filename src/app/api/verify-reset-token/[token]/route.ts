export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server";
import { db } from '@/db';
import { user, passwordResetTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token parameter exists
    if (!token) {
      return NextResponse.json(
        { 
          error: 'Token parameter is required',
          code: 'MISSING_TOKEN' 
        },
        { status: 400 }
      );
    }

    // Find the token in the database
    const tokenRecord = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    if (tokenRecord.length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN' 
        },
        { status: 404 }
      );
    }

    const resetToken = tokenRecord[0];

    // Check if token has expired
    const currentTime = new Date();
    const expiresAt = new Date(resetToken.expiresAt);

    if (currentTime > expiresAt) {
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

    // Fetch user details
    const userRecord = await db
      .select({
        id: user.id,
        email: user.email
      })
      .from(user)
      .where(eq(user.id, resetToken.userId))
      .limit(1);

    if (userRecord.length === 0) {
      return NextResponse.json(
        { 
          error: 'User not found',
          code: 'USER_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    // Return valid token response
    return NextResponse.json({
      valid: true,
      email: userRecord[0].email,
      userId: userRecord[0].id
    });

  } catch (error) {
    console.error('GET password reset token verification error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error 
      },
      { status: 500 }
    );
  }
}