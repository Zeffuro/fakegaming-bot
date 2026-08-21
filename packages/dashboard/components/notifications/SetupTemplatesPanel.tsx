"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { PlaylistAddCheck } from "@mui/icons-material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import {
    api,
    type SetupTemplateChannelSlotKey,
    type SetupTemplateDefinition,
    type SetupTemplateInputGroupKey,
    type SetupTemplatePlan,
} from "@/lib/api-client";
import {
    getSetupTemplateChannelSlotDescriptionKey,
    getSetupTemplateChannelSlotLabelKey,
    getSetupTemplateDescriptionKey,
    getSetupTemplateFindingIdKey,
    getSetupTemplateFindingKey,
    getSetupTemplateInputGroupDescriptionKey,
    getSetupTemplateInputGroupLabelKey,
    getSetupTemplateInputGroupPlaceholderKey,
    getSetupTemplateNameKey,
    getSetupTemplateProviderKey,
    getSetupTemplateWarningIdKey,
    getSetupTemplateWarningKey,
} from "@/lib/setupTemplateCopy";
import { buildSetupTemplateRequest, getSetupTemplateValidationErrorKey } from "@/lib/setupTemplateRequest";

interface SetupTemplatesPanelProps {
    guildId: string;
    onApplied: () => Promise<void>;
}

export function SetupTemplatesPanel({ guildId, onApplied }: SetupTemplatesPanelProps) {
    const { t, formatNumber } = useDashboardI18n();
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
                setError(err instanceof Error ? err.message : t("setupTemplates.error.load"));
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
            const validationErrorKey = getSetupTemplateValidationErrorKey(err);
            setError(validationErrorKey ? t(validationErrorKey) : err instanceof Error ? err.message : t("setupTemplates.error.preview"));
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
            setResult(t("setupTemplates.result.applied", {
                count: formatNumber(applyResult.applied),
                routes: applyResult.applied === 1 ? t("setupTemplates.route") : t("setupTemplates.routes"),
                template: getLocalizedTemplateName(t, applyResult.template),
            }));
            setPlan(applyResult);
        } catch (err) {
            const validationErrorKey = getSetupTemplateValidationErrorKey(err);
            setError(validationErrorKey ? t(validationErrorKey) : err instanceof Error ? err.message : t("setupTemplates.error.apply"));
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
                                {t("setupTemplates.title")}
                            </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                            {t("setupTemplates.description")}
                        </Typography>
                    </Box>
                    {plan && (
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                            <Chip label={t("setupTemplates.readyCount", { count: formatNumber(plan.totals.ready) })} color={plan.totals.ready > 0 ? "success" : "default"} variant="outlined" />
                            <Chip label={t("setupTemplates.skippedCount", { count: formatNumber(plan.skipped.length) })} color={plan.skipped.length > 0 ? "warning" : "default"} variant="outlined" />
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
                            {getLocalizedTemplateName(t, template)}
                        </Button>
                    ))}
                </Stack>

                {selectedTemplate && (
                    <>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                            {getLocalizedTemplateDescription(t, selectedTemplate)}
                        </Typography>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                            {selectedTemplate.channelSlots.map((slot) => (
                                <TextField
                                    key={slot.key}
                                    label={getLocalizedChannelSlotLabel(t, slot.key, slot.label)}
                                    value={channelValues[slot.key] ?? ""}
                                    onChange={(event) => handleChannelChange(slot.key, event.target.value)}
                                    size="small"
                                    fullWidth
                                    helperText={getLocalizedChannelSlotDescription(t, slot.key, slot.description)}
                                    sx={dashboardFieldSx(dashboardAccents.settings)}
                                />
                            ))}
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                            {selectedTemplate.inputGroups.map((group) => (
                                <TextField
                                    key={group.key}
                                    label={getLocalizedInputGroupLabel(t, group.key, group.label)}
                                    value={inputValues[group.key] ?? ""}
                                    onChange={(event) => handleInputChange(group.key, event.target.value)}
                                    minRows={3}
                                    maxRows={6}
                                    multiline
                                    fullWidth
                                    helperText={getLocalizedInputGroupDescription(t, group.key, group.description)}
                                    placeholder={getLocalizedInputGroupPlaceholder(t, group.key, group.placeholder)}
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
                        {loading ? t("setupTemplates.previewing") : t("setupTemplates.preview")}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            void handleApply();
                        }}
                        disabled={!plan || plan.ready.length === 0 || applying || loading || Boolean(result)}
                        sx={primaryActionButtonSx(dashboardAccents.settings)}
                    >
                        {applying ? t("setupTemplates.applying") : t("setupTemplates.applyReady", { count: formatNumber(plan?.ready.length ?? 0) })}
                    </Button>
                </Stack>

                {plan && (
                    <>
                        {plan.warnings.map((warning, index) => (
                            <Alert key={plan.warningIds?.[index] ?? `${index}:${warning}`} severity="warning" sx={{ bgcolor: "rgba(255,179,71,0.12)", color: "grey.50", border: "1px solid rgba(255,179,71,0.24)" }}>
                                {getLocalizedWarning(t, warning, plan.warningIds?.[index])}
                            </Alert>
                        ))}

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
                            <TemplateItemSection title={t("setupTemplates.readyToApply")} items={plan.ready} emptyText={t("setupTemplates.noReadyRoutes")} t={t} />
                            <TemplateSkippedSection items={plan.skipped} t={t} />
                        </Box>
                    </>
                )}
            </Stack>
        </FeaturePanel>
    );
}

type DashboardTranslator = ReturnType<typeof useDashboardI18n>["t"];

function TemplateItemSection({ title, items, emptyText, t }: { title: string; items: SetupTemplatePlan["ready"]; emptyText: string; t: DashboardTranslator }) {
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
                        <PreviewLine key={item.key} primary={t("setupTemplates.routeProviderSource", {
                            provider: getLocalizedProvider(t, item.record.provider),
                            source: getLocalizedSource(t, item.record),
                        })} secondary={t("setupTemplates.channelSummary", { channel: item.record.channelId })} />
                    ))}
                </Stack>
            )}
        </Box>
    );
}

function TemplateSkippedSection({ items, t }: { items: SetupTemplatePlan["skipped"]; t: DashboardTranslator }) {
    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                {t("setupTemplates.skipped")}
            </Typography>
            {items.length === 0 ? (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
                    {t("setupTemplates.noSkippedRoutes")}
                </Typography>
            ) : (
                <Stack spacing={0.75}>
                    {items.slice(0, 8).map((item) => (
                        <PreviewLine
                            key={`${item.reason}:${item.key}`}
                            primary={t("setupTemplates.routeProviderSource", {
                                provider: getLocalizedProvider(t, item.record.provider),
                                source: getLocalizedSource(t, item.record),
                            })}
                            secondary={t("setupTemplates.skippedRouteDetails", {
                                finding: getLocalizedFinding(t, item.message, item.findingId),
                                channel: item.record.channelId,
                            })}
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

function getLocalizedTemplateName(t: DashboardTranslator, template: SetupTemplateDefinition): string {
    const key = getSetupTemplateNameKey(template.id);
    return key ? t(key) : template.name;
}

function getLocalizedTemplateDescription(t: DashboardTranslator, template: SetupTemplateDefinition): string {
    const key = getSetupTemplateDescriptionKey(template.id);
    return key ? t(key) : template.description;
}

function getLocalizedChannelSlotLabel(t: DashboardTranslator, slotKey: string, fallback: string): string {
    const key = getSetupTemplateChannelSlotLabelKey(slotKey);
    return key ? t(key) : fallback;
}

function getLocalizedChannelSlotDescription(t: DashboardTranslator, slotKey: string, fallback: string): string {
    const key = getSetupTemplateChannelSlotDescriptionKey(slotKey);
    return key ? t(key) : fallback;
}

function getLocalizedInputGroupLabel(t: DashboardTranslator, groupKey: string, fallback: string): string {
    const key = getSetupTemplateInputGroupLabelKey(groupKey);
    return key ? t(key) : fallback;
}

function getLocalizedInputGroupDescription(t: DashboardTranslator, groupKey: string, fallback: string): string {
    const key = getSetupTemplateInputGroupDescriptionKey(groupKey);
    return key ? t(key) : fallback;
}

function getLocalizedInputGroupPlaceholder(t: DashboardTranslator, groupKey: string, fallback: string): string {
    const key = getSetupTemplateInputGroupPlaceholderKey(groupKey);
    return key ? t(key) : fallback;
}

function getLocalizedProvider(t: DashboardTranslator, provider: string): string {
    const key = getSetupTemplateProviderKey(provider);
    return key ? t(key) : provider;
}

function getLocalizedSource(t: DashboardTranslator, record: SetupTemplatePlan["ready"][number]["record"]): string {
    if (record.provider === "Steam News" && record.sourceId && record.source === record.sourceId) {
        return t("setupTemplates.steamAppFallback", { appId: record.sourceId });
    }
    return record.source;
}

function getLocalizedFinding(t: DashboardTranslator, finding: string, findingId?: string): string {
    const key = (findingId ? getSetupTemplateFindingIdKey(findingId) : null)
        ?? getSetupTemplateFindingKey(finding);
    return key ? t(key) : finding;
}

function getLocalizedWarning(t: DashboardTranslator, warning: string, warningId?: string): string {
    const key = (warningId ? getSetupTemplateWarningIdKey(warningId) : null)
        ?? getSetupTemplateWarningKey(warning);
    return key ? t(key) : warning;
}
