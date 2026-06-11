// Centralized API client that leverages typed endpoints
import type {
  ApiJsonResponse,
  ApiSchema,
} from "@zeffuro/fakegaming-common/api-helpers";
import type { BirthdayConfig, PatchSubscriptionConfig } from "@zeffuro/fakegaming-common";
import { CSRF_HEADER_NAME } from "@zeffuro/fakegaming-common/security";

type TwitchListResponse = ApiJsonResponse<'/twitch', 'get', 200>;
type TwitchCreateRequest = ApiSchema<'TwitchCreateRequest'>;
type TwitchCreateResponse = ApiJsonResponse<'/twitch', 'post', 200 | 201>;
type TikTokListResponse = ApiJsonResponse<'/tiktok', 'get', 200>;
type TikTokCreateRequest = ApiSchema<'TikTokCreateRequest'>;
type TikTokCreateResponse = ApiJsonResponse<'/tiktok', 'post', 200 | 201>;
type TikTokDeleteResponse = ApiJsonResponse<'/tiktok/{id}', 'delete', 200>;
type BlueskyListResponse = ApiJsonResponse<'/bluesky', 'get', 200>;
export type BlueskyCreateRequest = ApiSchema<'BlueskyCreateRequest'>;
type BlueskyCreateResponse = ApiJsonResponse<'/bluesky', 'post', 200 | 201>;
type BlueskyDeleteResponse = ApiJsonResponse<'/bluesky/{id}', 'delete', 200>;
export type BlueskyProfileResponse = ApiJsonResponse<'/bluesky/profile', 'get', 200>;
type YouTubeListResponse = ApiJsonResponse<'/youtube', 'get', 200>;
type YouTubeCreateRequest = ApiSchema<'YoutubeCreateRequest'>;
type YouTubeCreateResponse = ApiJsonResponse<'/youtube', 'post', 201>;
type SupportedGamesResponse = ApiJsonResponse<'/patchNotes/supportedGames', 'get', 200>;
type PatchNoteResponse = ApiJsonResponse<'/patchNotes/{game}', 'get', 200>;
type PatchSubscriptionCreateRequest = ApiSchema<'PatchSubscriptionRequest'>;
type PatchSubscriptionUpsertRequest = ApiSchema<'PatchSubscriptionRequest'>;
type GuildMemberSearchResponse = ApiJsonResponse<'/discord/guilds/{guildId}/members/search', 'get', 200>;
type DisabledModulesResponse = ApiJsonResponse<'/disabledModules', 'get', 200>;
type DisabledModuleCreateRequest = ApiSchema<'DisabledModuleCreateRequest'>;
type DisabledModuleCreateResponse = ApiJsonResponse<'/disabledModules', 'post', 201>;
type DisabledModuleDeleteResponse = ApiJsonResponse<'/disabledModules/{id}', 'delete', 200>;
type DisabledCommandsResponse = ApiJsonResponse<'/disabledCommands', 'get', 200>;
type DisabledCommandCreateRequest = ApiSchema<'DisabledCommandCreateRequest'>;
type DisabledCommandCreateResponse = ApiJsonResponse<'/disabledCommands', 'post', 201>;
type DisabledCommandDeleteResponse = ApiJsonResponse<'/disabledCommands/{id}', 'delete', 200>;
type QuoteResponse = ApiSchema<'QuoteConfig'>;
type QuoteCreateRequest = ApiSchema<'QuoteCreateRequest'>;

// Define endpoint paths centrally
export const API_ENDPOINTS = {
  // Twitch endpoints
  TWITCH: '/api/external/twitch',

  // TikTok endpoints
  TIKTOK: '/api/external/tiktok',

  // Bluesky endpoints
  BLUESKY: '/api/external/bluesky',

  // YouTube endpoints
  YOUTUBE: '/api/external/youtube',

  // Patch Notes and Subscriptions endpoints
  PATCH_NOTES: '/api/external/patchNotes',
  PATCH_SUBSCRIPTIONS: '/api/external/patchSubscriptions',

  // Anime
  ANIME: '/api/external/anime',

  // Quotes
  QUOTES: '/api/external/quotes',

  // Birthdays
  BIRTHDAYS: '/api/external/birthdays',

  // Discord helpers
  DISCORD: '/api/external/discord',

  // Disabled features
  DISABLED_MODULES: '/api/external/disabledModules',
  DISABLED_COMMANDS: '/api/external/disabledCommands',

  // Jobs (proxied to API /jobs)
  JOBS: '/api/external/jobs',
};

// Type for API options
interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

function isMutating(method: string): boolean {
  const m = method.toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

async function tryRefreshOnce(): Promise<boolean> {
  try {
    const csrf = getCookie('csrf');
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { [CSRF_HEADER_NAME]: csrf } : undefined,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function redirectToLogin(): void {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname + window.location.search;
    const returnTo = path || '/dashboard';
    window.location.href = `/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
  }
}

// Base API request function
async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    credentials = 'include',
  } = options;

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Inject CSRF header on mutating requests for proxy validation
  if (isMutating(method) && !(CSRF_HEADER_NAME in mergedHeaders)) {
    const csrf = getCookie('csrf');
    if (csrf) {
      mergedHeaders[CSRF_HEADER_NAME] = csrf;
    }
  }

  const requestOptions: RequestInit = {
    method,
    credentials,
    headers: mergedHeaders,
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  let response = await fetch(endpoint, requestOptions);

  // Handle 401 Unauthorized: attempt a single refresh-then-retry
  if (!response.ok && response.status === 401) {
    const refreshed = await tryRefreshOnce();
    if (refreshed) {
      response = await fetch(endpoint, requestOptions);
    }
    if (!response.ok) {
      // Still unauthorized or refresh failed — redirect to login (browser)
      redirectToLogin();
    }
  }

  if (!response.ok) {
    const errorData: unknown = await response.json().catch(() => null);
    const apiError = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? (errorData as { error?: unknown }).error
      : undefined;
    const apiErrorMessage = typeof apiError === 'object' && apiError !== null && 'message' in apiError
      ? (apiError as { message?: unknown }).message
      : undefined;
    const fallbackMessage = typeof errorData === 'object' && errorData !== null && 'message' in errorData
      ? (errorData as { message?: unknown }).message
      : undefined;
    throw new Error(
      (typeof apiError === 'string' ? apiError : undefined) ||
      (typeof apiErrorMessage === 'string' ? apiErrorMessage : undefined) ||
      (typeof fallbackMessage === 'string' ? fallbackMessage : undefined) ||
      `API request failed with status: ${response.status}`
    );
  }

  return await response.json();
}

// Overloaded helpers for endpoints where generated request types may be too strict
export function createDisabledModuleRequest(data: DisabledModuleCreateRequest): Promise<DisabledModuleCreateResponse>;
export function createDisabledModuleRequest(data: { guildId: string; moduleName: string }): Promise<DisabledModuleCreateResponse>;
export async function createDisabledModuleRequest(data: DisabledModuleCreateRequest | { guildId: string; moduleName: string }): Promise<DisabledModuleCreateResponse> {
  return apiRequest<DisabledModuleCreateResponse>(API_ENDPOINTS.DISABLED_MODULES, { method: 'POST', body: data });
}

// Types local to this client for endpoints not in generated types
export interface ResolveUsersResponse {
  users: Array<{ id: string; username?: string; global_name?: string | null; discriminator?: string | null; avatar?: string | null; nickname?: string | null }>;
  missed: string[];
}

export interface JobsListResponse { jobs: Array<{ name: string; supportsDate: boolean; supportsForce: boolean }>; }
export interface LastHeartbeatResponse { last: { startedAt: string; backend: string; receivedAt: string } | null }
export interface JobRunEntry { startedAt: string; finishedAt: string; ok: boolean; meta?: Record<string, unknown>; error?: string }
export interface BirthdayPayload {
  userId: string;
  guildId?: string | null;
  channelId: string;
  day: number;
  month: number;
  year?: number;
}
export type BirthdayUpdatePayload = Omit<BirthdayPayload, 'userId' | 'guildId'>;
export interface AnimeSubscriptionDashboardConfig {
  id?: number;
  anilistId: number;
  animeTitle: string;
  discordChannelId: string;
  channelId?: string;
  guildId: string;
  targetType?: 'dm' | 'channel';
  userId?: string | null;
  reminderMinutes: number;
  status?: string | null;
  format?: string | null;
  episodes?: number | null;
  averageScore?: number | null;
  nextEpisode?: number | null;
  nextAiringAt?: number | null;
  customMessage?: string;
}

export interface AnimePageInfo {
  total?: number | null;
  currentPage?: number | null;
  lastPage?: number | null;
  hasNextPage?: boolean | null;
  perPage?: number | null;
}

export interface AnimeSearchResult {
  id: number;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  description?: string | null;
  siteUrl?: string | null;
  coverImage?: { large?: string | null; color?: string | null } | null;
  bannerImage?: string | null;
  format?: string | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  episodes?: number | null;
  duration?: number | null;
  averageScore?: number | null;
  genres?: string[] | null;
  nextAiringEpisode?: { airingAt: number; episode: number; timeUntilAiring?: number | null } | null;
}

// Typed API methods using OpenAPI path helpers.
export const api = {
  // Twitch APIs
  getTwitchConfigs: () =>
    apiRequest<TwitchListResponse>(API_ENDPOINTS.TWITCH),

  createTwitchStream: (data: TwitchCreateRequest) =>
    apiRequest<TwitchCreateResponse>(
      API_ENDPOINTS.TWITCH,
      { method: 'POST', body: data }
    ),

  deleteTwitchStream: (id: string) =>
    apiRequest<{ success: boolean }>(
      `${API_ENDPOINTS.TWITCH}/${id}`,
      { method: 'DELETE' }
    ),

  // TikTok APIs (parity with Twitch; types generated from OpenAPI after build)
  getTikTokConfigs: () =>
    apiRequest<TikTokListResponse>(API_ENDPOINTS.TIKTOK),

  // Check live status of a username (admin/debug)
  getTikTokLive: (username: string, debug: boolean = false) =>
    apiRequest<{ live: boolean; roomId: string | null; title: string | null; startedAt: number | null; viewers: number | null; cover: string | null; debugMeta?: { method: 'fetchIsLive' | 'getRoomInfo' | 'connect' | 'unknown'; raw?: unknown } }>(
      `${API_ENDPOINTS.TIKTOK}/live?username=${encodeURIComponent(username)}${debug ? `&debug=1` : ''}`
    ),

  createTikTokStream: (data: TikTokCreateRequest) =>
    apiRequest<TikTokCreateResponse>(
      API_ENDPOINTS.TIKTOK,
      { method: 'POST', body: data }
    ),

  deleteTikTokStream: (id: string | number) =>
    apiRequest<TikTokDeleteResponse>(
      `${API_ENDPOINTS.TIKTOK}/${id}`,
      { method: 'DELETE' }
    ),

  // Bluesky APIs
  getBlueskyConfigs: () =>
    apiRequest<BlueskyListResponse>(API_ENDPOINTS.BLUESKY),

  getBlueskyProfile: (handle: string) =>
    apiRequest<BlueskyProfileResponse>(
      `${API_ENDPOINTS.BLUESKY}/profile?handle=${encodeURIComponent(handle)}`
    ),

  createBlueskyAccount: (data: BlueskyCreateRequest) =>
    apiRequest<BlueskyCreateResponse>(
      API_ENDPOINTS.BLUESKY,
      { method: 'POST', body: data }
    ),

  deleteBlueskyAccount: (id: string | number) =>
    apiRequest<BlueskyDeleteResponse>(
      `${API_ENDPOINTS.BLUESKY}/${id}`,
      { method: 'DELETE' }
    ),

  // Verify Twitch username
  verifyTwitchUsername: (username: string) =>
    apiRequest<{ exists: boolean; id?: string; login?: string; displayName?: string }>(
      `${API_ENDPOINTS.TWITCH}/verify?username=${encodeURIComponent(username)}`
    ),

  // Resolve YouTube identifier to channelId
  resolveYouTubeIdentifier: (identifier: string) =>
    apiRequest<{ channelId: string | null }>(
      `${API_ENDPOINTS.YOUTUBE}/resolve?identifier=${encodeURIComponent(identifier)}`
    ),

  getYouTubeChannelMetadata: (channelId: string) =>
    apiRequest<{ channelId: string; title: string | null; url: string | null; latestVideoId: string | null }>(
      `${API_ENDPOINTS.YOUTUBE}/metadata?channelId=${encodeURIComponent(channelId)}`
    ),

  // YouTube APIs
  getYouTubeConfigs: () =>
    apiRequest<YouTubeListResponse>(API_ENDPOINTS.YOUTUBE),

  createYouTubeChannel: (data: YouTubeCreateRequest) =>
    apiRequest<YouTubeCreateResponse>(
      API_ENDPOINTS.YOUTUBE,
      { method: 'POST', body: data }
    ),

  deleteYouTubeChannel: (id: string) =>
    apiRequest<{ success: boolean }>(
      `${API_ENDPOINTS.YOUTUBE}/${id}`,
      { method: 'DELETE' }
    ),

  // Patch Notes APIs
  getSupportedGames: () =>
    apiRequest<SupportedGamesResponse>(`${API_ENDPOINTS.PATCH_NOTES}/supportedGames`),

  getLatestPatchNote: (game: string) =>
    apiRequest<PatchNoteResponse>(`${API_ENDPOINTS.PATCH_NOTES}/${encodeURIComponent(game)}`),

  // Patch Subscriptions APIs
  getPatchSubscriptions: () =>
    apiRequest<PatchSubscriptionConfig[]>(API_ENDPOINTS.PATCH_SUBSCRIPTIONS),

  createPatchSubscription: (data: PatchSubscriptionCreateRequest) =>
    apiRequest<{ success: boolean }>(
      API_ENDPOINTS.PATCH_SUBSCRIPTIONS,
      { method: 'POST', body: data }
    ),

  upsertPatchSubscription: (data: PatchSubscriptionUpsertRequest) =>
    apiRequest<{ success: boolean }>(
      API_ENDPOINTS.PATCH_SUBSCRIPTIONS,
      { method: 'PUT', body: data }
    ),

  deletePatchSubscription: (id: string | number) =>
    apiRequest<{ success: boolean }>(
      `${API_ENDPOINTS.PATCH_SUBSCRIPTIONS}/${id}`,
      { method: 'DELETE' }
    ),

  // Anime APIs
  getAnimeSubscriptions: (guildId: string) =>
    apiRequest<AnimeSubscriptionDashboardConfig[]>(`${API_ENDPOINTS.ANIME}?guildId=${encodeURIComponent(guildId)}`),

  getMyAnimeSubscriptions: () =>
    apiRequest<AnimeSubscriptionDashboardConfig[]>(API_ENDPOINTS.ANIME),

  searchAnime: (query: string, page: number = 1, perPage: number = 10) =>
    apiRequest<{ results: AnimeSearchResult[]; pageInfo: AnimePageInfo }>(
      `${API_ENDPOINTS.ANIME}/search?q=${encodeURIComponent(query)}&page=${encodeURIComponent(String(page))}&perPage=${encodeURIComponent(String(perPage))}`
    ),

  getAnimeSeason: (season: string, year?: number, page: number = 1, perPage: number = 10, scope: string = 'airing') =>
    apiRequest<{ season: string; year: number; scope: string; scopeLabel: string; results: AnimeSearchResult[]; pageInfo: AnimePageInfo }>(
      `${API_ENDPOINTS.ANIME}/season?season=${encodeURIComponent(season)}&scope=${encodeURIComponent(scope)}${year ? `&year=${encodeURIComponent(String(year))}` : ''}&page=${encodeURIComponent(String(page))}&perPage=${encodeURIComponent(String(perPage))}`
    ),

  createAnimeSubscription: (data: { anilistId?: number; title?: string; guildId: string; channelId: string; reminderMinutes?: number }) =>
    apiRequest<{ success: boolean; created: boolean; anilistId: number }>(
      API_ENDPOINTS.ANIME,
      { method: 'POST', body: data }
    ),

  deleteAnimeSubscription: (id: string | number) =>
    apiRequest<{ success: boolean }>(
      `${API_ENDPOINTS.ANIME}/${id}`,
      { method: 'DELETE' }
    ),

  // Quotes APIs
  getQuotesByGuild: (guildId: string) =>
    apiRequest<QuoteResponse[]>(`${API_ENDPOINTS.QUOTES}/guild/${encodeURIComponent(guildId)}`),

  searchQuotes: (guildId: string, text: string) =>
    apiRequest<QuoteResponse[]>(`${API_ENDPOINTS.QUOTES}/search?guildId=${encodeURIComponent(guildId)}&text=${encodeURIComponent(text)}`),

  createQuote: (data: QuoteCreateRequest) =>
    apiRequest<QuoteResponse>(API_ENDPOINTS.QUOTES, { method: 'POST', body: data }),

  deleteQuote: (id: string) =>
    apiRequest<{ success: boolean }>(`${API_ENDPOINTS.QUOTES}/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Birthdays APIs
  getBirthdays: (guildId: string) =>
    apiRequest<BirthdayConfig[]>(`${API_ENDPOINTS.BIRTHDAYS}?guildId=${encodeURIComponent(guildId)}`),

  createBirthday: (data: BirthdayPayload) =>
    apiRequest<{ success: boolean }>(API_ENDPOINTS.BIRTHDAYS, { method: 'POST', body: data }),

  updateBirthday: (userId: string, guildId: string, data: BirthdayUpdatePayload) =>
    apiRequest<BirthdayConfig>(
      `${API_ENDPOINTS.BIRTHDAYS}/${encodeURIComponent(userId)}/${encodeURIComponent(guildId)}`,
      { method: 'PUT', body: data }
    ),

  deleteBirthday: (userId: string, guildId: string) =>
    apiRequest<{ success: boolean }>(
      `${API_ENDPOINTS.BIRTHDAYS}/${encodeURIComponent(userId)}/${encodeURIComponent(guildId)}`,
      { method: 'DELETE' }
    ),

  // Discord resolve API
  resolveUsers: (guildId: string, ids: string[]) =>
    apiRequest<ResolveUsersResponse>(`${API_ENDPOINTS.DISCORD}/users/resolve`, { method: 'POST', body: { guildId, ids } }),

  // Discord member search (autocomplete)
  searchGuildMembers: (guildId: string, query: string, limit: number = 25) =>
    apiRequest<GuildMemberSearchResponse>(
      `${API_ENDPOINTS.DISCORD}/guilds/${encodeURIComponent(guildId)}/members/search?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`
    ),

  // Disabled Modules APIs
  getDisabledModules: (guildId: string) =>
    apiRequest<DisabledModulesResponse>(`${API_ENDPOINTS.DISABLED_MODULES}?guildId=${encodeURIComponent(guildId)}`),

  createDisabledModule: createDisabledModuleRequest,

  deleteDisabledModule: (id: string | number) =>
    apiRequest<DisabledModuleDeleteResponse>(`${API_ENDPOINTS.DISABLED_MODULES}/${id}`, { method: 'DELETE' }),

  // Disabled Commands APIs
  getDisabledCommands: (guildId: string) =>
    apiRequest<DisabledCommandsResponse>(`${API_ENDPOINTS.DISABLED_COMMANDS}?guildId=${encodeURIComponent(guildId)}`),

  createDisabledCommand: (data: DisabledCommandCreateRequest) =>
    apiRequest<DisabledCommandCreateResponse>(API_ENDPOINTS.DISABLED_COMMANDS, { method: 'POST', body: data }),

  deleteDisabledCommand: (id: string | number) =>
    apiRequest<DisabledCommandDeleteResponse>(`${API_ENDPOINTS.DISABLED_COMMANDS}/${id}`, { method: 'DELETE' }),

  // Jobs API
  triggerJob: (name: string, date?: string, force?: boolean) =>
    apiRequest<{ ok: boolean; jobId: string | number }>(
      `${API_ENDPOINTS.JOBS}/${encodeURIComponent(name)}/run`,
      { method: 'POST', body: { ...(date ? { date } : {}), ...(typeof force === 'boolean' ? { force } : {}) } }
    ),

  getJobs: () => apiRequest<JobsListResponse>(`${API_ENDPOINTS.JOBS}`),
  getLastHeartbeat: () => apiRequest<LastHeartbeatResponse>(`${API_ENDPOINTS.JOBS}/heartbeat/last`),
  getJobStatus: (name: string) => apiRequest<{ runs: JobRunEntry[] }>(`${API_ENDPOINTS.JOBS}/${encodeURIComponent(name)}/status`),
  getBirthdaysProcessedToday: () => apiRequest<{ processed: number }>(`${API_ENDPOINTS.JOBS}/birthdays/today`),
};
