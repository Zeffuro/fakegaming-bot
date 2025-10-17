declare module 'axios' {
    const axios: {
        get: (url: string) => Promise<{ data: unknown }>
    };
    export default axios;
}

declare module 'cheerio' {
    export function load(html: string): any;
}

