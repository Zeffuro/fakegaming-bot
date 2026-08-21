"use client";

import React from "react";
import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { DashboardLanguageSelector } from "@/components/i18n/DashboardLanguageSelector";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { DashboardTranslator } from "@/lib/i18n/messages";
import type { PublicLegalConfig } from "@/lib/legalConfig";

interface PolicySectionProps {
    title: string;
    children: React.ReactNode;
}

interface SourceLink {
    href: string;
    label: string;
}

interface DataSourceDefinition {
    id: keyof PrivacyCopy["providers"];
    title: string;
    sources: readonly SourceLink[];
}

interface PrivacyCopy {
    pageTitle: string;
    publicIntro: string;
    publicIntroAt: string;
    selfHostedIntro: string;
    instanceScopeTitle: string;
    operatorName: string;
    storageCountries: string;
    privacyContact: string;
    selfHostedScope: string;
    separateDeployments: string;
    storageFallback: string;
    cookiesTitle: string;
    cookiesIntro: string;
    cookiePurpose: readonly [string, string, string];
    cookieDuration: readonly [string, string, string];
    durationLabel: string;
    botDataTitle: string;
    botData: readonly [string, string];
    thirdPartyTitle: string;
    sourceLabel: string;
    providers: Record<"discord" | "riot" | "youtube" | "twitch" | "steam" | "weather" | "bluesky" | "anilist" | "patchNotes" | "tiktok", string>;
    retentionTitle: string;
    retentionPrefix: string;
    backToLogin: string;
    terms: string;
}

function getPrivacyCopy(t: DashboardTranslator, storageCountries: string): PrivacyCopy {
    return {
        pageTitle: t("legal.privacyPage.pageTitle"),
        publicIntro: t("legal.privacyPage.publicIntro"),
        publicIntroAt: t("legal.privacyPage.publicIntroAt"),
        selfHostedIntro: t("legal.privacyPage.selfHostedIntro"),
        instanceScopeTitle: t("legal.privacyPage.instanceScopeTitle"),
        operatorName: t("legal.privacyPage.operatorName"),
        storageCountries: t("legal.privacyPage.storageCountries"),
        privacyContact: t("legal.privacyPage.privacyContact"),
        selfHostedScope: t("legal.privacyPage.selfHostedScope"),
        separateDeployments: t("legal.privacyPage.separateDeployments"),
        storageFallback: t("legal.privacyPage.storageFallback"),
        cookiesTitle: t("legal.privacyPage.cookiesTitle"),
        cookiesIntro: t("legal.privacyPage.cookiesIntro"),
        cookiePurpose: [
            t("legal.privacyPage.cookiePurposeJwt"),
            t("legal.privacyPage.cookiePurposeRefresh"),
            t("legal.privacyPage.cookiePurposeCsrf"),
        ],
        cookieDuration: [
            t("legal.privacyPage.cookieDurationJwt"),
            t("legal.privacyPage.cookieDurationRefresh"),
            t("legal.privacyPage.cookieDurationCsrf"),
        ],
        durationLabel: t("legal.privacyPage.durationLabel"),
        botDataTitle: t("legal.privacyPage.botDataTitle"),
        botData: [t("legal.privacyPage.botDataFirst"), t("legal.privacyPage.botDataSecond")],
        thirdPartyTitle: t("legal.privacyPage.thirdPartyTitle"),
        sourceLabel: t("legal.privacyPage.sourceLabel"),
        providers: {
            discord: t("legal.privacyPage.providers.discord"),
            riot: t("legal.privacyPage.providers.riot"),
            youtube: t("legal.privacyPage.providers.youtube"),
            twitch: t("legal.privacyPage.providers.twitch"),
            steam: t("legal.privacyPage.providers.steam", { storageCountries }),
            weather: t("legal.privacyPage.providers.weather"),
            bluesky: t("legal.privacyPage.providers.bluesky"),
            anilist: t("legal.privacyPage.providers.anilist"),
            patchNotes: t("legal.privacyPage.providers.patchNotes"),
            tiktok: t("legal.privacyPage.providers.tiktok"),
        },
        retentionTitle: t("legal.privacyPage.retentionTitle"),
        retentionPrefix: t("legal.privacyPage.retentionPrefix"),
        backToLogin: t("legal.privacyPage.backToLogin"),
        terms: t("legal.privacyPage.terms"),
    };
}

const riotBoilerplate = "Fakegaming Bot isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

const dataSourceDefinitions = [
    { id: "discord", title: "Discord", sources: [{ href: "https://discord.com/developers/docs/policies-and-agreements/developer-policy", label: "Discord Developer Policy" }] },
    { id: "riot", title: "Riot Games", sources: [{ href: "https://developer.riotgames.com/policies/general", label: "Riot Developer policies" }] },
    { id: "youtube", title: "YouTube", sources: [{ href: "https://developers.google.com/youtube/terms/developer-policies", label: "YouTube API Services policies" }, { href: "https://www.youtube.com/t/terms", label: "YouTube Terms of Service" }, { href: "https://policies.google.com/privacy", label: "Google Privacy Policy" }] },
    { id: "twitch", title: "Twitch", sources: [{ href: "https://www.twitch.tv/p/en/legal/developer-agreement/", label: "Twitch Developer Agreement" }] },
    { id: "steam", title: "Steam", sources: [{ href: "https://steamcommunity.com/dev/apiterms", label: "Steam Web API Terms of Use" }] },
    { id: "weather", title: "OpenWeather", sources: [{ href: "https://openweathermap.org/api", label: "OpenWeather API" }, { href: "https://open-meteo.com/en/terms", label: "Open-Meteo Terms" }] },
    { id: "bluesky", title: "Bluesky", sources: [{ href: "https://docs.bsky.app/docs/advanced-guides/rate-limits", label: "Bluesky public API notes" }] },
    { id: "anilist", title: "AniList", sources: [{ href: "https://github.com/AniList/ApiV2-GraphQL-Docs", label: "AniList API documentation" }] },
    { id: "patchNotes", title: "Game Patch Notes", sources: [{ href: "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/", label: "Example official patch notes source" }] },
    { id: "tiktok", title: "TikTok", sources: [{ href: "https://www.tiktok.com/legal/page/us/terms-of-service/en", label: "TikTok Terms of Service" }] },
] as const satisfies readonly DataSourceDefinition[];

const cookieNames = ["jwt", "refresh_session", "csrf"] as const;

function PolicySection({ title, children }: PolicySectionProps) {
    return <Stack spacing={1.5}><Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>{title}</Typography>{children}</Stack>;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
    return <Link href={href} target="_blank" rel="noreferrer" underline="hover">{children}</Link>;
}

function maybeContactHref(value: string): string | null {
    if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
    return null;
}

function instanceDomainHref(domain: string): string {
    if (/^localhost(?::\d+)?$/i.test(domain)) return `http://${domain}`;
    return `https://${domain}`;
}

function ContactValue({ value }: { value: string }) {
    const href = maybeContactHref(value);
    return href ? <ExternalLink href={href}>{value}</ExternalLink> : <>{value}</>;
}

function SourceLinks({ sources }: { sources: readonly SourceLink[] }) {
    return <>{sources.map((source, index) => <React.Fragment key={source.href}>{index > 0 ? ", " : null}<ExternalLink href={source.href}>{source.label}</ExternalLink></React.Fragment>)}</>;
}

export function PrivacyPageContent({ legalConfig }: { legalConfig: PublicLegalConfig }) {
    const { t } = useDashboardI18n();
    const storageFallback = t("legal.privacyPage.storageFallback");
    const storageCountries = legalConfig.storageCountries.length > 0 ? legalConfig.storageCountries.join(", ") : storageFallback;
    const copy = getPrivacyCopy(t, storageCountries);

    return (
        <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
            <Stack spacing={4}>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}><DashboardLanguageSelector syncAccount={false} /></Box>
                <Box>
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 850, mb: 1 }}>{copy.pageTitle}</Typography>
                    <Typography color="text.secondary">
                        {legalConfig.isPublicInstance ? <>{copy.publicIntro} {legalConfig.instanceName} {copy.publicIntroAt}{" "}<ExternalLink href={instanceDomainHref(legalConfig.instanceDomain)}>{legalConfig.instanceDomain}</ExternalLink>.</> : copy.selfHostedIntro}
                    </Typography>
                </Box>

                <PolicySection title={copy.instanceScopeTitle}>
                    {legalConfig.isPublicInstance ? (
                        <Stack spacing={1}>
                            <Typography>{copy.operatorName} {legalConfig.operatorName}{legalConfig.operatorCountry ? ` (${legalConfig.operatorCountry})` : null}</Typography>
                            <Typography>{copy.storageCountries} {storageCountries}</Typography>
                            <Typography>{copy.privacyContact}{" "}<ContactValue value={legalConfig.privacyContact} /></Typography>
                        </Stack>
                    ) : <Typography>{copy.selfHostedScope}</Typography>}
                    {legalConfig.isPublicInstance ? <Typography>{copy.separateDeployments}</Typography> : null}
                </PolicySection>

                <PolicySection title={copy.cookiesTitle}>
                    <Typography>{copy.cookiesIntro}</Typography>
                    <Stack spacing={1.5}>
                        {cookieNames.map((name, index) => (
                            <Box key={name} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
                                <Typography sx={{ fontWeight: 800 }}>{name}</Typography>
                                <Typography color="text.secondary">{copy.cookiePurpose[index]}</Typography>
                                <Typography variant="body2" color="text.secondary">{copy.durationLabel} {copy.cookieDuration[index]}</Typography>
                            </Box>
                        ))}
                    </Stack>
                </PolicySection>

                <PolicySection title={copy.botDataTitle}>
                    {copy.botData.map(paragraph => <Typography key={paragraph}>{paragraph}</Typography>)}
                </PolicySection>

                <PolicySection title={copy.thirdPartyTitle}>
                    <Stack spacing={1.5}>
                        {dataSourceDefinitions.map(section => (
                            <Box key={section.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
                                <Typography sx={{ fontWeight: 800, mb: 0.75 }}>{section.title}</Typography>
                                <Typography color="text.secondary">
                                    {copy.providers[section.id]}
                                    {section.id === "riot" ? <> {riotBoilerplate}</> : null}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>{copy.sourceLabel}{" "}<SourceLinks sources={section.sources} /></Typography>
                            </Box>
                        ))}
                    </Stack>
                </PolicySection>

                <PolicySection title={copy.retentionTitle}>
                    <Typography>{copy.retentionPrefix}{" "}<ContactValue value={legalConfig.privacyContact} />.</Typography>
                </PolicySection>

                <Box><Stack direction="row" spacing={2}><Link href="/" underline="hover">{copy.backToLogin}</Link><Link href="/terms" underline="hover">{copy.terms}</Link></Stack></Box>
            </Stack>
        </Container>
    );
}
