import {getJwt} from './auth.js';

export async function apiFetch(input: RequestInfo, init?: RequestInit) {
    const token = await getJwt();
    const headers = {
        ...(init?.headers || {}),
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
    };
    return fetch(input, {...init, headers});
}

