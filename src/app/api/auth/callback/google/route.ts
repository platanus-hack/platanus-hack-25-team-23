import { NextResponse } from 'next/server'

// This route handles the OAuth callback redirect
// The actual token handling happens client-side since we use implicit grant
export async function GET(request: Request) {
  // Redirect to a client-side page that will handle the token from the URL fragment
  const url = new URL(request.url)
  return NextResponse.redirect(new URL('/calendar/callback', url.origin))
}
