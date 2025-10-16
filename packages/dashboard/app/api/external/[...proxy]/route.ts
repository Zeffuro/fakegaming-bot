export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from "@/lib/env";
import { enforceCsrf } from "@/lib/security/csrf.js";
import { CSRF_HEADER_NAME, CSRF_COOKIE_NAME } from "@zeffuro/fakegaming-common/security";
import { createSimpleLogger } from "@/lib/simpleColorLogger";

const log = createSimpleLogger('dashboard:proxy');

type RouteContext = {
    params: Promise<{
        proxy: string[];
    }>;
};

const getJwt = (req: NextRequest): string | undefined => {
    const auth = req.headers.get('authorization');
    if (auth && auth.startsWith('Bearer ')) return auth;

    const jwt = req.cookies.get('jwt')?.value;
    return jwt ? `Bearer ${jwt}` : undefined;
};

const proxyHandler = async (req: NextRequest, context: RouteContext) => {
    const { proxy } = await context.params;
    const apiPath = '/' + proxy.join('/');
    const method = req.method;

    // Attach a request id for correlation and forward it to the API
    const incomingReqId = req.headers.get('x-request-id');
    const reqId = (incomingReqId && incomingReqId.trim().length > 0)
        ? incomingReqId
        : `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const started = Date.now();

    // CSRF enforcement for unsafe methods (double-submit token)
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
        const csrfFailure = enforceCsrf(req);
        if (csrfFailure) return csrfFailure;
    }

    const jwt = getJwt(req);

    if (!jwt) {
        log.warn({ apiPath, reqId }, 'Request is unauthenticated (no JWT)');
    } else {
        log.debug({ apiPath, reqId, jwtPreview: jwt.substring(0, 20) + '…' }, 'Extracted JWT');
    }

    if (!API_URL) {
        return new NextResponse(
            JSON.stringify({ error: 'API_URL environment variable not set' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const search = req.nextUrl.search || '';
    const url = `${API_URL}${apiPath}${search}`;

    const headers: Record<string, string> = {
        'Content-Type': req.headers.get('content-type') || 'application/json',
        'x-request-id': reqId,
    };

    if (jwt) {
        headers['Authorization'] = jwt;
    }

    // Forward CSRF header and cookie to API after local validation succeeded
    const csrfToken = req.cookies.get(CSRF_COOKIE_NAME)?.value || req.headers.get(CSRF_HEADER_NAME) || '';
    if (csrfToken) {
        headers[CSRF_HEADER_NAME] = csrfToken;
        // Ensure API receives the csrf cookie even though fetch does not forward browser cookies by default
        headers['Cookie'] = `${CSRF_COOKIE_NAME}=${csrfToken}`;
    }

    log.info({ method, apiPath, url, reqId }, 'Proxying request');

    try {
        const options: RequestInit = {
            method,
            headers,
        };

        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            const contentType = req.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                options.body = JSON.stringify(await req.json());
            } else {
                options.body = await req.text();
            }
        }

        const response = await fetch(url, options);
        const ms = Date.now() - started;

        if (!response.ok) {
            const status = response.status;
            let responseBody: unknown;

            try {
                responseBody = await response.json();
            } catch {
                responseBody = await response.text();
            }

            if (status === 403) {
                log.warn({ status, apiPath, method, ms, reqId, responseBody }, 'API returned 403 Forbidden');
            } else {
                log.warn({ status, apiPath, method, ms, reqId, responseBody }, 'API responded with error');
            }

            return NextResponse.json(responseBody as any, { status });
        }

        log.debug({ apiPath, status: response.status, ms, reqId }, 'Proxy response OK');

        const responseClone = response.clone();
        const responseText = await responseClone.text();
        log.trace({ apiPath, responseText, reqId }, 'Proxy response body');

        const contentType = response.headers.get('Content-Type') || 'application/json';
        return new NextResponse(await response.text(), {
            status: response.status,
            headers: {
                'Content-Type': contentType,
            },
        });
    } catch (error) {
        const ms = Date.now() - started;
        log.error({ apiPath, error, ms, reqId }, 'Proxy exception');
        return new NextResponse(
            JSON.stringify({ error: 'Error connecting to API server' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const DELETE = proxyHandler;
export const PATCH = proxyHandler;
