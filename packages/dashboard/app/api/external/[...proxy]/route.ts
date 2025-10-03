import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from "@/lib/env";

// Update the context type to expect Promise<params>
type RouteContext = {
    params: Promise<{
        proxy: string[];
    }>;
};

// Helper to extract JWT (retains functionality)
const getJwt = (req: NextRequest): string | undefined => {
    const auth = req.headers.get('authorization');
    if (auth && auth.startsWith('Bearer ')) return auth;

    const jwt = req.cookies.get('jwt')?.value;
    return jwt ? `Bearer ${jwt}` : undefined;
};

// The core handler function - now async params
const proxyHandler = async (req: NextRequest, context: RouteContext) => {
    const { proxy } = await context.params; // Await the params
    const apiPath = '/' + proxy.join('/');
    const method = req.method;
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
        // Copy the request and send it to the API
        const options: RequestInit = {
            method,
            headers,
        };

        // Include the body for methods that support it
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            const contentType = req.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                options.body = JSON.stringify(await req.json());
            } else {
                options.body = await req.text();
            }
        }

        const response = await fetch(url, options);

        // Enhanced error logging
        if (!response.ok) {
            const status = response.status;
            let responseBody;

            try {
                // Try to parse as JSON first
                responseBody = await response.json();
                console.error(`[ProxyHandler] Error ${status} from API: ${JSON.stringify(responseBody)}`);
            } catch {
                // If not JSON, get as text
                responseBody = await response.text();
                console.error(`[ProxyHandler] Error ${status} from API: ${responseBody}`);
            }

            // For 403 errors, add extra debugging info
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

            // Forward the error response but with our detailed logs
            return NextResponse.json(responseBody, { status });
        }

        // For successful responses
        console.log(`[ProxyHandler] Successful response from ${apiPath} with status ${response.status}`);
        console.log(`[ProxyHandler] Response Headers: ${JSON.stringify([...response.headers])}`);

        // Clone the response to read it twice (once for logging, once for returning)
        const responseClone = response.clone();

        // Read the response body for logging
        const responseText = await responseClone.text();
        console.log(`[ProxyHandler] Response Body: ${responseText}`);

        // Return the original response (which hasn't been consumed yet)
        const contentType = response.headers.get('Content-Type') || 'application/json';
        return new NextResponse(await response.text(), {
            status: response.status,
            headers: {
                'Content-Type': contentType,
            },
        });
    } catch (error) {
        // Log and return any fetch errors
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
