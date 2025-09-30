import { NextRequest, NextResponse } from 'next/server';

// Helper to extract JWT from request (customize as needed)
function getJwt(req: NextRequest): string | undefined {
  // Example: from Authorization header
  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) return auth;
  // Example: from cookies
  const jwt = req.cookies.get('jwt')?.value;
  return jwt ? `Bearer ${jwt}` : undefined;
}

export async function handler(req: NextRequest, { params }: { params: { proxy: string[] } }) {
  const { proxy } = params;
  const apiPath = '/' + proxy.join('/');
  const method = req.method;
  const jwt = getJwt(req);

  // Build bot API URL (preserve query string)
  const baseUrl = process.env.BOT_API_URL;
  const search = req.nextUrl.search || '';
  const url = `${baseUrl}${apiPath}${search}`;

  // Prepare fetch options
  const headers: Record<string, string> = {
    'Content-Type': req.headers.get('content-type') || 'application/json',
  };
  if (jwt) headers['Authorization'] = jwt;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };
  if (method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = await req.text();
  }

  // Forward request to bot API
  const res = await fetch(url, fetchOptions);
  const contentType = res.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return NextResponse.json(data, { status: res.status });
}

export { handler as GET, handler as POST, handler as DELETE, handler as PUT, handler as PATCH };

