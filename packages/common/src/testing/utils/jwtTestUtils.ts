import jwt from 'jsonwebtoken';

/**
 * Sign a test JWT token for authentication in tests
 * @param payload The payload to include in the JWT
 * @param secret The secret key to sign with (defaults to test secret)
 * @param audience The audience to include in the JWT (defaults to fakegaming-dashboard)
 * @returns Signed JWT token
 */
export function signTestJwt(
    payload: Record<string, any>,
    secret: string = process.env.JWT_SECRET || 'testsecret',
    audience: string = process.env.JWT_AUDIENCE || 'fakegaming-dashboard'
): string {
    return jwt.sign(payload, secret, { algorithm: 'HS256', audience });
}

/**
 * Verify a test JWT token
 * @param token The token to verify
 * @param secret The secret key to verify with
 * @param audience The audience to verify
 * @returns Decoded token payload
 */
export function verifyTestJwt(
    token: string,
    secret: string = process.env.JWT_SECRET || 'testsecret',
    audience: string = process.env.JWT_AUDIENCE || 'fakegaming-dashboard'
): any {
    return jwt.verify(token, secret, { audience });
}

