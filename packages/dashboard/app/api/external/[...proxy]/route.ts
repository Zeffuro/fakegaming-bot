import { NextRequest, NextResponse } from 'next/server';

function getJwt(req: NextRequest): string | undefined {
  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) return auth;
  const jwt = req.cookies.get('jwt')?.value;
  return jwt ? `Bearer ${jwt}` : undefined;
}

async function proxyHandler(req: NextRequest, { params }: { params: { proxy: string[] } }) {
  const { proxy } = params;
  const apiPath = '/' + proxy.join('/');
  const method = req.method;
  const jwt = getJwt(req);
  const baseUrl = process.env.BOT_API_URL;
  const search = req.nextUrl.search || '';
  const url = `${baseUrl}${apiPath}${search}`;
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

export async function GET(req: NextRequest, context: { params: { proxy: string[] } }) {
  return proxyHandler(req, context);
}
export async function POST(req: NextRequest, context: { params: { proxy: string[] } }) {
  return proxyHandler(req, context);
}
export async function DELETE(req: NextRequest, context: { params: { proxy: string[] } }) {
  return proxyHandler(req, context);
}
export async function PUT(req: NextRequest, context: { params: { proxy: string[] } }) {
  return proxyHandler(req, context);
}
export async function PATCH(req: NextRequest, context: { params: { proxy: string[] } }) {
  return proxyHandler(req, context);
}
