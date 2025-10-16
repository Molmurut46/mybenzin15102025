export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(profile[0], { status: 200 });
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
    const { 
      carBrand, 
      carModel, 
      engineVolume, 
      transmission, 
      fuelConsumption, 
      fuelConsumption92,
      fuelConsumption95,
      fuelType, 
      defaultDeviationPercent,
      vehicleYear,
      vinNumber,
      licensePlate,
      baseConsumptionMintrans,
      defaultRoadQuality,
      defaultTerrainType
    } = body;

    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Validate defaultRoadQuality if provided
    if (defaultRoadQuality && !['good', 'fair', 'poor'].includes(defaultRoadQuality)) {
      return NextResponse.json({
        error: "defaultRoadQuality must be one of: good, fair, poor",
        code: "INVALID_ROAD_QUALITY"
      }, { status: 400 });
    }

    // Validate defaultTerrainType if provided
    if (defaultTerrainType && !['plain', 'hilly', 'mountain'].includes(defaultTerrainType)) {
      return NextResponse.json({
        error: "defaultTerrainType must be one of: plain, hilly, mountain",
        code: "INVALID_TERRAIN_TYPE"
      }, { status: 400 });
    }

    const existingProfile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);

    if (existingProfile.length > 0) {
      const updated = await db.update(userProfiles)
        .set({
          carBrand: carBrand || existingProfile[0].carBrand,
          carModel: carModel || existingProfile[0].carModel,
          engineVolume: engineVolume !== undefined ? engineVolume : existingProfile[0].engineVolume,
          transmission: transmission || existingProfile[0].transmission,
          fuelConsumption: fuelConsumption !== undefined ? fuelConsumption : existingProfile[0].fuelConsumption,
          fuelConsumption92: fuelConsumption92 !== undefined ? fuelConsumption92 : existingProfile[0].fuelConsumption92,
          fuelConsumption95: fuelConsumption95 !== undefined ? fuelConsumption95 : existingProfile[0].fuelConsumption95,
          fuelType: fuelType || existingProfile[0].fuelType,
          defaultDeviationPercent: defaultDeviationPercent !== undefined ? defaultDeviationPercent : existingProfile[0].defaultDeviationPercent,
          vehicleYear: vehicleYear !== undefined ? vehicleYear : existingProfile[0].vehicleYear,
          vinNumber: vinNumber !== undefined ? vinNumber : existingProfile[0].vinNumber,
          licensePlate: licensePlate !== undefined ? licensePlate : existingProfile[0].licensePlate,
          baseConsumptionMintrans: baseConsumptionMintrans !== undefined ? baseConsumptionMintrans : existingProfile[0].baseConsumptionMintrans,
          defaultRoadQuality: defaultRoadQuality || existingProfile[0].defaultRoadQuality,
          defaultTerrainType: defaultTerrainType || existingProfile[0].defaultTerrainType,
          updatedAt: new Date().toISOString()
        })
        .where(eq(userProfiles.userId, session.user.id))
        .returning();

      return NextResponse.json(updated[0], { status: 200 });
    } else {
      const newProfile = await db.insert(userProfiles)
        .values({
          userId: session.user.id,
          carBrand: carBrand || null,
          carModel: carModel || null,
          engineVolume: engineVolume !== undefined ? engineVolume : null,
          transmission: transmission || null,
          fuelConsumption: fuelConsumption !== undefined ? fuelConsumption : null,
          fuelConsumption92: fuelConsumption92 !== undefined ? fuelConsumption92 : null,
          fuelConsumption95: fuelConsumption95 !== undefined ? fuelConsumption95 : null,
          fuelType: fuelType || null,
          defaultDeviationPercent: defaultDeviationPercent !== undefined ? defaultDeviationPercent : 0,
          vehicleYear: vehicleYear !== undefined ? vehicleYear : null,
          vinNumber: vinNumber !== undefined ? vinNumber : null,
          licensePlate: licensePlate !== undefined ? licensePlate : null,
          baseConsumptionMintrans: baseConsumptionMintrans !== undefined ? baseConsumptionMintrans : null,
          defaultRoadQuality: defaultRoadQuality || 'fair',
          defaultTerrainType: defaultTerrainType || 'plain',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .returning();

      return NextResponse.json(newProfile[0], { status: 201 });
    }
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}