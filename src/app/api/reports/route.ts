import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fuelReports } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reports = await db.select()
      .from(fuelReports)
      .where(eq(fuelReports.userId, session.user.id))
      .orderBy(desc(fuelReports.year), desc(fuelReports.month));

    return NextResponse.json(reports, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
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
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    const { month, year, reportData } = body;

    if (!month) {
      return NextResponse.json({ 
        error: "Month is required",
        code: "MISSING_MONTH" 
      }, { status: 400 });
    }

    if (!year) {
      return NextResponse.json({ 
        error: "Year is required",
        code: "MISSING_YEAR" 
      }, { status: 400 });
    }

    if (!reportData) {
      return NextResponse.json({ 
        error: "Report data is required",
        code: "MISSING_REPORT_DATA" 
      }, { status: 400 });
    }

    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json({ 
        error: "Month must be between 1 and 12",
        code: "INVALID_MONTH" 
      }, { status: 400 });
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return NextResponse.json({ 
        error: "Year must be a valid number",
        code: "INVALID_YEAR" 
      }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    const newReport = await db.insert(fuelReports)
      .values({
        userId: session.user.id,
        month: monthNum,
        year: yearNum,
        reportData: reportData,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .returning();

    return NextResponse.json(newReport[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();

    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    const existingReport = await db.select()
      .from(fuelReports)
      .where(and(
        eq(fuelReports.id, parseInt(id)),
        eq(fuelReports.userId, session.user.id)
      ))
      .limit(1);

    if (existingReport.length === 0) {
      return NextResponse.json({ 
        error: 'Report not found' 
      }, { status: 404 });
    }

    const updates: any = {
      updatedAt: new Date().toISOString()
    };

    if (body.month !== undefined) {
      const monthNum = parseInt(body.month);
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return NextResponse.json({ 
          error: "Month must be between 1 and 12",
          code: "INVALID_MONTH" 
        }, { status: 400 });
      }
      updates.month = monthNum;
    }

    if (body.year !== undefined) {
      const yearNum = parseInt(body.year);
      if (isNaN(yearNum)) {
        return NextResponse.json({ 
          error: "Year must be a valid number",
          code: "INVALID_YEAR" 
        }, { status: 400 });
      }
      updates.year = yearNum;
    }

    if (body.reportData !== undefined) {
      updates.reportData = body.reportData;
    }

    const updated = await db.update(fuelReports)
      .set(updates)
      .where(and(
        eq(fuelReports.id, parseInt(id)),
        eq(fuelReports.userId, session.user.id)
      ))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ 
        error: 'Report not found' 
      }, { status: 404 });
    }

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const existingReport = await db.select()
      .from(fuelReports)
      .where(and(
        eq(fuelReports.id, parseInt(id)),
        eq(fuelReports.userId, session.user.id)
      ))
      .limit(1);

    if (existingReport.length === 0) {
      return NextResponse.json({ 
        error: 'Report not found' 
      }, { status: 404 });
    }

    const deleted = await db.delete(fuelReports)
      .where(and(
        eq(fuelReports.id, parseInt(id)),
        eq(fuelReports.userId, session.user.id)
      ))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ 
        error: 'Report not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Report deleted successfully',
      deletedReport: deleted[0]
    }, { status: 200 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}