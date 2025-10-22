// typescript
                                    import process from 'node:process';
                                    import { fileURLToPath } from 'node:url';

                                    /**
                                     * Check if a status code is a redirect.
                                     */
                                    function isRedirect(status: number): boolean {
                                        return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
                                    }

                                    /**
                                     * Minimal mobile headers to look like a real mobile browser while avoiding full fingerprinting.
                                     */
                                    function mobileHeaders(): Record<string, string> {
                                        return {
                                            'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
                                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                                            'Accept-Language': 'en-US,en;q=0.9',
                                            'Upgrade-Insecure-Requests': '1'
                                        };
                                    }

                                    /**
                                     * Classify a redirect location to determine if it points to a user profile or a not-found page.
                                     */
                                    function classifyLocation(loc: string): 'profile' | 'notfound' | 'other' {
                                        const l = loc.toLowerCase();
                                        if (l.includes('/@')) return 'profile';
                                        if (l.includes('/404') || l.includes('/discover') || l.includes('/search')) return 'notfound';
                                        if (l.includes('verify') || l.includes('challenge')) return 'other';
                                        return 'other';
                                    }

                                    /**
                                     * Perform a single probe to the given URL without following redirects.
                                     */
                                    async function probe(url: string): Promise<{ status: number; location: string | null }> {
                                        const res = await fetch(url, {
                                            method: 'GET',
                                            redirect: 'manual',
                                            headers: mobileHeaders()
                                        });
                                        return { status: res.status, location: res.headers.get('location') };
                                    }

                                    /**
                                     * Verify if a TikTok username exists via mobile redirect (no HTML parsing).
                                     *
                                     * Strategy:
                                     * - Request `https://m.tiktok.com/@<username>` with `redirect: 'manual'`.
                                     * - If 3xx with `Location` pointing to a profile, return true.
                                     * - If 404, return false.
                                     * - If inconclusive, retry with a query variant to trigger canonicalization.
                                     */
                                    export async function tiktokUserExists(username: string): Promise<boolean> {
                                        if (!username || typeof username !== 'string') return false;

                                        const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
                                        try {
                                            const res = await fetch(url, {
                                                headers: {
                                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                                                    'Accept-Language': 'en-US,en;q=0.9'
                                                }
                                            });

                                            if (res.status === 404) return false;

                                            const text = await res.text();

                                            // Detect canonical URL for real profiles
                                            if (text.includes('<link rel="canonical" href="https://www.tiktok.com/@')) {
                                                return true;
                                            }

                                            // Detect noindex for fake/nonexistent profiles
                                            if (text.includes('content="noindex"') || text.includes('404 Not Found')) {
                                                return false;
                                            }

                                            // Inconclusive, but likely not found
                                            return false;
                                        } catch {
                                            return false;
                                        }
                                    }

                                    /**
                                     * Small CLI to test a username.
                                     *
                                     * Usage:
                                     *   npx tsx scripts/test-tiktok.ts <username>
                                     */
                                    export async function main(_argv: string[] = process.argv.slice(2)): Promise<number> {
                                        const username = _argv[0];
                                        if (!username) {
                                            // eslint-disable-next-line no-console
                                            console.error('Usage: npx tsx scripts/test-tiktok.ts <username>');
                                            return 2;
                                        }
                                        try {
                                            const exists = await tiktokUserExists(username);
                                            // eslint-disable-next-line no-console
                                            console.log(JSON.stringify({ username, exists }));
                                            return 0;
                                        } catch (err) {
                                            // eslint-disable-next-line no-console
                                            console.log(JSON.stringify({ username, exists: false, error: String(err) }));
                                            return 1;
                                        }
                                    }

                                    const __filename = fileURLToPath(import.meta.url);
                                    if (process.argv[1] === __filename) {
                                        // eslint-disable-next-line unicorn/prefer-top-level-await
                                        main().then((code: number) => process.exit(code)).catch(() => process.exit(1));
                                    }