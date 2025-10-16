import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log("=== DEBUG AUTH START ===");
    console.log("Email:", email);
    console.log("Password length:", password?.length);

    // Попытка входа через better-auth API напрямую
    const signInResponse = await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: true,
      },
    });

    console.log("Sign in response:", signInResponse);
    console.log("=== DEBUG AUTH END ===");

    return NextResponse.json({
      success: true,
      data: signInResponse,
    });
  } catch (error: any) {
    console.error("=== DEBUG AUTH ERROR ===");
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error("=== DEBUG AUTH ERROR END ===");

    return NextResponse.json(
      {
        success: false,
        error: {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        },
      },
      { status: 500 }
    );
  }
}