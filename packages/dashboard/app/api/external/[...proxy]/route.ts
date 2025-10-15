import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from "@/lib/env";
import { enforceCsrf } from "@/lib/security/csrf.js";

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

    // CSRF enforcement for unsafe methods (double-submit token)
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
        const csrfFailure = enforceCsrf(req);
        if (csrfFailure) return csrfFailure;
    }

    const jwt = getJwt(req);

    if (!jwt) {
        console.warn(`[ProxyHandler] Request to ${apiPath} is UNAUTHENTICATED. No JWT found in header or cookie.`);
    } else {
        console.log(`[ProxyHandler] Extracted JWT for ${apiPath}: ${jwt.substring(0, 20)}...`);
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
    };

    if (jwt) {
        headers['Authorization'] = jwt;
    }

    console.log(`[ProxyHandler] Proxying ${method} ${apiPath} to ${url}`);

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

        if (!response.ok) {
            const status = response.status;
            let responseBody;

            try {
                responseBody = await response.json();
                console.error(`[ProxyHandler] Error ${status} from API: ${JSON.stringify(responseBody)}`);
            } catch {
                responseBody = await response.text();
                console.error(`[ProxyHandler] Error ${status} from API: ${responseBody}`);
            }

            if (status === 403) {
                console.error(`[ProxyHandler] 403 Forbidden Details:`);
                console.error(`  - JWT Present: ${jwt ? 'Yes' : 'No'}`);
                console.error(`  - Request Path: ${apiPath}`);
                console.error(`  - Request Method: ${method}`);
                if (options.body) {
                    console.error(`  - Request Body: ${options.body}`);
                }
                console.error(`  - Response Body: ${JSON.stringify(responseBody)}`);
            }

            return NextResponse.json(responseBody, { status });
        }

        console.log(`[ProxyHandler] Successful response from ${apiPath} with status ${response.status}`);
        console.log(`[ProxyHandler] Response Headers: ${JSON.stringify([...response.headers])}`);

        const responseClone = response.clone();

        const responseText = await responseClone.text();
        console.log(`[ProxyHandler] Response Body: ${responseText}`);

        const contentType = response.headers.get('Content-Type') || 'application/json';
        return new NextResponse(await response.text(), {
            status: response.status,
            headers: {
                'Content-Type': contentType,
            },
        });
    } catch (error) {
        console.error(`[ProxyHandler] Exception during proxy: ${error}`);
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
