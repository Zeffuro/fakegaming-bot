declare module 'axios' {
    export interface AxiosRequestConfig {
        responseType?: string;
    }

    export interface AxiosResponse<T = unknown> {
        data: T;
    }

    const axios: {
        get: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
    };
    export default axios;
}

declare module 'cheerio' {
    export function load(html: string): any;
}

