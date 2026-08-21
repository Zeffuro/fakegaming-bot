"use client";

import React from "react";
import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { DashboardLanguageSelector } from "@/components/i18n/DashboardLanguageSelector";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { DashboardTranslator } from "@/lib/i18n/messages";
import type { PublicLegalConfig } from "@/lib/legalConfig";

interface TermsSectionProps {
    title: string;
    children: React.ReactNode;
}

interface SourceLink {
    href: string;
    label: string;
}

interface TermsCopy {
    pageTitle: string;
    publicIntro: string;
    publicIntroAt: string;
    selfHostedIntro: string;
    instanceScopeTitle: string;
    operatorPrefix: string;
    publicScope: string;
    selfHostedScope: string;
    dashboardAccessTitle: string;
    dashboardAccess: readonly [string, string];
    acceptableUseTitle: string;
    acceptableUse: string;
    contentTitle: string;
    content: readonly [string, string];
    thirdPartyTitle: string;
    thirdParty: string;
    relevantSources: string;
    availabilityTitle: string;
    availability: string;
    privacyTitle: string;
    privacyPrefix: string;
    privacyLink: string;
    contactTitle: string;
    contactPrefix: string;
    backToLogin: string;
}

function getTermsCopy(t: DashboardTranslator): TermsCopy {
    return {
        pageTitle: t("legal.termsPage.pageTitle"),
        publicIntro: t("legal.termsPage.publicIntro"),
        publicIntroAt: t("legal.termsPage.publicIntroAt"),
        selfHostedIntro: t("legal.termsPage.selfHostedIntro"),
        instanceScopeTitle: t("legal.termsPage.instanceScopeTitle"),
        operatorPrefix: t("legal.termsPage.operatorPrefix"),
        publicScope: t("legal.termsPage.publicScope"),
        selfHostedScope: t("legal.termsPage.selfHostedScope"),
        dashboardAccessTitle: t("legal.termsPage.dashboardAccessTitle"),
        dashboardAccess: [
            t("legal.termsPage.dashboardAccessFirst"),
            t("legal.termsPage.dashboardAccessSecond"),
        ],
        acceptableUseTitle: t("legal.termsPage.acceptableUseTitle"),
        acceptableUse: t("legal.termsPage.acceptableUse"),
        contentTitle: t("legal.termsPage.contentTitle"),
        content: [t("legal.termsPage.contentFirst"), t("legal.termsPage.contentSecond")],
        thirdPartyTitle: t("legal.termsPage.thirdPartyTitle"),
        thirdParty: t("legal.termsPage.thirdParty"),
        relevantSources: t("legal.termsPage.relevantSources"),
        availabilityTitle: t("legal.termsPage.availabilityTitle"),
        availability: t("legal.termsPage.availability"),
        privacyTitle: t("legal.termsPage.privacyTitle"),
        privacyPrefix: t("legal.termsPage.privacyPrefix"),
        privacyLink: t("legal.termsPage.privacyLink"),
        contactTitle: t("legal.termsPage.contactTitle"),
        contactPrefix: t("legal.termsPage.contactPrefix"),
        backToLogin: t("legal.termsPage.backToLogin"),
    };
}

const thirdPartyTerms = [
    { href: "https://discord.com/terms", label: "Discord Terms of Service" },
    { href: "https://discord.com/developers/docs/policies-and-agreements/developer-policy", label: "Discord Developer Policy" },
    { href: "https://steamcommunity.com/dev/apiterms", label: "Steam Web API Terms of Use" },
    { href: "https://developers.google.com/youtube/terms/developer-policies", label: "YouTube API Services policies" },
    { href: "https://www.twitch.tv/p/en/legal/developer-agreement/", label: "Twitch Developer Agreement" },
    { href: "https://developer.riotgames.com/policies/general", label: "Riot Developer policies" },
] as const satisfies readonly SourceLink[];

function TermsSection({ title, children }: TermsSectionProps) {
    return (
        <Stack spacing={1.5}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>{title}</Typography>
            {children}
        </Stack>
    );
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

function SourceLinks() {
    return (
        <>
            {thirdPartyTerms.map((source, index) => (
                <React.Fragment key={source.href}>
                    {index > 0 ? ", " : null}
                    <ExternalLink href={source.href}>{source.label}</ExternalLink>
                </React.Fragment>
            ))}
        </>
    );
}

export function TermsPageContent({ legalConfig }: { legalConfig: PublicLegalConfig }) {
    const { t } = useDashboardI18n();
    const copy = getTermsCopy(t);

    return (
        <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
            <Stack spacing={4}>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <DashboardLanguageSelector syncAccount={false} />
                </Box>
                <Box>
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 850, mb: 1 }}>{copy.pageTitle}</Typography>
                    <Typography color="text.secondary">
                        {legalConfig.isPublicInstance ? (
                            <>{copy.publicIntro} {legalConfig.instanceName} {copy.publicIntroAt}{" "}<ExternalLink href={instanceDomainHref(legalConfig.instanceDomain)}>{legalConfig.instanceDomain}</ExternalLink>.</>
                        ) : copy.selfHostedIntro}
                    </Typography>
                </Box>

                <TermsSection title={copy.instanceScopeTitle}>
                    {legalConfig.isPublicInstance ? (
                        <Stack spacing={1}>
                            <Typography>{copy.operatorPrefix} {legalConfig.operatorName}{legalConfig.operatorCountry ? ` (${legalConfig.operatorCountry})` : null}.</Typography>
                            <Typography>{copy.publicScope}</Typography>
                        </Stack>
                    ) : <Typography>{copy.selfHostedScope}</Typography>}
                </TermsSection>

                <TermsSection title={copy.dashboardAccessTitle}>
                    {copy.dashboardAccess.map(paragraph => <Typography key={paragraph}>{paragraph}</Typography>)}
                </TermsSection>
                <TermsSection title={copy.acceptableUseTitle}><Typography>{copy.acceptableUse}</Typography></TermsSection>
                <TermsSection title={copy.contentTitle}>
                    {copy.content.map(paragraph => <Typography key={paragraph}>{paragraph}</Typography>)}
                </TermsSection>
                <TermsSection title={copy.thirdPartyTitle}>
                    <Typography>{copy.thirdParty}</Typography>
                    <Typography>{copy.relevantSources} <SourceLinks />.</Typography>
                </TermsSection>
                <TermsSection title={copy.availabilityTitle}><Typography>{copy.availability}</Typography></TermsSection>
                <TermsSection title={copy.privacyTitle}>
                    <Typography>{copy.privacyPrefix}{" "}<Link href="/privacy" underline="hover">{copy.privacyLink}</Link>.</Typography>
                </TermsSection>
                <TermsSection title={copy.contactTitle}>
                    <Typography>{copy.contactPrefix}{" "}<ContactValue value={legalConfig.privacyContact} />.</Typography>
                </TermsSection>
                <Box><Link href="/" underline="hover">{copy.backToLogin}</Link></Box>
            </Stack>
        </Container>
    );
}
