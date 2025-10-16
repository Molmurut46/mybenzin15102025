import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { user, account } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPassword } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({
        error: 'Email is required and must be a string',
        code: 'INVALID_EMAIL'
      }, { status: 400 });
    }

    // Validate newPassword
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({
        error: 'New password is required and must be a string',
        code: 'INVALID_PASSWORD'
      }, { status: 400 });
    }

    // Validate password length
    if (newPassword.length < 8) {
      return NextResponse.json({
        error: 'Password must be at least 8 characters long',
        code: 'PASSWORD_TOO_SHORT'
      }, { status: 400 });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    console.log('Admin password fix: Looking up user with email:', normalizedEmail);

    // Find user by email
    const existingUser = await db.select()
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1);

    if (existingUser.length === 0) {
      console.log('Admin password fix: User not found');
      return NextResponse.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    const foundUser = existingUser[0];
    console.log('Admin password fix: User found:', foundUser.id);

    // Generate bcrypt hash with exactly 10 rounds
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('Admin password fix: Password hashed successfully');

    // Update password in account table where userId matches AND providerId = 'credential'
    const updatedAccount = await db.update(account)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(account.userId, foundUser.id),
          eq(account.providerId, 'credential')
        )
      )
      .returning();

    if (updatedAccount.length === 0) {
      console.log('Admin password fix: No credential account found for user');
      return NextResponse.json({
        error: 'No credential account found for this user',
        code: 'NO_CREDENTIAL_ACCOUNT'
      }, { status: 404 });
    }

    console.log('Admin password fix: Password updated successfully for user:', foundUser.id);

    return NextResponse.json({
      message: 'Password updated successfully',
      email: foundUser.email,
      userId: foundUser.id
    }, { status: 200 });

  } catch (error) {
    console.error('Admin password fix error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}