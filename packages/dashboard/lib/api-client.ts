// Centralized API client that leverages typed endpoints
import type {
  twitch_get_Response200,
  twitch_post_Request,
  twitch_post_Response201,
  youtube_get_Response200,
  youtube_post_Request,
  patchNotes_game_get_Response200,
  patchNotes_supportedGames_get_Response200,
  patchSubscriptions_post_Request,
  patchSubscriptions_put_Request,
  discord_guilds_guildId_members_search_get_Response200
} from "@/types/apiResponses";
import type { PatchSubscriptionConfig } from "@zeffuro/fakegaming-common";
import { CSRF_HEADER_NAME } from "@zeffuro/fakegaming-common/security";

// Define endpoint paths centrally
export const API_ENDPOINTS = {
  // Twitch endpoints
  TWITCH: '/api/external/twitch',

  // YouTube endpoints
  YOUTUBE: '/api/external/youtube',

  // Patch Notes and Subscriptions endpoints
  PATCH_NOTES: '/api/external/patchNotes',
  PATCH_SUBSCRIPTIONS: '/api/external/patchSubscriptions',

  // Quotes
  QUOTES: '/api/external/quotes',

  // Discord helpers
  DISCORD: '/api/external/discord'
};

// Type for API options
interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
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

  const response = await fetch(endpoint, requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error ||
      errorData?.message ||
      `API request failed with status: ${response.status}`
    );
  }

  return await response.json();
}

// Types local to this client for endpoints not in generated types
export interface ResolveUsersResponse {
  users: Array<{ id: string; username?: string; global_name?: string | null; discriminator?: string | null; avatar?: string | null; nickname?: string | null }>;
  missed: string[];
}

// Typed API methods using apiResponses.ts types
export const api = {
  // Twitch APIs
  getTwitchConfigs: () =>
    apiRequest<twitch_get_Response200>(API_ENDPOINTS.TWITCH),

  createTwitchStream: (data: twitch_post_Request) =>
    apiRequest<twitch_post_Response201>(
      API_ENDPOINTS.TWITCH,
      { method: 'POST', body: data }
    ),

  deleteTwitchStream: (id: string) =>
    apiRequest<{ success: boolean }>(
      `${API_ENDPOINTS.TWITCH}/${id}`,
      { method: 'DELETE' }
    ),

  // YouTube APIs
  getYouTubeConfigs: () =>
    apiRequest<youtube_get_Response200>(API_ENDPOINTS.YOUTUBE),

  createYouTubeChannel: (data: youtube_post_Request) =>
    apiRequest<{ success: boolean }>(
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
    apiRequest<patchNotes_supportedGames_get_Response200>(`${API_ENDPOINTS.PATCH_NOTES}/supportedGames`),

  getLatestPatchNote: (game: string) =>
    apiRequest<patchNotes_game_get_Response200>(`${API_ENDPOINTS.PATCH_NOTES}/${encodeURIComponent(game)}`),

  // Patch Subscriptions APIs
  getPatchSubscriptions: () =>
    apiRequest<PatchSubscriptionConfig[]>(API_ENDPOINTS.PATCH_SUBSCRIPTIONS),

  createPatchSubscription: (data: patchSubscriptions_post_Request) =>
    apiRequest<{ success: boolean }>(
      API_ENDPOINTS.PATCH_SUBSCRIPTIONS,
      { method: 'POST', body: data }
    ),

  upsertPatchSubscription: (data: patchSubscriptions_put_Request) =>
    apiRequest<{ success: boolean }>(
      API_ENDPOINTS.PATCH_SUBSCRIPTIONS,
      { method: 'PUT', body: data }
    ),

  deletePatchSubscription: (id: string | number) =>
    apiRequest<{ success: boolean }>(
      `${API_ENDPOINTS.PATCH_SUBSCRIPTIONS}/${id}`,
      { method: 'DELETE' }
    ),

  // Quotes APIs
  getQuotesByGuild: (guildId: string) =>
    apiRequest<any[]>(`${API_ENDPOINTS.QUOTES}/guild/${encodeURIComponent(guildId)}`),

  searchQuotes: (guildId: string, text: string) =>
    apiRequest<any[]>(`${API_ENDPOINTS.QUOTES}/search?guildId=${encodeURIComponent(guildId)}&text=${encodeURIComponent(text)}`),

  createQuote: (data: any) =>
    apiRequest<any>(API_ENDPOINTS.QUOTES, { method: 'POST', body: data }),

  deleteQuote: (id: string) =>
    apiRequest<{ success: boolean }>(`${API_ENDPOINTS.QUOTES}/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Discord resolve API
  resolveUsers: (guildId: string, ids: string[]) =>
    apiRequest<ResolveUsersResponse>(`${API_ENDPOINTS.DISCORD}/users/resolve`, { method: 'POST', body: { guildId, ids } }),

  // Discord member search (autocomplete)
  searchGuildMembers: (guildId: string, query: string, limit: number = 25) =>
    apiRequest<discord_guilds_guildId_members_search_get_Response200>(
      `${API_ENDPOINTS.DISCORD}/guilds/${encodeURIComponent(guildId)}/members/search?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`
    )
};
