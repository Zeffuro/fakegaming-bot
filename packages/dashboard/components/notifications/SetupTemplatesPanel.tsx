"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { PlaylistAddCheck } from "@mui/icons-material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import {
    api,
    type SetupTemplateChannelSlotKey,
    type SetupTemplateDefinition,
    type SetupTemplateInputGroupKey,
    type SetupTemplatePlan,
    type SetupTemplateRequest,
    type SetupTemplateSteamAppInput,
} from "@/lib/api-client";

interface SetupTemplatesPanelProps {
    guildId: string;
    onApplied: () => Promise<void>;
}

export function SetupTemplatesPanel({ guildId, onApplied }: SetupTemplatesPanelProps) {
    const [definitions, setDefinitions] = useState<SetupTemplateDefinition[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("gaming-community");
    const [channelValues, setChannelValues] = useState<Record<string, string>>({});
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [plan, setPlan] = useState<SetupTemplatePlan | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const selectedTemplate = useMemo(
        () => definitions.find((template) => template.id === selectedTemplateId) ?? definitions[0] ?? null,
        [selectedTemplateId, definitions],
    );

    useEffect(() => {
        let active = true;
        void (async () => {
            try {
                const response = await api.getSetupTemplates();
                if (!active) return;
                setDefinitions(response.templates);
                setSelectedTemplateId((current) => (
                    response.templates.some((template) => template.id === current)
                        ? current
                        : response.templates[0]?.id ?? "gaming-community"
                ));
            } catch (err) {
                if (!active) return;
                setError(err instanceof Error ? err.message : "Failed to load setup templates.");
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    const handlePreview = async () => {
        if (!selectedTemplate) return;

        try {
            setLoading(true);
            setError(null);
            setResult(null);
            const preview = await api.previewSetupTemplate(selectedTemplate.id, buildSetupTemplateRequest(guildId, channelValues, inputValues));
            setPlan(preview);
        } catch (err) {
            setPlan(null);
            setError(err instanceof Error ? err.message : "Failed to preview setup template.");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!selectedTemplate || !plan || plan.ready.length === 0) return;

        try {
            setApplying(true);
            setError(null);
            setResult(null);
            const applyResult = await api.applySetupTemplate(selectedTemplate.id, buildSetupTemplateRequest(guildId, channelValues, inputValues));
            await onApplied();
            setResult(`Applied ${applyResult.applied} ${applyResult.applied === 1 ? "route" : "routes"} from ${applyResult.template.name}.`);
            setPlan(applyResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to apply setup template.");
        } finally {
            setApplying(false);
        }
    };

    const handleChannelChange = (key: SetupTemplateChannelSlotKey, value: string) => {
        setChannelValues((current) => ({ ...current, [key]: value }));
        clearPlanResult();
    };

    const handleInputChange = (key: SetupTemplateInputGroupKey, value: string) => {
        setInputValues((current) => ({ ...current, [key]: value }));
        clearPlanResult();
    };

    const clearPlanResult = () => {
        setPlan(null);
        setResult(null);
    };

    return (
        <FeaturePanel accent={dashboardAccents.settings} sx={{ mt: 3 }}>
            <Stack spacing={2.5}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                    <Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: "grey.50" }}>
                            <PlaylistAddCheck />
                            <Typography variant="h6" sx={{ fontWeight: 850 }}>
                                Setup Templates
                            </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                            Presets create missing notification routes after a server-side preview.
                        </Typography>
                    </Box>
                    {plan && (
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                            <Chip label={`${plan.totals.ready} ready`} color={plan.totals.ready > 0 ? "success" : "default"} variant="outlined" />
                            <Chip label={`${plan.skipped.length} skipped`} color={plan.skipped.length > 0 ? "warning" : "default"} variant="outlined" />
                        </Stack>
                    )}
                </Box>

                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                    {definitions.map((template) => (
                        <Button
                            key={template.id}
                            variant={selectedTemplate?.id === template.id ? "contained" : "outlined"}
                            onClick={() => {
                                setSelectedTemplateId(template.id);
                                clearPlanResult();
                            }}
                            sx={selectedTemplate?.id === template.id
                                ? primaryActionButtonSx(dashboardAccents.settings)
                                : ghostActionButtonSx(dashboardAccents.settings)}
                        >
                            {template.name}
                        </Button>
                    ))}
                </Stack>

                {selectedTemplate && (
                    <>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                            {selectedTemplate.description}
                        </Typography>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                            {selectedTemplate.channelSlots.map((slot) => (
                                <TextField
                                    key={slot.key}
                                    label={slot.label}
                                    value={channelValues[slot.key] ?? ""}
                                    onChange={(event) => handleChannelChange(slot.key, event.target.value)}
                                    size="small"
                                    fullWidth
                                    helperText={slot.description}
                                    sx={dashboardFieldSx(dashboardAccents.settings)}
                                />
                            ))}
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                            {selectedTemplate.inputGroups.map((group) => (
                                <TextField
                                    key={group.key}
                                    label={group.label}
                                    value={inputValues[group.key] ?? ""}
                                    onChange={(event) => handleInputChange(group.key, event.target.value)}
                                    minRows={3}
                                    maxRows={6}
                                    multiline
                                    fullWidth
                                    helperText={group.description}
                                    placeholder={group.placeholder}
                                    sx={dashboardFieldSx(dashboardAccents.settings)}
                                />
                            ))}
                        </Box>
                    </>
                )}

                {error && (
                    <Alert severity="error" sx={{ bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }}>
                        {error}
                    </Alert>
                )}
                {result && (
                    <Alert severity="success" sx={{ bgcolor: "rgba(75, 222, 128, 0.12)", color: "grey.50", border: "1px solid rgba(75, 222, 128, 0.24)" }}>
                        {result}
                    </Alert>
                )}

                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            void handlePreview();
                        }}
                        disabled={!selectedTemplate || loading || applying}
                        sx={ghostActionButtonSx(dashboardAccents.settings)}
                    >
                        {loading ? "Previewing..." : "Preview Template"}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            void handleApply();
                        }}
                        disabled={!plan || plan.ready.length === 0 || applying || loading || Boolean(result)}
                        sx={primaryActionButtonSx(dashboardAccents.settings)}
                    >
                        {applying ? "Applying..." : `Apply Ready (${plan?.ready.length ?? 0})`}
                    </Button>
                </Stack>

                {plan && (
                    <>
                        {plan.warnings.map((warning) => (
                            <Alert key={warning} severity="warning" sx={{ bgcolor: "rgba(255,179,71,0.12)", color: "grey.50", border: "1px solid rgba(255,179,71,0.24)" }}>
                                {warning}
                            </Alert>
                        ))}

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
                            <TemplateItemSection title="Ready To Apply" items={plan.ready} emptyText="No missing supported routes were found." />
                            <TemplateSkippedSection items={plan.skipped} />
                        </Box>
                    </>
                )}
            </Stack>
        </FeaturePanel>
    );
}

function TemplateItemSection({ title, items, emptyText }: { title: string; items: SetupTemplatePlan["ready"]; emptyText: string }) {
    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                {title}
            </Typography>
            {items.length === 0 ? (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
                    {emptyText}
                </Typography>
            ) : (
                <Stack spacing={0.75}>
                    {items.slice(0, 8).map((item) => (
                        <PreviewLine key={item.key} primary={`${item.record.provider}: ${item.record.source}`} secondary={item.record.channelId} />
                    ))}
                </Stack>
            )}
        </Box>
    );
}

function TemplateSkippedSection({ items }: { items: SetupTemplatePlan["skipped"] }) {
    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                Skipped
            </Typography>
            {items.length === 0 ? (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
                    No skipped routes.
                </Typography>
            ) : (
                <Stack spacing={0.75}>
                    {items.slice(0, 8).map((item) => (
                        <PreviewLine
                            key={`${item.reason}:${item.key}`}
                            primary={`${item.record.provider}: ${item.record.source}`}
                            secondary={`${item.message} Channel: ${item.record.channelId}`}
                        />
                    ))}
                </Stack>
            )}
        </Box>
    );
}

function PreviewLine({ primary, secondary }: { primary: string; secondary: string }) {
    return (
        <Box sx={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 1.5, px: 1.25, py: 1, bgcolor: "rgba(255,255,255,0.035)" }}>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750 }}>
                {primary}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
                {secondary}
            </Typography>
        </Box>
    );
}

function buildSetupTemplateRequest(guildId: string, channelValues: Record<string, string>, inputValues: Record<string, string>): SetupTemplateRequest {
    const inputs: NonNullable<SetupTemplateRequest["inputs"]> = {};
    const twitchUsernames = parseDelimitedText(inputValues.twitchUsernames);
    const youtubeChannelIds = parseDelimitedText(inputValues.youtubeChannelIds);
    const patchGames = parseDelimitedText(inputValues.patchGames);
    const animeIds = parsePositiveIntegerList(inputValues.animeIds, "AniList IDs");
    const steamApps = parseSteamApps(inputValues.steamApps);

    if (twitchUsernames.length > 0) inputs.twitchUsernames = twitchUsernames;
    if (youtubeChannelIds.length > 0) inputs.youtubeChannelIds = youtubeChannelIds;
    if (patchGames.length > 0) inputs.patchGames = patchGames;
    if (animeIds.length > 0) inputs.animeIds = animeIds;
    if (steamApps.length > 0) inputs.steamApps = steamApps;

    return {
        guildId,
        channels: normalizeTemplateChannels(channelValues),
        inputs,
    };
}

function normalizeTemplateChannels(values: Record<string, string>): SetupTemplateRequest["channels"] {
    const keys: SetupTemplateChannelSlotKey[] = ["live", "videos", "patches", "anime", "steamNews"];
    return keys.reduce<SetupTemplateRequest["channels"]>((channels, key) => {
        const value = values[key]?.trim();
        if (value) channels[key] = value;
        return channels;
    }, {});
}

function parseDelimitedText(value: string | undefined): string[] {
    return (value ?? "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function parsePositiveIntegerList(value: string | undefined, label: string): number[] {
    return parseDelimitedText(value).map((item) => {
        const parsed = Number(item);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new Error(`${label} must contain positive whole numbers.`);
        }
        return parsed;
    });
}

function parseSteamApps(value: string | undefined): SetupTemplateSteamAppInput[] {
    return parseDelimitedText(value).map((item) => {
        const [rawAppId, ...rawNameParts] = item.split(":");
        const appId = Number(rawAppId?.trim());
        if (!Number.isInteger(appId) || appId <= 0) {
            throw new Error("Steam apps must start with a positive app ID.");
        }

        const name = rawNameParts.join(":").trim();
        return {
            appId,
            ...(name ? { name } : {}),
        };
    });
}
