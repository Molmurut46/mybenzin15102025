export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { weeklySchedules } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedules = await db
      .select()
      .from(weeklySchedules)
      .where(eq(weeklySchedules.userId, session.user.id))
      .orderBy(asc(weeklySchedules.dayOfWeek));

    return NextResponse.json(schedules, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json(
        {
          error: 'User ID cannot be provided in request body',
          code: 'USER_ID_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(body)) {
      return NextResponse.json(
        {
          error: 'Request body must be an array of schedules',
          code: 'INVALID_REQUEST_FORMAT',
        },
        { status: 400 }
      );
    }

    for (const schedule of body) {
      if (!schedule.dayOfWeek || typeof schedule.dayOfWeek !== 'number') {
        return NextResponse.json(
          {
            error: 'dayOfWeek is required and must be a number',
            code: 'INVALID_DAY_OF_WEEK',
          },
          { status: 400 }
        );
      }

      if (schedule.dayOfWeek < 1 || schedule.dayOfWeek > 7) {
        return NextResponse.json(
          {
            error: 'dayOfWeek must be between 1 and 7',
            code: 'INVALID_DAY_OF_WEEK_RANGE',
          },
          { status: 400 }
        );
      }

      if (schedule.drivingMode && !['city', 'highway', 'mixed'].includes(schedule.drivingMode)) {
        return NextResponse.json(
          {
            error: 'drivingMode must be one of: city, highway, mixed',
            code: 'INVALID_DRIVING_MODE',
          },
          { status: 400 }
        );
      }

      if (schedule.roadQuality && !['good', 'fair', 'poor'].includes(schedule.roadQuality)) {
        return NextResponse.json(
          {
            error: 'roadQuality must be one of: good, fair, poor',
            code: 'INVALID_ROAD_QUALITY',
          },
          { status: 400 }
        );
      }

      if (schedule.terrainType && !['plain', 'hilly', 'mountain'].includes(schedule.terrainType)) {
        return NextResponse.json(
          {
            error: 'terrainType must be one of: plain, hilly, mountain',
            code: 'INVALID_TERRAIN_TYPE',
          },
          { status: 400 }
        );
      }
    }

    await db
      .delete(weeklySchedules)
      .where(eq(weeklySchedules.userId, session.user.id));

    const timestamp = new Date().toISOString();
    const schedulesToInsert = body.map((schedule) => ({
      userId: session.user.id,
      dayOfWeek: schedule.dayOfWeek,
      clients: schedule.clients || null,
      dailyMileage: schedule.dailyMileage || null,
      drivingMode: schedule.drivingMode || 'city',
      roadQuality: schedule.roadQuality || 'fair',
      terrainType: schedule.terrainType || 'plain',
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    const createdSchedules = await db
      .insert(weeklySchedules)
      .values(schedulesToInsert)
      .returning();

    return NextResponse.json(createdSchedules, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}