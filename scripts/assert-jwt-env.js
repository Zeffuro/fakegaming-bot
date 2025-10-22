/**
 * Assert required JWT env vars are present. Intended for CI and non-test runs.
 * Exits with code 1 and prints a helpful message if any are missing.
 */
import process from 'node:process';
const required = [
    'JWT_SECRET',
    'JWT_AUDIENCE',
    'JWT_ISSUER',
];
const missing = required.filter((name) => {
    const val = process.env[name];
    return val == null || String(val).trim() === '';
});
if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing required env vars: ${missing.join(', ')}. Set safe test values in CI and local dev. See ENVIRONMENT.md (JWT section).`);
    process.exit(1);
}
// eslint-disable-next-line no-console
console.log('JWT env assertion passed.');
