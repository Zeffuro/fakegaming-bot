export const ACCESS_TOKEN_COOKIE_NAME = "jwt" as const;
export const REFRESH_SESSION_COOKIE_NAME = "refresh_session" as const;

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 20 * 60;
export const REFRESH_SESSION_IDLE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
export const REFRESH_SESSION_ABSOLUTE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

