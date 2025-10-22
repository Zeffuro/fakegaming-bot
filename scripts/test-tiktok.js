// typescript
/**
 * File: `scripts/check-tiktok-exists.ts`
 *
 * Minimal checker: fetches the TikTok profile page and uses simple heuristics:
 * - looks for common "not found" phrases
 * - tries to extract `UserModule.users` from `SIGI_STATE` JSON on the page
 *
 * Usage:
 *   node --loader ts-node/esm scripts/check-tiktok-exists.ts <username> [--cookies="..."]
 */
import process from 'node:process';
import { fileURLToPath } from 'node:url';
/**
 * Check whether a TikTok username exists by fetching the profile page.
 * @param username - TikTok username (without `@`)
 * @param _cookies - optional cookie string to send
 */
export async function checkTikTokExists(username, _cookies) {
    const url = `https://www.tiktok.com/@tsf_silcas?isUniqueId=true&isSecured=true`;
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 15; SM-S931B Build/AP3A.240905.015.A2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36',
                'Accept': 'text/html',
                ...(_cookies ? { 'Cookie': _cookies } : {})
            }
        });
        const status = res.status;
        const text = await res.text();
        console.log(text);
        const notFoundPhrases = [
            "Couldn't find this account",
            "This account isn't available",
            "Page Not Found",
            "The page you requested is not available",
            "Sorry, this page isn't available"
        ];
        const hadNotFound = notFoundPhrases.some(p => text.includes(p));
        // Try to extract a JSON blob for SIGI_STATE / UserModule
        const userModuleMatch = text.match(/"UserModule"\s*:\s*{[\s\S]*?"users"\s*:\s*({[\s\S]*?})\s*,/);
        let hasUserInUserModule = false;
        if (userModuleMatch && userModuleMatch[1]) {
            const usersJson = userModuleMatch[1];
            // crude check: see if there's a key like "username":
            hasUserInUserModule = /"[^"]+"\s*:\s*{/.test(usersJson);
        }
        // Another heuristic: presence of SIGI_STATE indicator or canonical profile link
        const hasSigi = /SIGI_STATE|window\['SIGI_STATE'\]|"UserModule"/i.test(text);
        const hasCanonical = /<link rel="canonical" href="https?:\/\/(www\.)?tiktok.com\/@/i.test(text);
        const exists = (status === 200 && (hasUserInUserModule || (hasSigi && hasCanonical)) && !hadNotFound) || (status >= 300 && status < 400);
        return {
            exists,
            diagnostics: {
                status,
                length: text.length,
                hadNotFound,
                hasSigi,
                hasCanonical,
                foundUserModule: Boolean(userModuleMatch),
                hasUserInUserModule
            }
        };
    }
    catch (err) {
        return {
            exists: false,
            diagnostics: { error: String(err) }
        };
    }
}
async function main() {
    const argv = process.argv.slice(2);
    if (argv.length === 0) {
        console.error('Usage: node scripts/check-tiktok-exists.ts <username> [--cookies="..."]');
        return 2;
    }
    const username = argv[0];
    const cookiesArg = argv.find(a => a.startsWith('--cookies='))?.split('=')[1] ?? process.env.TIKTOK_COOKIE;
    const result = await checkTikTokExists(username, cookiesArg);
    console.log(JSON.stringify({ username, exists: result.exists, diagnostics: result.diagnostics }));
    return 0;
}
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    main().then(code => process.exit(code)).catch(() => process.exit(1));
}
