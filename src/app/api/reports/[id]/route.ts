import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fuelReports } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const report = await db
      .select()
      .from(fuelReports)
      .where(
        and(
          eq(fuelReports.id, parseInt(id)),
          eq(fuelReports.userId, session.user.id)
        )
      )
      .limit(1);

    if (report.length === 0) {
      return NextResponse.json(
        { error: 'Report not found', code: 'REPORT_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(report[0], { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
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

    const existingReport = await db
      .select()
      .from(fuelReports)
      .where(
        and(
          eq(fuelReports.id, parseInt(id)),
          eq(fuelReports.userId, session.user.id)
        )
      )
      .limit(1);

    if (existingReport.length === 0) {
      return NextResponse.json(
        { error: 'Report not found', code: 'REPORT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const updates: {
      month?: number;
      year?: number;
      reportData?: unknown;
      updatedAt: string;
    } = {
      updatedAt: new Date().toISOString(),
    };

    if (body.month !== undefined) {
      const month = parseInt(body.month);
      if (isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json(
          {
            error: 'Month must be between 1 and 12',
            code: 'INVALID_MONTH',
          },
          { status: 400 }
        );
      }
      updates.month = month;
    }

    if (body.year !== undefined) {
      const year = parseInt(body.year);
      if (isNaN(year) || year < 1900 || year > 2100) {
        return NextResponse.json(
          { error: 'Invalid year', code: 'INVALID_YEAR' },
          { status: 400 }
        );
      }
      updates.year = year;
    }

    if (body.reportData !== undefined) {
      updates.reportData = body.reportData;
    }

    const updated = await db
      .update(fuelReports)
      .set(updates)
      .where(
        and(
          eq(fuelReports.id, parseInt(id)),
          eq(fuelReports.userId, session.user.id)
        )
      )
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'Report not found', code: 'REPORT_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const existingReport = await db
      .select()
      .from(fuelReports)
      .where(
        and(
          eq(fuelReports.id, parseInt(id)),
          eq(fuelReports.userId, session.user.id)
        )
      )
      .limit(1);

    if (existingReport.length === 0) {
      return NextResponse.json(
        { error: 'Report not found', code: 'REPORT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const deleted = await db
      .delete(fuelReports)
      .where(
        and(
          eq(fuelReports.id, parseInt(id)),
          eq(fuelReports.userId, session.user.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Report not found', code: 'REPORT_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Report deleted successfully',
        deletedReport: deleted[0],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}