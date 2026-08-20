type AccountRegionGroup = 'americas' | 'asia' | 'europe' | 'sea';

interface RiotAccountValidationInput {
    gameName: string;
    tagLine: string;
    region: string;
    puuid?: string | null;
}

interface RiotAccountValidationSuccess {
    ok: true;
    puuid: string;
}

interface RiotAccountValidationFailure {
    ok: false;
    statusCode: number;
    code: string;
    message: string;
}

export type RiotAccountValidationResult = RiotAccountValidationSuccess | RiotAccountValidationFailure;

interface RiotAccountResponse {
    puuid?: unknown;
}

interface RiotErrorResponse {
    status?: {
        status_code?: number;
        message?: string;
    };
}

const ACCOUNT_REGION_GROUP_BY_PLATFORM: Record<string, AccountRegionGroup> = {
    br1: 'americas',
    la1: 'americas',
    la2: 'americas',
    na1: 'americas',
    oc1: 'americas',
    pbe1: 'americas',
    eun1: 'europe',
    euw1: 'europe',
    me1: 'europe',
    ru: 'europe',
    tr1: 'europe',
    jp1: 'asia',
    kr: 'asia',
    ph2: 'sea',
    sg2: 'sea',
    th2: 'sea',
    tw2: 'sea',
    vn2: 'sea',
    americas: 'americas',
    asia: 'asia',
    europe: 'europe',
    sea: 'sea',
};

function getRiotAccountApiKey(): string | null {
    const key = process.env.RIOT_ACCOUNT_API_KEY
        || process.env.RIOT_LEAGUE_API_KEY
        || process.env.RIOT_TFT_API_KEY
        || process.env.RIOT_DEV_API_KEY;
    return key?.trim() || null;
}

export function riotAccountRegionGroup(region: string): AccountRegionGroup | null {
    return ACCOUNT_REGION_GROUP_BY_PLATFORM[region.trim().toLowerCase()] ?? null;
}

function failure(statusCode: number, code: string, message: string): RiotAccountValidationFailure {
    return { ok: false, statusCode, code, message };
}

async function readRiotErrorMessage(response: Response): Promise<string | null> {
    try {
        const data = await response.json() as RiotErrorResponse;
        return data.status?.message ?? null;
    } catch {
        return null;
    }
}

export async function validateRiotAccountLink(
    input: RiotAccountValidationInput,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): Promise<RiotAccountValidationResult> {
    const gameName = input.gameName.trim();
    const tagLine = input.tagLine.trim();
    if (!gameName || !tagLine) {
        return failure(400, 'BAD_REQUEST', apiText(locale, 'riotIdRequired'));
    }

    const regionGroup = riotAccountRegionGroup(input.region);
    if (!regionGroup) {
        return failure(400, 'BAD_REQUEST', apiText(locale, 'riotRegionUnsupported', { region: input.region }));
    }

    const apiKey = getRiotAccountApiKey();
    if (!apiKey) {
        return failure(503, 'RIOT_VALIDATION_UNAVAILABLE', apiText(locale, 'riotApiKeyMissing'));
    }

    const url = `https://${regionGroup}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                'X-Riot-Token': apiKey,
                'User-Agent': 'fakegaming-bot-api/1.0',
            },
        });
    } catch {
        return failure(502, 'RIOT_VALIDATION_FAILED', apiText(locale, 'riotValidationRequestFailed'));
    }

    if (!response.ok) {
        const riotMessage = await readRiotErrorMessage(response);
        if (response.status === 404) {
            return failure(400, 'RIOT_ACCOUNT_NOT_FOUND', apiText(locale, 'riotAccountNotFound'));
        }
        return failure(502, 'RIOT_VALIDATION_FAILED', riotMessage ?? apiText(locale, 'riotValidationFailed'));
    }

    const data = await response.json() as RiotAccountResponse;
    const validatedPuuid = typeof data.puuid === 'string' ? data.puuid.trim() : '';
    if (!validatedPuuid) {
        return failure(502, 'RIOT_VALIDATION_FAILED', apiText(locale, 'riotInvalidPayload'));
    }

    const expectedPuuid = input.puuid?.trim();
    if (expectedPuuid && expectedPuuid !== validatedPuuid) {
        return failure(400, 'RIOT_PUUID_MISMATCH', apiText(locale, 'riotPuuidMismatch'));
    }

    return { ok: true, puuid: validatedPuuid };
}
import { DEFAULT_OUTPUT_LOCALE, type SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { apiText } from '../localization/locale.js';
