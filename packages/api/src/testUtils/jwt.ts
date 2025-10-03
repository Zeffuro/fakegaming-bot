import jwt from 'jsonwebtoken';

export function signTestJwt(payload: object = {}): string {
    const secret = process.env.JWT_SECRET || 'testsecret';
    const audience = process.env.JWT_AUDIENCE || 'fakegaming-dashboard';
    // Default payload can be extended as needed
    return jwt.sign(payload, secret, {algorithm: 'HS256', expiresIn: '1h', audience});
}
