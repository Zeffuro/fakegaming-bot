import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type AnimeSearchMediaType, type AnimeSearchResult, type AnimeSubscriptionDashboardConfig } from "@/lib/api-client";
import { canSubscribe, errorMessage, formatAnimeTitle, formatStatus } from "@/components/anime/animeUtils";
import { ANIME_SEASON_PAGE_SIZE, type AnimeSeasonOption, type AnimeSeasonScope } from "@/components/anime/animeTheme";

export interface UseAnimeDashboardResult {
  serverSubs: AnimeSubscriptionDashboardConfig[];
  personalSubs: AnimeSubscriptionDashboardConfig[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchMediaType: AnimeSearchMediaType;
  setSearchMediaType: (value: AnimeSearchMediaType) => void;
  searchResults: AnimeSearchResult[];
  selectedAnime: AnimeSearchResult | null;
  setSelectedAnime: (value: AnimeSearchResult | null) => void;
  searchLoading: boolean;
  channelId: string;
  setChannelId: (value: string) => void;
  reminderMinutes: number;
  setReminderMinutes: (value: number) => void;
  season: AnimeSeasonOption;
  setSeason: (value: AnimeSeasonOption) => void;
  seasonScope: AnimeSeasonScope;
  setSeasonScope: (value: AnimeSeasonScope) => void;
  seasonYear: number;
  setSeasonYear: (value: number) => void;
  seasonPage: number;
  setSeasonPage: (updater: number | ((page: number) => number)) => void;
  seasonResults: AnimeSearchResult[];
  seasonLabel: string;
  seasonHasNext: boolean;
  seasonLoading: boolean;
  fetchSubscriptions: () => Promise<void>;
  addSubscription: (anime?: AnimeSearchResult) => Promise<void>;
  togglePausedSubscription: (config: AnimeSubscriptionDashboardConfig) => Promise<void>;
  setServerSubscriptionsPaused: (paused: boolean) => Promise<void>;
  setPersonalSubscriptionsPaused: (paused: boolean) => Promise<void>;
  deleteSubscription: (config: AnimeSubscriptionDashboardConfig) => Promise<void>;
}

interface UseAnimeDashboardOptions {
  enabled?: boolean;
}

export function useAnimeDashboard(guildId: string, options: UseAnimeDashboardOptions = {}): UseAnimeDashboardResult {
  const enabled = options.enabled ?? true;
  const [serverSubs, setServerSubs] = useState<AnimeSubscriptionDashboardConfig[]>([]);
  const [personalSubs, setPersonalSubs] = useState<AnimeSubscriptionDashboardConfig[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInputState] = useState("");
  const [searchMediaType, setSearchMediaTypeState] = useState<AnimeSearchMediaType>("anime");
  const [searchResults, setSearchResults] = useState<AnimeSearchResult[]>([]);
  const [selectedAnime, setSelectedAnimeState] = useState<AnimeSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState(30);

  const [season, setSeasonState] = useState<AnimeSeasonOption>("current");
  const [seasonScope, setSeasonScopeState] = useState<AnimeSeasonScope>("airing");
  const [seasonYear, setSeasonYearState] = useState(new Date().getFullYear());
  const [seasonPage, setSeasonPageState] = useState(1);
  const [seasonResults, setSeasonResults] = useState<AnimeSearchResult[]>([]);
  const [seasonLabel, setSeasonLabel] = useState("Current season");
  const [seasonHasNext, setSeasonHasNext] = useState(false);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    if (!guildId || !enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [server, personal] = await Promise.all([
        api.getAnimeSubscriptions(guildId),
        api.getMyAnimeSubscriptions(),
      ]);
      setServerSubs(server.map((config) => ({ ...config, discordChannelId: config.channelId ?? config.discordChannelId })));
      setPersonalSubs(personal);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load anime subscriptions"));
    } finally {
      setLoading(false);
    }
  }, [enabled, guildId]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void fetchSubscriptions();
  }, [enabled, fetchSubscriptions]);

  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
    setSelectedAnimeState((current) => current && formatAnimeTitle(current) !== value ? null : current);
  }, []);

  const setSelectedAnime = useCallback((value: AnimeSearchResult | null) => {
    setSelectedAnimeState(value);
    setSearchInputState(value ? formatAnimeTitle(value) : "");
  }, []);

  const setSearchMediaType = useCallback((value: AnimeSearchMediaType) => {
    setSearchMediaTypeState(value);
    setSelectedAnimeState(null);
    setSearchResults([]);
  }, []);

  useEffect(() => {
    const query = searchInput.trim();
    if (query.length < 2 || (selectedAnime && formatAnimeTitle(selectedAnime) === query)) {
      if (query.length < 2) setSearchResults([]);
      return;
    }

    const handle = window.setTimeout(() => {
      setSearchLoading(true);
      api.searchAnime(query, 1, 10, searchMediaType)
        .then((data) => setSearchResults(data.results))
        .catch((err: unknown) => setError(errorMessage(err, searchMediaType === "manga" ? "Manga search failed" : "Anime search failed")))
        .finally(() => setSearchLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [searchInput, searchMediaType, selectedAnime]);

  const setSeason = useCallback((value: AnimeSeasonOption) => {
    setSeasonState(value);
    setSeasonPageState(1);
  }, []);

  const setSeasonScope = useCallback((value: AnimeSeasonScope) => {
    setSeasonScopeState(value);
    setSeasonPageState(1);
  }, []);

  const setSeasonYear = useCallback((value: number) => {
    setSeasonYearState(value);
    setSeasonPageState(1);
  }, []);

  const setSeasonPage = useCallback((updater: number | ((page: number) => number)) => {
    setSeasonPageState((current) => typeof updater === "function" ? updater(current) : updater);
  }, []);

  const loadSeason = useCallback(async () => {
    try {
      setSeasonLoading(true);
      const data = await api.getAnimeSeason(
        season,
        season === "current" || season === "next" ? undefined : seasonYear,
        seasonPage,
        ANIME_SEASON_PAGE_SIZE,
        seasonScope,
      );
      setSeasonResults(data.results);
      setSeasonLabel(`${data.season} ${data.year} - ${data.scopeLabel}`);
      setSeasonHasNext(Boolean(data.pageInfo?.hasNextPage));
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load anime season"));
    } finally {
      setSeasonLoading(false);
    }
  }, [season, seasonScope, seasonYear, seasonPage]);

  useEffect(() => {
    void loadSeason();
  }, [loadSeason]);

  const addSubscription = useCallback(async (anime?: AnimeSearchResult) => {
    const target = anime ?? selectedAnime;
    const numericId = Number(searchInput.trim());
    if (!target && (!Number.isInteger(numericId) || numericId <= 0)) {
      setError("Pick an anime from search or enter an AniList ID.");
      return;
    }
    if (!channelId) {
      setError("Choose a Discord channel for server notifications first.");
      return;
    }
    if (searchMediaType === "manga" && !target) {
      setError("Manga lookup is search-only; episode reminders are anime-only.");
      return;
    }
    if (target && !canSubscribe(target)) {
      const reason = target.type === "MANGA" ? "manga entries do not have AniList airing schedules" : `it is ${formatStatus(target.status).toLowerCase()} and episode reminders would never fire`;
      setError(`${formatAnimeTitle(target)} is lookup-only because ${reason}.`);
      return;
    }

    try {
      setSaving(true);
      await api.createAnimeSubscription({
        ...(target ? { anilistId: target.id } : { anilistId: numericId }),
        guildId,
        channelId,
        reminderMinutes,
      });
      setSelectedAnime(null);
      setSearchResults([]);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save anime subscription"));
    } finally {
      setSaving(false);
    }
  }, [channelId, fetchSubscriptions, guildId, reminderMinutes, searchInput, searchMediaType, selectedAnime, setSelectedAnime]);

  const deleteSubscription = useCallback(async (config: AnimeSubscriptionDashboardConfig) => {
    if (!config.id) return;
    try {
      setSaving(true);
      await api.deleteAnimeSubscription(config.id);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to delete anime subscription"));
    } finally {
      setSaving(false);
    }
  }, [fetchSubscriptions]);

  const togglePausedSubscription = useCallback(async (config: AnimeSubscriptionDashboardConfig) => {
    if (!config.id) return;
    try {
      setSaving(true);
      await api.setAnimeSubscriptionPaused(config.id, !config.paused);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to update anime subscription status"));
    } finally {
      setSaving(false);
    }
  }, [fetchSubscriptions]);

  const setSubscriptionsPaused = useCallback(async (
    subscriptions: AnimeSubscriptionDashboardConfig[],
    paused: boolean,
    failureMessage: string,
  ) => {
    const targets = subscriptions.filter((config) => config.id && Boolean(config.paused) !== paused);
    if (targets.length === 0) return;

    try {
      setSaving(true);
      await Promise.all(targets.map((config) => api.setAnimeSubscriptionPaused(config.id!, paused)));
      await fetchSubscriptions();
    } catch (err: unknown) {
      setError(errorMessage(err, failureMessage));
    } finally {
      setSaving(false);
    }
  }, [fetchSubscriptions]);

  const setServerSubscriptionsPaused = useCallback(async (paused: boolean) => {
    await setSubscriptionsPaused(serverSubs, paused, "Failed to update server anime subscriptions");
  }, [serverSubs, setSubscriptionsPaused]);

  const setPersonalSubscriptionsPaused = useCallback(async (paused: boolean) => {
    await setSubscriptionsPaused(personalSubs, paused, "Failed to update personal anime subscriptions");
  }, [personalSubs, setSubscriptionsPaused]);

  return useMemo(() => ({
    serverSubs,
    personalSubs,
    loading,
    saving,
    error,
    setError,
    searchInput,
    setSearchInput,
    searchMediaType,
    setSearchMediaType,
    searchResults,
    selectedAnime,
    setSelectedAnime,
    searchLoading,
    channelId,
    setChannelId,
    reminderMinutes,
    setReminderMinutes,
    season,
    setSeason,
    seasonScope,
    setSeasonScope,
    seasonYear,
    setSeasonYear,
    seasonPage,
    setSeasonPage,
    seasonResults,
    seasonLabel,
    seasonHasNext,
    seasonLoading,
    fetchSubscriptions,
    addSubscription,
    togglePausedSubscription,
    setServerSubscriptionsPaused,
    setPersonalSubscriptionsPaused,
    deleteSubscription,
  }), [
    serverSubs,
    personalSubs,
    loading,
    saving,
    error,
    searchInput,
    setSearchInput,
    searchMediaType,
    setSearchMediaType,
    searchResults,
    selectedAnime,
    setSelectedAnime,
    searchLoading,
    channelId,
    reminderMinutes,
    season,
    setSeason,
    seasonScope,
    setSeasonScope,
    seasonYear,
    setSeasonYear,
    seasonPage,
    setSeasonPage,
    seasonResults,
    seasonLabel,
    seasonHasNext,
    seasonLoading,
    fetchSubscriptions,
    addSubscription,
    togglePausedSubscription,
    setServerSubscriptionsPaused,
    setPersonalSubscriptionsPaused,
    deleteSubscription,
  ]);
}
