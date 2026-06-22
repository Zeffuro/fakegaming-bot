import React from "react";
import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { readPublicLegalConfig } from "@/lib/legalConfig";

export const dynamic = "force-dynamic";

interface TermsSectionProps {
    title: string;
    children: React.ReactNode;
}

interface SourceLink {
    href: string;
    label: string;
}

const thirdPartyTerms = [
    {
        href: "https://discord.com/terms",
        label: "Discord Terms of Service"
    },
    {
        href: "https://discord.com/developers/docs/policies-and-agreements/developer-policy",
        label: "Discord Developer Policy"
    },
    {
        href: "https://steamcommunity.com/dev/apiterms",
        label: "Steam Web API Terms of Use"
    },
    {
        href: "https://developers.google.com/youtube/terms/developer-policies",
        label: "YouTube API Services policies"
    },
    {
        href: "https://www.twitch.tv/p/en/legal/developer-agreement/",
        label: "Twitch Developer Agreement"
    },
    {
        href: "https://developer.riotgames.com/policies/general",
        label: "Riot Developer policies"
    }
] as const satisfies readonly SourceLink[];

function TermsSection({ title, children }: TermsSectionProps) {
    return (
        <Stack spacing={1.5}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
                {title}
            </Typography>
            {children}
        </Stack>
    );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} target="_blank" rel="noreferrer" underline="hover">
            {children}
        </Link>
    );
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
    if (!href) return <>{value}</>;
    return <ExternalLink href={href}>{value}</ExternalLink>;
}

function SourceLinks({ sources }: { sources: readonly SourceLink[] }) {
    return (
        <>
            {sources.map((source, index) => (
                <React.Fragment key={source.href}>
                    {index > 0 ? ", " : null}
                    <ExternalLink href={source.href}>{source.label}</ExternalLink>
                </React.Fragment>
            ))}
        </>
    );
}

export default function TermsPage() {
    const legalConfig = readPublicLegalConfig();

    return (
        <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
            <Stack spacing={4}>
                <Box>
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 850, mb: 1 }}>
                        Terms of Service
                    </Typography>
                    <Typography color="text.secondary">
                        {legalConfig.isPublicInstance
                            ? (
                                <>
                                    These terms describe the official hosted instance of {legalConfig.instanceName} at{" "}
                                    <ExternalLink href={instanceDomainHref(legalConfig.instanceDomain)}>
                                        {legalConfig.instanceDomain}
                                    </ExternalLink>.
                                </>
                            )
                            : "These terms describe the upstream self-hosted dashboard software and its development defaults."}
                    </Typography>
                </Box>

                <TermsSection title="Instance scope">
                    {legalConfig.isPublicInstance ? (
                        <Stack spacing={1}>
                            <Typography>
                                This service is operated under the display name {legalConfig.operatorName}
                                {legalConfig.operatorCountry ? ` (${legalConfig.operatorCountry})` : null}.
                            </Typography>
                            <Typography>
                                By using this bot, dashboard, or related notification features on this instance, you agree
                                to use them lawfully and only for Discord servers where you have permission to configure
                                the bot.
                            </Typography>
                        </Stack>
                    ) : (
                        <Typography>
                            This project is normally self-hosted. Self-hosted deployments are operated by their own host,
                            and that host is responsible for publishing their own terms, privacy information, contact
                            method, enabled integrations, and support rules.
                        </Typography>
                    )}
                </TermsSection>

                <TermsSection title="Dashboard access">
                    <Typography>
                        Dashboard access uses Discord login. Server settings should only be changed by users who are
                        authorized to manage the relevant Discord server. You are responsible for actions taken through
                        your Discord account and for keeping access to that account secure.
                    </Typography>
                    <Typography>
                        The operator may revoke dashboard access, disable features, remove unsafe configuration, or rate
                        limit usage when needed to protect the service, comply with platform rules, or respond to abuse.
                    </Typography>
                </TermsSection>

                <TermsSection title="Acceptable use">
                    <Typography>
                        Do not use the service to spam, harass, evade platform limits, scrape private data, impersonate
                        others, post illegal content, or violate Discord rules or third-party service terms. Do not submit
                        secrets, passwords, access tokens, private keys, or nonpublic account data into bot commands,
                        dashboard forms, custom messages, or notification settings.
                    </Typography>
                </TermsSection>

                <TermsSection title="Content and configuration">
                    <Typography>
                        Server administrators and users may submit configuration, notification messages, personal notes,
                        quotes, reminders, birthdays, linked game identities, and other feature data. You are responsible
                        for content you submit and for making sure your server has the right to use channel names,
                        messages, identifiers, and third-party account handles configured in the service. Do not store
                        passwords, API keys, access tokens, recovery codes, private keys, or other secrets in notes.
                    </Typography>
                    <Typography>
                        Public data from services such as Discord, Riot Games, YouTube, Twitch, Steam, OpenWeather,
                        Bluesky, AniList, notification providers, and game-news sites remains owned by its respective providers or
                        publishers. Fakegaming Bot is not affiliated with or endorsed by those providers unless explicitly
                        stated.
                    </Typography>
                </TermsSection>

                <TermsSection title="Third-party terms">
                    <Typography>
                        Some features depend on third-party APIs, websites, feeds, or platform data. Those services may
                        change, rate limit, remove access, return incorrect data, or impose their own rules on use. Your
                        use of integration features is also subject to the applicable third-party terms and policies.
                    </Typography>
                    <Typography>
                        Relevant sources include: <SourceLinks sources={thirdPartyTerms} />.
                    </Typography>
                </TermsSection>

                <TermsSection title="Availability">
                    <Typography>
                        The service is provided as is and as available. Features may be delayed, unavailable, inaccurate,
                        or changed without notice. Notification delivery is best-effort and is not guaranteed. The operator
                        is not responsible for missed notifications, provider outages, deleted messages, unavailable APIs,
                        or configuration mistakes made by server administrators.
                    </Typography>
                </TermsSection>

                <TermsSection title="Privacy and deletion">
                    <Typography>
                        The privacy page explains what data is used for bot and dashboard features, how cookies are used,
                        and how to request deletion or operator review. See{" "}
                        <Link href="/privacy" underline="hover">Privacy and cookies</Link>.
                    </Typography>
                </TermsSection>

                <TermsSection title="Contact">
                    <Typography>
                        Questions, abuse reports, privacy requests, and terms-related requests for this instance can be
                        sent to <ContactValue value={legalConfig.privacyContact} />.
                    </Typography>
                </TermsSection>

                <Box>
                    <Link href="/" underline="hover">Back to login</Link>
                </Box>
            </Stack>
        </Container>
    );
}
