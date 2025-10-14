import jwt from 'jsonwebtoken';

/**
 * Shape of a test JWT payload. Extendable and strictly typed.
 */
export interface TestJwtPayload extends jwt.JwtPayload {
    [key: string]: unknown;
}

/**
 * Sign a test JWT token for authentication in tests
 * @param payload The payload to include in the JWT
 * @param secret The secret key to sign with (defaults to test secret)
 * @param audience The audience to include in the JWT (defaults to fakegaming-dashboard)
 * @param issuer The issuer to include in the JWT (defaults to fakegaming)
 * @returns Signed JWT token
 */
export function signTestJwt(
    payload: Record<string, unknown>,
    secret: string = process.env.JWT_SECRET || 'testsecret',
    audience: string = process.env.JWT_AUDIENCE || 'fakegaming-dashboard',
    issuer: string = process.env.JWT_ISSUER || 'fakegaming'
): string {
    return jwt.sign(payload, secret, { algorithm: 'HS256', audience, issuer, expiresIn: '1h' });
}

/**
 * Verify a test JWT token
 * @param token The token to verify
 * @param secret The secret key to verify with
 * @param audience The audience to verify
 * @param issuer The expected issuer
 * @returns Decoded token payload
 */
export function verifyTestJwt(
    token: string,
    secret: string = process.env.JWT_SECRET || 'testsecret',
    audience: string = process.env.JWT_AUDIENCE || 'fakegaming-dashboard',
    issuer: string = process.env.JWT_ISSUER || 'fakegaming'
): TestJwtPayload {
    const decoded = jwt.verify(token, secret, { audience, issuer, algorithms: ['HS256'] });
    // jsonwebtoken types allow string payloads; our tests always sign objects.
    if (typeof decoded === 'string') {
        return { value: decoded } as unknown as TestJwtPayload;
    }
    return decoded as TestJwtPayload;
}
