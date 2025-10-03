import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Create response that redirects to home
  const response = NextResponse.redirect(new URL("/", req.url));

  // Clear JWT cookie
  response.cookies.set({
    name: "jwt",
    value: "",
    path: "/",
    expires: new Date(0),
    sameSite: "lax",
  });

  return response;
}
