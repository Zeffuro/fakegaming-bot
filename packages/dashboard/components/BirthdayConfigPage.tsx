"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Cake, CalendarMonth, Close, Delete, Edit, Refresh, Save } from "@mui/icons-material";
import type { BirthdayConfig } from "@zeffuro/fakegaming-common";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeatureNav } from "@/components/dashboard/FeatureNav";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, dashboardCardSx, dashboardFieldSx, dangerActionButtonSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useBirthdays, type BirthdayFormData, type ResolvedUser } from "@/components/hooks/useBirthdays";
import { useGuildChannels } from "@/components/hooks/useGuildChannels";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { api } from "@/lib/api-client";

type MemberItem = {
  id: string;
  username?: string;
  global_name?: string | null;
  discriminator?: string | null;
  avatar?: string | null;
  nick?: string | null;
};

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const emptyForm = {
  userId: "",
  channelId: "",
  day: "",
  month: "",
  year: "",
};

function getDisplayName(user?: ResolvedUser | MemberItem): string {
  if (!user) return "Unknown";
  if ("nickname" in user && user.nickname) return user.nickname;
  if ("nick" in user && user.nick) return user.nick;
  return user.global_name || user.username || user.id;
}

function buildAvatarUrl(userId: string, avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(avatar)}.png`;
}

function formatBirthday(month: number, day: number, year?: number): string {
  const monthName = months.find(item => item.value === month)?.label ?? String(month);
  return year ? `${monthName} ${day}, ${year}` : `${monthName} ${day}`;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function getNextBirthdayDate(month: number, day: number, now = new Date()): Date {
  const makeDate = (year: number) => {
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      return new Date(year, 1, 28, 12, 0, 0, 0);
    }
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let next = makeDate(now.getFullYear());
  if (next.getTime() < todayStart) {
    next = makeDate(now.getFullYear() + 1);
  }
  return next;
}

function getDaysAway(date: Date, now = new Date()): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((targetStart - todayStart) / dayMs));
}

function formatDaysAway(daysAway: number): string {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

function toUpcomingBirthday(birthday: BirthdayConfig, now: Date) {
  const nextDate = getNextBirthdayDate(birthday.month, birthday.day, now);
  return {
    birthday,
    nextDate,
    daysAway: getDaysAway(nextDate, now),
  };
}

function toPayload(form: typeof emptyForm): BirthdayFormData | null {
  const day = Number(form.day);
  const month = Number(form.month);
  const year = form.year ? Number(form.year) : undefined;
  if (!form.userId.trim() || !form.channelId.trim() || !Number.isInteger(day) || !Number.isInteger(month)) return null;
  if (year !== undefined && !Number.isInteger(year)) return null;
  return {
    userId: form.userId.trim(),
    channelId: form.channelId.trim(),
    day,
    month,
    ...(year ? { year } : {}),
  };
}

export default function BirthdayConfigPage() {
  const { guildId, guild, guildsLoading } = useGuildFromParams();
  const guildReady = Boolean(guild);
  const { channels, loading: loadingChannels, getChannelName, refetch: refetchChannels } = useGuildChannels(guildId, { enabled: guildReady });
  const {
    birthdays,
    userMap,
    loading,
    saving,
    error,
    setError,
    refresh,
    addBirthday,
    updateBirthday,
    deleteBirthday,
  } = useBirthdays(guildId, { enabled: guildReady });

  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [memberInput, setMemberInput] = useState("");
  const [memberOptions, setMemberOptions] = useState<MemberItem[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const memberSearchCacheRef = React.useRef<Map<string, { ts: number; items: MemberItem[] }>>(new Map());
  const accent = dashboardAccents.birthdays;
  const fieldSx = dashboardFieldSx(accent);

  const inputLooksLikeId = useMemo(() => /^(\d{5,})$/.test(memberInput.trim()), [memberInput]);
  const sortedBirthdays = useMemo(
    () => [...birthdays].sort((a, b) => a.month - b.month || a.day - b.day || a.userId.localeCompare(b.userId)),
    [birthdays]
  );
  const calendarBirthdays = useMemo(() => {
    const now = new Date();
    return birthdays
      .map(birthday => toUpcomingBirthday(birthday, now))
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime() || a.birthday.userId.localeCompare(b.birthday.userId));
  }, [birthdays]);
  const upcomingBirthdays = useMemo(() => calendarBirthdays.slice(0, 8), [calendarBirthdays]);
  const upcomingCountNext30Days = useMemo(
    () => calendarBirthdays.filter(item => item.daysAway <= 30).length,
    [calendarBirthdays]
  );

  useEffect(() => {
    if (editingUserId) return;
    if (inputLooksLikeId) {
      setForm(prev => ({ ...prev, userId: memberInput.trim() }));
    } else if (!memberInput) {
      setForm(prev => ({ ...prev, userId: "" }));
    }
  }, [editingUserId, inputLooksLikeId, memberInput]);

  useEffect(() => {
    let active = true;
    const query = memberInput.trim();
    if (!guildId || editingUserId || query.length < 3 || inputLooksLikeId) {
      setMemberOptions([]);
      return;
    }

    const cacheKey = `${guildId}::${query.toLowerCase()}`;
    const cached = memberSearchCacheRef.current.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.ts < 2 * 60 * 1000) {
      setMemberOptions(cached.items);
      return;
    }

    setMemberLoading(true);
    const handle = setTimeout(async () => {
      try {
        const result = await api.searchGuildMembers(guildId, query, 25);
        const items = Array.isArray(result) ? result as MemberItem[] : [];
        if (!active) return;
        memberSearchCacheRef.current.set(cacheKey, { ts: Date.now(), items });
        setMemberOptions(items);
      } catch {
        if (active) setMemberOptions([]);
      } finally {
        if (active) setMemberLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [editingUserId, guildId, inputLooksLikeId, memberInput]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingUserId(null);
    setMemberInput("");
    setMemberOptions([]);
  };

  const handleSubmit = async () => {
    const payload = toPayload(form);
    if (!payload) {
      setError("User, channel, day and month are required. Year must be a number when provided.");
      return;
    }

    const ok = editingUserId
      ? await updateBirthday(editingUserId, {
        channelId: payload.channelId,
        day: payload.day,
        month: payload.month,
        ...(payload.year ? { year: payload.year } : {}),
      })
      : await addBirthday(payload);

    if (ok) resetForm();
  };

  const currentTrail = guild ? [
    { label: "Settings", href: `/dashboard/settings/${encodeURIComponent(guild.id)}` },
    { label: "Notifications", href: `/dashboard/settings/${encodeURIComponent(guild.id)}/notifications` },
    { label: "Birthdays", href: null },
  ] : null;

  if (!guild && !guildsLoading) {
    return <GuildAccessError />;
  }

  return (
    <DashboardLayout guild={guild} currentModule="birthdays" currentTrail={currentTrail as any} maxWidth="xl" loading={loading || guildsLoading}>
      {!loading && guild && (
        <FeatureShell accent={accent} secondaryAccent={dashboardAccents.quotes}>
          <FeatureHero
            icon={<Cake />}
            eyebrow="Birthdays"
            title="Birthday Announcements"
            description="Search Discord members, store their birthday, and choose exactly where celebration messages should be posted."
            accent={accent}
            secondaryAccent={dashboardAccents.quotes}
            stats={[
              { label: "Birthdays Configured", value: birthdays.length },
              { label: "Next 30 Days", value: upcomingCountNext30Days },
            ]}
            actions={(
              <Button
                component={Link}
                href={`/dashboard/settings/${encodeURIComponent(guildId)}/notifications`}
                variant="outlined"
                sx={ghostActionButtonSx(accent)}
              >
                Back To Notifications
              </Button>
            )}
            nav={<FeatureNav guildId={guildId} activeModule="Birthdays" />}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <FeaturePanel accent={accent} sx={{ mb: 3 }}>
            <Stack spacing={2} sx={{ position: "relative" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <CalendarMonth sx={{ color: accent }} />
                    <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>
                      Upcoming Calendar
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>
                    The next birthdays from today, including leap-day fallback to February 28 on non-leap years.
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={() => void refresh()} disabled={loading || saving} sx={ghostActionButtonSx(accent)}>
                  Refresh
                </Button>
              </Box>

              {upcomingBirthdays.length === 0 ? (
                <EmptyState icon={<CalendarMonth />} title="No Upcoming Birthdays" description="Add birthdays below to populate this calendar." accent={accent} />
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
                  {upcomingBirthdays.map(item => {
                    const birthday = item.birthday;
                    const user = userMap[birthday.userId];
                    return (
                      <Box key={`upcoming:${birthday.guildId}:${birthday.userId}`} sx={{ ...dashboardCardSx(accent), p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                          <Avatar src={buildAvatarUrl(birthday.userId, user?.avatar) ?? undefined} sx={{ width: 42, height: 42, border: "1px solid rgba(255,255,255,0.12)" }}>
                            {getDisplayName(user).slice(0, 1).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body1" sx={{ color: "grey.50", fontWeight: 850 }} noWrap>
                              {getDisplayName(user)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.46)" }}>
                              {getChannelName(birthday.channelId)}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={formatDaysAway(item.daysAway)}
                            sx={{ bgcolor: "rgba(255,200,87,0.13)", color: "grey.50", border: "1px solid rgba(255,200,87,0.28)" }}
                          />
                        </Stack>
                        <Box>
                          <Typography variant="h6" sx={{ color: "grey.100", fontWeight: 900, letterSpacing: "-0.02em" }}>
                            {formatBirthday(birthday.month, birthday.day, birthday.year)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                            {item.nextDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Stack>
          </FeaturePanel>

          <FeaturePanel accent={accent} sx={{ mb: 3 }}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
              <Box>
                <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>
                  {editingUserId ? "Edit Birthday" : "Add Birthday"}
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>
                  Use member search when possible; pasting a Discord user ID still works for edge cases.
                </Typography>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr 1fr 1fr 2fr auto" }, gap: 2, alignItems: "start" }}>
                <Autocomplete<MemberItem, false, false, true>
                  freeSolo
                  fullWidth
                  disabled={!!editingUserId}
                  options={memberOptions}
                  inputValue={memberInput}
                  onInputChange={(_event, value) => setMemberInput(value)}
                  onChange={(_event, newValue) => {
                    if (newValue && typeof newValue !== "string") {
                      setForm(prev => ({ ...prev, userId: newValue.id }));
                      setMemberInput(`${getDisplayName(newValue)} (${newValue.id})`);
                    }
                  }}
                  getOptionLabel={(option) => typeof option === "string" ? option : getDisplayName(option)}
                  loading={memberLoading}
                  noOptionsText={memberInput.trim().length < 3 ? "Type at least 3 characters" : "No members found"}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Member"
                      placeholder="Search member or paste user ID"
                      size="small"
                      sx={fieldSx}
                      slotProps={{
                        ...params.slotProps,
                        input: {
                          ...params.slotProps.input,
                          endAdornment: (
                            <>
                              {memberLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                              {params.slotProps.input.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                  renderOption={(props, option) => {
                    const avatarUrl = buildAvatarUrl(option.id, option.avatar);
                    const { key, ...rest } = props as unknown as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>;
                    return (
                      <li key={key} {...rest}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar src={avatarUrl ?? undefined} sx={{ width: 24, height: 24 }}>
                            {getDisplayName(option).slice(0, 1).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2">{getDisplayName(option)}</Typography>
                            <Typography variant="caption" sx={{ color: "grey.500" }}>{option.id}</Typography>
                          </Box>
                        </Box>
                      </li>
                    );
                  }}
                />
                <TextField select label="Month" size="small" value={form.month} onChange={(event) => setForm(prev => ({ ...prev, month: event.target.value }))} sx={fieldSx}>
                  {months.map(month => <MenuItem key={month.value} value={month.value}>{month.label}</MenuItem>)}
                </TextField>
                <TextField label="Day" type="number" size="small" value={form.day} onChange={(event) => setForm(prev => ({ ...prev, day: event.target.value }))} slotProps={{ htmlInput: { min: 1, max: 31 } }} sx={fieldSx} />
                <TextField label="Year" type="number" size="small" value={form.year} onChange={(event) => setForm(prev => ({ ...prev, year: event.target.value }))} helperText="Optional" slotProps={{ htmlInput: { min: 1900, max: 9999 } }} sx={fieldSx} />
                <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                  <TextField select label="Announcement Channel" size="small" value={form.channelId} disabled={loadingChannels} onChange={(event) => setForm(prev => ({ ...prev, channelId: event.target.value }))} sx={{ flex: 1, ...fieldSx }}>
                    {channels.map(channel => <MenuItem key={channel.id} value={channel.id}>#{channel.name}</MenuItem>)}
                  </TextField>
                  <Tooltip title="Refresh channels">
                    <span>
                      <IconButton aria-label="Refresh channels" onClick={() => void refetchChannels({ refresh: true })} disabled={loadingChannels} sx={{ color: "grey.200", border: "1px solid rgba(255,255,255,0.14)" }}>
                        <Refresh fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: "flex-start", lg: "flex-end" } }}>
                  <Button variant="contained" startIcon={editingUserId ? <Save /> : <Add />} disabled={saving} onClick={() => void handleSubmit()} sx={primaryActionButtonSx(accent)}>
                    {editingUserId ? "Save" : "Add"}
                  </Button>
                  {editingUserId && (
                    <IconButton color="inherit" onClick={resetForm} disabled={saving} sx={ghostActionButtonSx(accent)}>
                      <Close />
                    </IconButton>
                  )}
                </Stack>
              </Box>
            </Stack>
          </FeaturePanel>

          <FeaturePanel accent={accent}>
            <Stack spacing={2} sx={{ position: "relative" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                    Configured Birthdays
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>
                    Sorted by month and day so upcoming dates are easier to scan.
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={() => void refresh()} disabled={loading || saving} sx={ghostActionButtonSx(accent)}>
                  Refresh
                </Button>
              </Box>

              {sortedBirthdays.length === 0 ? (
                <EmptyState icon={<Cake />} title="No Birthdays Configured" description="Add the first member birthday above to enable announcements." accent={accent} />
              ) : (
                <Stack spacing={1.5}>
                  {sortedBirthdays.map(birthday => {
                    const user = userMap[birthday.userId];
                    return (
                      <Box key={`${birthday.guildId}:${birthday.userId}`} sx={{ ...dashboardCardSx(accent), display: "flex", alignItems: "center", gap: 2, p: 2, flexWrap: { xs: "wrap", md: "nowrap" } }}>
                        <Avatar src={buildAvatarUrl(birthday.userId, user?.avatar) ?? undefined} sx={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                          {getDisplayName(user).slice(0, 1).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 220 }}>
                          <Typography variant="body1" sx={{ color: "grey.50", fontWeight: 800 }}>
                            {getDisplayName(user)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.44)" }}>
                            {birthday.userId}
                          </Typography>
                        </Box>
                        <Box sx={{ minWidth: 190 }}>
                          <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 700 }}>{formatBirthday(birthday.month, birthday.day, birthday.year)}</Typography>
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.50)" }}>{getChannelName(birthday.channelId)}</Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Edit Birthday">
                            <span>
                              <IconButton
                                disabled={saving}
                                onClick={() => {
                                  setEditingUserId(birthday.userId);
                                  setForm({
                                    userId: birthday.userId,
                                    channelId: birthday.channelId,
                                    day: String(birthday.day),
                                    month: String(birthday.month),
                                    year: birthday.year ? String(birthday.year) : "",
                                  });
                                  setMemberInput(`${getDisplayName(user)} (${birthday.userId})`);
                                }}
                                sx={ghostActionButtonSx(accent)}
                              >
                                <Edit />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete Birthday">
                            <span>
                              <IconButton color="error" disabled={saving} onClick={() => void deleteBirthday(birthday.userId)} sx={dangerActionButtonSx}>
                                <Delete />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </FeaturePanel>
        </FeatureShell>
      )}
    </DashboardLayout>
  );
}
