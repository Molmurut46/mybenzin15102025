import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { account } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Get user by email
    const users = await db.query.user.findMany({
      where: (user, { eq }) => eq(user.email, email)
    });

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0];

    // Hash password using better-auth method
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(newPassword);

    // Update password
    await db
      .update(account)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(account.userId, user.id),
          eq(account.providerId, 'credential')
        )
      );

    return NextResponse.json({
      message: 'Password updated successfully',
      hash: hashedPassword
    });

  } catch (error) {
    console.error('Fix password error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}