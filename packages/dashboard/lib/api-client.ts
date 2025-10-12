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
  patchSubscriptions_put_Request
} from "@/types/apiResponses";
import type { PatchSubscriptionConfig } from "@zeffuro/fakegaming-common";

// Define endpoint paths centrally
export const API_ENDPOINTS = {
  // Twitch endpoints
  TWITCH: '/api/external/twitch',

  // YouTube endpoints
  YOUTUBE: '/api/external/youtube',

  // Patch Notes and Subscriptions endpoints
  PATCH_NOTES: '/api/external/patchNotes',
  PATCH_SUBSCRIPTIONS: '/api/external/patchSubscriptions',

  // Other endpoints can be added here as needed
};

// Type for API options
interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

// Base API request function
async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    credentials = 'include',
  } = options;

  const requestOptions: RequestInit = {
    method,
    credentials,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
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
};
