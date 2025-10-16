import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
 
export async function middleware(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: request.headers
	})
 
	if(!session) {
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}
 
	return NextResponse.next();
}
 
export const config = {
  runtime: "edge",
  matcher: ["/dashboard", "/profile", "/reports", "/wizard", "/reports/:path*"], // Apply middleware to specific routes
};