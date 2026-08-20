"use client";

import React from "react";
import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { DashboardLanguageSelector } from "@/components/i18n/DashboardLanguageSelector";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { DashboardLocale } from "@/lib/i18n/localeStore";
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

const termsCopy = {
    en: {
        pageTitle: "Terms of Service",
        publicIntro: "These terms describe the official hosted instance of",
        publicIntroAt: "at",
        selfHostedIntro: "These terms describe the upstream self-hosted dashboard software and its development defaults.",
        instanceScopeTitle: "Instance scope",
        operatorPrefix: "This service is operated under the display name",
        publicScope: "By using this bot, dashboard, or related notification features on this instance, you agree to use them lawfully and only for Discord servers where you have permission to configure the bot.",
        selfHostedScope: "This project is normally self-hosted. Self-hosted deployments are operated by their own host, and that host is responsible for publishing their own terms, privacy information, contact method, enabled integrations, and support rules.",
        dashboardAccessTitle: "Dashboard access",
        dashboardAccess: [
            "Dashboard access uses Discord login. Server settings should only be changed by users who are authorized to manage the relevant Discord server. You are responsible for actions taken through your Discord account and for keeping access to that account secure.",
            "The operator may revoke dashboard access, disable features, remove unsafe configuration, or rate limit usage when needed to protect the service, comply with platform rules, or respond to abuse.",
        ],
        acceptableUseTitle: "Acceptable use",
        acceptableUse: "Do not use the service to spam, harass, evade platform limits, scrape private data, impersonate others, post illegal content, or violate Discord rules or third-party service terms. Do not submit secrets, passwords, access tokens, private keys, or nonpublic account data into bot commands, dashboard forms, custom messages, or notification settings.",
        contentTitle: "Content and configuration",
        content: [
            "Server administrators and users may submit configuration, notification messages, personal notes, quotes, reminders, birthdays, linked game identities, and other feature data. You are responsible for content you submit and for making sure your server has the right to use channel names, messages, identifiers, and third-party account handles configured in the service. Do not store passwords, API keys, access tokens, recovery codes, private keys, or other secrets in notes.",
            "Public data from services such as Discord, Riot Games, YouTube, Twitch, Steam, OpenWeather, Bluesky, AniList, notification providers, and game-news sites remains owned by its respective providers or publishers. Fakegaming Bot is not affiliated with or endorsed by those providers unless explicitly stated.",
        ],
        thirdPartyTitle: "Third-party terms",
        thirdParty: "Some features depend on third-party APIs, websites, feeds, or platform data. Those services may change, rate limit, remove access, return incorrect data, or impose their own rules on use. Your use of integration features is also subject to the applicable third-party terms and policies.",
        relevantSources: "Relevant sources include:",
        availabilityTitle: "Availability",
        availability: "The service is provided as is and as available. Features may be delayed, unavailable, inaccurate, or changed without notice. Notification delivery is best-effort and is not guaranteed. The operator is not responsible for missed notifications, provider outages, deleted messages, unavailable APIs, or configuration mistakes made by server administrators.",
        privacyTitle: "Privacy and deletion",
        privacyPrefix: "The privacy page explains what data is used for bot and dashboard features, how cookies are used, and how to request deletion or operator review. See",
        privacyLink: "Privacy and cookies",
        contactTitle: "Contact",
        contactPrefix: "Questions, abuse reports, privacy requests, and terms-related requests for this instance can be sent to",
        backToLogin: "Back to login",
    },
    nl: {
        pageTitle: "Gebruiksvoorwaarden",
        publicIntro: "Deze voorwaarden beschrijven de officieel gehoste instantie van",
        publicIntroAt: "op",
        selfHostedIntro: "Deze voorwaarden beschrijven de zelfgehoste upstream-dashboardsoftware en de standaardinstellingen voor ontwikkeling.",
        instanceScopeTitle: "Reikwijdte van de instantie",
        operatorPrefix: "Deze dienst wordt beheerd onder de weergavenaam",
        publicScope: "Door deze bot, het dashboard of bijbehorende meldingsfuncties op deze instantie te gebruiken, ga je ermee akkoord deze rechtmatig te gebruiken en alleen voor Discord-servers waarvoor je toestemming hebt om de bot te configureren.",
        selfHostedScope: "Dit project wordt normaal gesproken zelf gehost. Zelfgehoste implementaties worden beheerd door hun eigen host. Die host is verantwoordelijk voor het publiceren van eigen voorwaarden, privacy-informatie, een contactmethode, ingeschakelde integraties en ondersteuningsregels.",
        dashboardAccessTitle: "Toegang tot het dashboard",
        dashboardAccess: [
            "Voor toegang tot het dashboard wordt Discord-login gebruikt. Serverinstellingen mogen alleen worden gewijzigd door gebruikers die bevoegd zijn om de betreffende Discord-server te beheren. Je bent verantwoordelijk voor acties via je Discord-account en voor het beveiligen van de toegang tot dat account.",
            "De beheerder kan toegang tot het dashboard intrekken, functies uitschakelen, onveilige configuratie verwijderen of gebruik beperken om de dienst te beschermen, platformregels na te leven of op misbruik te reageren.",
        ],
        acceptableUseTitle: "Toegestaan gebruik",
        acceptableUse: "Gebruik de dienst niet voor spam, intimidatie, het omzeilen van platformlimieten, het verzamelen van privégegevens, imitatie van anderen, illegale inhoud of het schenden van Discord-regels of voorwaarden van derden. Voer geen geheimen, wachtwoorden, toegangstokens, privésleutels of niet-openbare accountgegevens in bij botcommando's, dashboardformulieren, aangepaste berichten of meldingsinstellingen.",
        contentTitle: "Inhoud en configuratie",
        content: [
            "Serverbeheerders en gebruikers kunnen configuratie, meldingsberichten, persoonlijke notities, citaten, herinneringen, verjaardagen, gekoppelde game-identiteiten en andere functiegegevens invoeren. Je bent verantwoordelijk voor de inhoud die je invoert en moet zorgen dat je server het recht heeft om geconfigureerde kanaalnamen, berichten, identificatoren en accountnamen van derden te gebruiken. Sla geen wachtwoorden, API-sleutels, toegangstokens, herstelcodes, privésleutels of andere geheimen op in notities.",
            "Openbare gegevens van diensten zoals Discord, Riot Games, YouTube, Twitch, Steam, OpenWeather, Bluesky, AniList, meldingsproviders en gamenieuwssites blijven eigendom van de betreffende providers of uitgevers. Fakegaming Bot is niet verbonden met of goedgekeurd door deze providers, tenzij dit uitdrukkelijk wordt vermeld.",
        ],
        thirdPartyTitle: "Voorwaarden van derden",
        thirdParty: "Sommige functies zijn afhankelijk van API's, websites, feeds of platformgegevens van derden. Deze diensten kunnen veranderen, limieten opleggen, toegang verwijderen, onjuiste gegevens teruggeven of eigen gebruiksregels hanteren. Op het gebruik van integratiefuncties zijn ook de toepasselijke voorwaarden en beleidsregels van derden van toepassing.",
        relevantSources: "Relevante bronnen:",
        availabilityTitle: "Beschikbaarheid",
        availability: "De dienst wordt aangeboden zoals deze is en voor zover beschikbaar. Functies kunnen vertraagd, niet beschikbaar, onnauwkeurig of zonder kennisgeving gewijzigd zijn. De bezorging van meldingen gebeurt naar beste vermogen en wordt niet gegarandeerd. De beheerder is niet verantwoordelijk voor gemiste meldingen, storingen bij providers, verwijderde berichten, niet-beschikbare API's of configuratiefouten van serverbeheerders.",
        privacyTitle: "Privacy en verwijdering",
        privacyPrefix: "Op de privacypagina staat welke gegevens voor bot- en dashboardfuncties worden gebruikt, hoe cookies worden gebruikt en hoe je om verwijdering of beoordeling door de beheerder vraagt. Zie",
        privacyLink: "Privacy en cookies",
        contactTitle: "Contact",
        contactPrefix: "Vragen, meldingen van misbruik, privacyverzoeken en verzoeken over de voorwaarden voor deze instantie kunnen worden gestuurd naar",
        backToLogin: "Terug naar inloggen",
    },
} as const satisfies Record<DashboardLocale, TermsCopy>;

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
    const { locale } = useDashboardI18n();
    const copy = termsCopy[locale];

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
