"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  Cake,
  Close,
  Delete,
  Edit,
  LiveTv,
  Save,
  SpeakerNotes,
  YouTube as YouTubeIcon,
} from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
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
  const { channels, loading: loadingChannels, getChannelName } = useGuildChannels(guildId);
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
  } = useBirthdays(guildId);

  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [memberInput, setMemberInput] = useState("");
  const [memberOptions, setMemberOptions] = useState<MemberItem[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const memberSearchCacheRef = React.useRef<Map<string, { ts: number; items: MemberItem[] }>>(new Map());

  const inputLooksLikeId = useMemo(() => /^(\d{5,})$/.test(memberInput.trim()), [memberInput]);
  const sortedBirthdays = useMemo(
    () => [...birthdays].sort((a, b) => a.month - b.month || a.day - b.day || a.userId.localeCompare(b.userId)),
    [birthdays]
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
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>
          Guild not found or you don't have access to this guild.
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guild={guild} currentModule="birthdays" currentTrail={currentTrail as any} maxWidth="lg" loading={loading || guildsLoading}>
      {!loading && guild && (
        <>
          <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, display: "flex", alignItems: "center", gap: 2, color: "grey.100" }}>
                <Cake color="warning" />
                Birthdays
              </Typography>
              <Typography variant="body1" sx={{ color: "grey.300" }}>
                Manage birthday announcements for this server.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <ButtonGroup variant="outlined">
                <Button component={Link} href={`/dashboard/twitch/${encodeURIComponent(guildId)}`} startIcon={<LiveTv />}>Twitch</Button>
                <Button component={Link} href={`/dashboard/tiktok/${encodeURIComponent(guildId)}`} startIcon={<LiveTv />}>TikTok</Button>
                <Button component={Link} href={`/dashboard/youtube/${encodeURIComponent(guildId)}`} startIcon={<YouTubeIcon />}>YouTube</Button>
                <Button component={Link} href={`/dashboard/patch-notes/${encodeURIComponent(guildId)}`} startIcon={<SpeakerNotes />}>Patch Notes</Button>
                <Button component={Link} href={`/dashboard/birthdays/${encodeURIComponent(guildId)}`} startIcon={<Cake />} sx={{ bgcolor: "warning.dark", color: "warning.contrastText" }}>Birthdays</Button>
              </ButtonGroup>
              <Button
                component={Link}
                href={`/dashboard/settings/${encodeURIComponent(guildId)}/notifications`}
                variant="outlined"
                size="small"
                sx={{ borderColor: "grey.600", color: "grey.300", "&:hover": { borderColor: "grey.500", bgcolor: "grey.700" } }}
              >
                Back to Notifications
              </Button>
            </Stack>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, bgcolor: "error.dark", color: "error.light" }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, bgcolor: "grey.800", border: 1, borderColor: "grey.700", mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: "grey.100" }}>
              {editingUserId ? "Edit Birthday" : "Add Birthday"}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 1fr 2fr auto" }, gap: 2, alignItems: "center" }}>
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
              <TextField
                select
                label="Month"
                size="small"
                value={form.month}
                onChange={(event) => setForm(prev => ({ ...prev, month: event.target.value }))}
              >
                {months.map(month => <MenuItem key={month.value} value={month.value}>{month.label}</MenuItem>)}
              </TextField>
              <TextField
                label="Day"
                type="number"
                size="small"
                value={form.day}
                onChange={(event) => setForm(prev => ({ ...prev, day: event.target.value }))}
                slotProps={{ htmlInput: { min: 1, max: 31 } }}
              />
              <TextField
                label="Year"
                type="number"
                size="small"
                value={form.year}
                onChange={(event) => setForm(prev => ({ ...prev, year: event.target.value }))}
                helperText="Optional"
                slotProps={{ htmlInput: { min: 1900, max: 9999 } }}
              />
              <TextField
                select
                label="Announcement Channel"
                size="small"
                value={form.channelId}
                disabled={loadingChannels}
                onChange={(event) => setForm(prev => ({ ...prev, channelId: event.target.value }))}
              >
                {channels.map(channel => <MenuItem key={channel.id} value={channel.id}>#{channel.name}</MenuItem>)}
              </TextField>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={editingUserId ? <Save /> : <Add />}
                  disabled={saving}
                  onClick={() => void handleSubmit()}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {editingUserId ? "Save" : "Add"}
                </Button>
                {editingUserId && (
                  <IconButton color="inherit" onClick={resetForm} disabled={saving}>
                    <Close />
                  </IconButton>
                )}
              </Stack>
            </Box>
          </Paper>

          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, bgcolor: "grey.800", border: 1, borderColor: "grey.700" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: "grey.100" }}>
                Configured Birthdays
              </Typography>
              <Button variant="outlined" onClick={() => void refresh()} disabled={loading || saving}>Refresh</Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {sortedBirthdays.length === 0 ? (
              <Typography variant="body1" sx={{ color: "grey.400" }}>
                No birthdays configured for this server.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {sortedBirthdays.map(birthday => {
                  const user = userMap[birthday.userId];
                  return (
                    <Box key={`${birthday.guildId}:${birthday.userId}`} sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, borderRadius: 1, bgcolor: "grey.900", border: 1, borderColor: "grey.700" }}>
                      <Avatar src={buildAvatarUrl(birthday.userId, user?.avatar) ?? undefined}>
                        {getDisplayName(user).slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body1" sx={{ color: "grey.100" }}>
                          {getDisplayName(user)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "grey.500" }}>
                          {birthday.userId}
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: 160 }}>
                        <Typography variant="body2" sx={{ color: "grey.100" }}>{formatBirthday(birthday.month, birthday.day, birthday.year)}</Typography>
                        <Typography variant="caption" sx={{ color: "grey.500" }}>{getChannelName(birthday.channelId)}</Typography>
                      </Box>
                      <Tooltip title="Edit birthday">
                        <span>
                          <IconButton
                            color="primary"
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
                          >
                            <Edit />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete birthday">
                        <span>
                          <IconButton color="error" disabled={saving} onClick={() => void deleteBirthday(birthday.userId)}>
                            <Delete />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </>
      )}
    </DashboardLayout>
  );
}
