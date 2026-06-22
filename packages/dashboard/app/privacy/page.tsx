import React from "react";
import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { readPublicLegalConfig } from "@/lib/legalConfig";

export const dynamic = "force-dynamic";

interface PolicySectionProps {
    title: string;
    children: React.ReactNode;
}

interface SourceLink {
    href: string;
    label: string;
}

interface DataSourceSection {
    title: string;
    body: React.ReactNode;
    sources: SourceLink[];
}

const riotBoilerplate = "Fakegaming Bot isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

const cookieRows = [
    {
        name: "jwt",
        purpose: "Keeps the dashboard authenticated for API requests.",
        duration: "20 minutes"
    },
    {
        name: "refresh_session",
        purpose: "Keeps a dashboard login active across idle periods and lets logout revoke the session.",
        duration: "14 days idle, 30 days maximum"
    },
    {
        name: "csrf",
        purpose: "Protects mutating dashboard requests against cross-site request forgery.",
        duration: "14 days"
    }
] as const;

function PolicySection({ title, children }: PolicySectionProps) {
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

function SourceLinks({ sources }: { sources: SourceLink[] }) {
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

function buildThirdPartySections(storageCountriesText: string): DataSourceSection[] {
    return [
        {
            title: "Discord",
            sources: [
                {
                    href: "https://discord.com/developers/docs/policies-and-agreements/developer-policy",
                    label: "Discord Developer Policy"
                }
            ],
            body: (
                <>
                    Discord login is used to read your Discord profile and server list so the dashboard can show servers
                    where you can manage the bot. The bot and dashboard store Discord IDs, server IDs, channel IDs, role
                    or permission data, cached profile and guild data, and bot configuration needed for server features.
                    Discord API data is used only for bot and dashboard functionality. It is not sold, used for
                    advertising profiles, disclosed to data brokers, or used to train AI models.
                </>
            )
        },
        {
            title: "Riot Games",
            sources: [
                {
                    href: "https://developer.riotgames.com/policies/general",
                    label: "Riot Developer policies"
                }
            ],
            body: (
                <>
                    League of Legends and Teamfight Tactics features use Riot APIs to resolve Riot IDs and retrieve
                    account, summoner, match, ranked, and TFT data. Stored linked-account data can include Discord user
                    ID, Riot ID, legacy summoner name, region, and PUUID. {riotBoilerplate}
                </>
            )
        },
        {
            title: "YouTube",
            sources: [
                {
                    href: "https://developers.google.com/youtube/terms/developer-policies",
                    label: "YouTube API Services policies"
                },
                {
                    href: "https://www.youtube.com/t/terms",
                    label: "YouTube Terms of Service"
                },
                {
                    href: "https://policies.google.com/privacy",
                    label: "Google Privacy Policy"
                }
            ],
            body: (
                <>
                    This service uses YouTube API Services. YouTube notification features can monitor public channels
                    through RSS and YouTube API data. Stored data can include Discord server ID, Discord channel ID,
                    YouTube channel ID, last seen video ID, custom message, cooldown, quiet hours, pause state, and last
                    notification time. The bot may fetch public video metadata such as title, thumbnail, publication time,
                    duration, and view count. It does not ask users to sign in with YouTube or access private YouTube
                    accounts. Use of YouTube features is subject to YouTube&apos;s terms and Google&apos;s privacy policy.
                </>
            )
        },
        {
            title: "Twitch",
            sources: [
                {
                    href: "https://www.twitch.tv/p/en/legal/developer-agreement/",
                    label: "Twitch Developer Agreement"
                }
            ],
            body: (
                <>
                    Twitch notification features use Twitch Helix data to monitor public live status. Stored data can
                    include Twitch username, Discord server ID, Discord channel ID, custom message, cooldown, quiet hours,
                    pause state, live-state cache, and last notification time. Public stream metadata such as stream title,
                    game, viewer count, profile image, thumbnail, and start time may be displayed in Discord. Twitch data
                    is provided by Twitch. Fakegaming Bot is not affiliated with or endorsed by Twitch.
                </>
            )
        },
        {
            title: "Steam",
            sources: [
                {
                    href: "https://steamcommunity.com/dev/apiterms",
                    label: "Steam Web API Terms of Use"
                }
            ],
            body: (
                <>
                    Steam news features monitor public Steam app news and use Steam app lookup data to help server
                    administrators choose games. Stored data can include Steam App ID, optional game name, Discord server
                    ID, Discord channel ID, last seen news item, last announcement timestamp, custom message, cooldown,
                    quiet hours, and pause state. Steam-related data for this instance is stored in {storageCountriesText}.
                    Fakegaming Bot does not request Steam passwords, Steam account login, or nonpublic Steam end-user
                    account data. Steam data is provided as is and as available by Steam and Valve. Fakegaming Bot is not
                    affiliated with or endorsed by Valve or Steam.
                </>
            )
        },
        {
            title: "OpenWeather",
            sources: [
                {
                    href: "https://openweathermap.org/api",
                    label: "OpenWeather API"
                },
                {
                    href: "https://open-meteo.com/en/terms",
                    label: "Open-Meteo Terms"
                }
            ],
            body: (
                <>
                    Weather commands send the requested location text to OpenWeather to retrieve current weather and
                    forecast data. The current bot code may fall back to Open-Meteo geocoding and forecast services when
                    OpenWeather is not configured or is unavailable. The bot does not create a persistent per-user weather
                    profile from lookup history.
                </>
            )
        },
        {
            title: "Bluesky",
            sources: [
                {
                    href: "https://docs.bsky.app/docs/advanced-guides/rate-limits",
                    label: "Bluesky public API notes"
                }
            ],
            body: (
                <>
                    Bluesky notification features monitor public Bluesky accounts for new posts. Stored data can include
                    the Bluesky handle, Discord server ID, Discord channel ID, last seen post URI and CID, custom message,
                    cooldown, quiet hours, pause state, and last notification time. The bot uses public Bluesky data and
                    does not access private Bluesky accounts.
                </>
            )
        },
        {
            title: "AniList",
            sources: [
                {
                    href: "https://github.com/AniList/ApiV2-GraphQL-Docs",
                    label: "AniList API documentation"
                }
            ],
            body: (
                <>
                    Anime features use AniList to search anime and manga titles and retrieve public airing schedule
                    metadata. Stored data can include AniList media IDs, titles, selected channel or user reminder
                    settings, reminder timing, pause state, and last-notified episode state so duplicate reminders are
                    avoided.
                </>
            )
        },
        {
            title: "Game Patch Notes",
            sources: [
                {
                    href: "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/",
                    label: "Example official patch notes source"
                }
            ],
            body: (
                <>
                    Patch-note features may check official game news or patch-note pages for supported games and post
                    links, titles, images, and short Discord embed excerpts. Stored data can include the selected game,
                    Discord server ID, Discord channel ID, pause state, and last notification state. Patch-note content
                    belongs to the respective publishers. Fakegaming Bot is not affiliated with those publishers unless
                    explicitly stated.
                </>
            )
        },
        {
            title: "TikTok",
            sources: [
                {
                    href: "https://www.tiktok.com/legal/page/us/terms-of-service/en",
                    label: "TikTok Terms of Service"
                }
            ],
            body: (
                <>
                    TikTok live notifications are available only when an instance operator configures TikTok credentials or
                    cookies. This is an experimental, operator-controlled feature for public live-status alerts. Stored
                    data can include TikTok username, Discord server ID, Discord channel ID, custom message, cooldown,
                    quiet hours, pause state, live-state cache, and last notification time. Fakegaming Bot is not
                    affiliated with or endorsed by TikTok and does not claim TikTok approval. Operators are responsible for
                    deciding whether TikTok notifications are appropriate for their deployment.
                </>
            )
        }
    ];
}

export default function PrivacyPage() {
    const legalConfig = readPublicLegalConfig();
    const storageCountriesText = legalConfig.storageCountries.length > 0
        ? legalConfig.storageCountries.join(", ")
        : "the storage location configured by the instance operator";
    const thirdPartySections = buildThirdPartySections(storageCountriesText);

    return (
        <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
            <Stack spacing={4}>
                <Box>
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 850, mb: 1 }}>
                        Privacy and cookies
                    </Typography>
                    <Typography color="text.secondary">
                        {legalConfig.isPublicInstance
                            ? (
                                <>
                                    This page describes the official hosted instance of {legalConfig.instanceName} at{" "}
                                    <ExternalLink href={instanceDomainHref(legalConfig.instanceDomain)}>
                                        {legalConfig.instanceDomain}
                                    </ExternalLink>.
                                </>
                            )
                            : "This page describes the upstream self-hosted dashboard software and its development defaults."}
                    </Typography>
                </Box>

                <PolicySection title="Instance scope">
                    {legalConfig.isPublicInstance ? (
                        <Stack spacing={1}>
                            <Typography>
                                Operator display name: {legalConfig.operatorName}
                                {legalConfig.operatorCountry ? ` (${legalConfig.operatorCountry})` : null}
                            </Typography>
                            <Typography>Storage countries: {storageCountriesText}</Typography>
                            <Typography>
                                Privacy contact: <ContactValue value={legalConfig.privacyContact} />
                            </Typography>
                        </Stack>
                    ) : (
                        <Typography>
                            This upstream project is normally self-hosted. Self-hosted deployments are operated by their
                            own host and must publish their own privacy information, including operator identity, contact
                            method, storage countries, retention rules, and enabled integrations.
                        </Typography>
                    )}
                    {legalConfig.isPublicInstance ? (
                        <Typography>
                            Self-hosted deployments are separate from this official hosted instance. They are operated by
                            their own host and must publish their own privacy information.
                        </Typography>
                    ) : null}
                </PolicySection>

                <PolicySection title="Cookies">
                    <Typography>
                        The dashboard only uses cookies needed for login and request security. It does not use
                        advertising, tracking, or analytics cookies.
                    </Typography>
                    <Stack spacing={1.5}>
                        {cookieRows.map(cookie => (
                            <Box
                                key={cookie.name}
                                sx={{
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: 2,
                                    p: 2,
                                    bgcolor: "background.paper"
                                }}
                            >
                                <Typography sx={{ fontWeight: 800 }}>{cookie.name}</Typography>
                                <Typography color="text.secondary">{cookie.purpose}</Typography>
                                <Typography variant="body2" color="text.secondary">Duration: {cookie.duration}</Typography>
                            </Box>
                        ))}
                    </Stack>
                </PolicySection>

                <PolicySection title="Bot and dashboard data">
                    <Typography>
                        Server administrators configure bot features by storing Discord server IDs, channel IDs, selected
                        provider identifiers, notification settings, custom messages, pause state, cooldowns, quiet hours,
                        and last-seen or last-notified markers. The dashboard also stores short-lived login/session data,
                        Discord access tokens, cached Discord profiles, cached guild permission lists, audit events,
                        worker status, delivery records, and dedupe records needed to run and troubleshoot the bot.
                    </Typography>
                    <Typography>
                        User-submitted bot data, such as quotes, reminders, birthdays, linked Riot accounts, and anime
                        subscriptions, is stored only for the feature that received it. Personal dashboard notes are
                        stored under the Discord user ID that created them and are not tied to a Discord server. Do not
                        store passwords, API keys, tokens, recovery codes, private keys, or other secrets in notes.
                        Server administrators can remove many server-scoped configurations through the dashboard or bot
                        management commands. Operators control database backups, logs, retention windows, and storage
                        location for their own deployment.
                    </Typography>
                </PolicySection>

                <PolicySection title="Third-party services and data sources">
                    <Stack spacing={1.5}>
                        {thirdPartySections.map(section => (
                            <Box
                                key={section.title}
                                sx={{
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: 2,
                                    p: 2,
                                    bgcolor: "background.paper"
                                }}
                            >
                                <Typography sx={{ fontWeight: 800, mb: 0.75 }}>{section.title}</Typography>
                                <Typography color="text.secondary">{section.body}</Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    Source: <SourceLinks sources={section.sources} />
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </PolicySection>

                <PolicySection title="Retention and deletion">
                    <Typography>
                        Login cookies and cached Discord login data expire according to the durations above or are cleared
                        during logout where supported. Notification settings, bot feature data, audit events, delivery
                        records, dedupe records, personal notes, and backups remain until removed by users, server
                        administrators where applicable, retention cleanup, or the deployment operator. For this
                        instance, privacy requests can be sent to{" "}
                        <ContactValue value={legalConfig.privacyContact} />.
                    </Typography>
                </PolicySection>

                <Box>
                    <Stack direction="row" spacing={2}>
                        <Link href="/" underline="hover">Back to login</Link>
                        <Link href="/terms" underline="hover">Terms</Link>
                    </Stack>
                </Box>
            </Stack>
        </Container>
    );
}
