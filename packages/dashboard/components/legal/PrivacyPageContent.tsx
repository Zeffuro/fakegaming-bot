"use client";

import React from "react";
import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { DashboardLanguageSelector } from "@/components/i18n/DashboardLanguageSelector";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { DashboardLocale } from "@/lib/i18n/localeStore";
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

const privacyCopy = {
    en: {
        pageTitle: "Privacy and cookies",
        publicIntro: "This page describes the official hosted instance of",
        publicIntroAt: "at",
        selfHostedIntro: "This page describes the upstream self-hosted dashboard software and its development defaults.",
        instanceScopeTitle: "Instance scope",
        operatorName: "Operator display name:",
        storageCountries: "Storage countries:",
        privacyContact: "Privacy contact:",
        selfHostedScope: "This upstream project is normally self-hosted. Self-hosted deployments are operated by their own host and must publish their own privacy information, including operator identity, contact method, storage countries, retention rules, and enabled integrations.",
        separateDeployments: "Self-hosted deployments are separate from this official hosted instance. They are operated by their own host and must publish their own privacy information.",
        storageFallback: "the storage location configured by the instance operator",
        cookiesTitle: "Cookies",
        cookiesIntro: "The dashboard only uses cookies needed for login and request security. It does not use advertising, tracking, or analytics cookies.",
        cookiePurpose: [
            "Keeps the dashboard authenticated for API requests.",
            "Keeps a dashboard login active across idle periods and lets logout revoke the session.",
            "Protects mutating dashboard requests against cross-site request forgery.",
        ],
        cookieDuration: ["20 minutes", "14 days idle, 30 days maximum", "14 days"],
        durationLabel: "Duration:",
        botDataTitle: "Bot and dashboard data",
        botData: [
            "Server administrators configure bot features by storing Discord server IDs, channel IDs, selected provider identifiers, notification settings, custom messages, pause state, cooldowns, quiet hours, and last-seen or last-notified markers. The dashboard also stores short-lived login/session data, Discord access tokens, cached Discord profiles, cached guild permission lists, audit events, worker status, delivery records, and dedupe records needed to run and troubleshoot the bot.",
            "User-submitted bot data, such as quotes, reminders, birthdays, linked Riot accounts, and anime subscriptions, is stored only for the feature that received it. Personal dashboard notes are stored under the Discord user ID that created them and are not tied to a Discord server. Do not store passwords, API keys, tokens, recovery codes, private keys, or other secrets in notes. Server administrators can remove many server-scoped configurations through the dashboard or bot management commands. Operators control database backups, logs, retention windows, and storage location for their own deployment.",
        ],
        thirdPartyTitle: "Third-party services and data sources",
        sourceLabel: "Source:",
        providers: {
            discord: "Discord login is used to read your Discord profile and server list so the dashboard can show servers where you can manage the bot. The bot and dashboard store Discord IDs, server IDs, channel IDs, role or permission data, cached profile and guild data, and bot configuration needed for server features. Discord API data is used only for bot and dashboard functionality. It is not sold, used for advertising profiles, disclosed to data brokers, or used to train AI models.",
            riot: "League of Legends and Teamfight Tactics features use Riot APIs to resolve Riot IDs and retrieve account, summoner, match, ranked, and TFT data. Stored linked-account data can include Discord user ID, Riot ID, legacy summoner name, region, and PUUID.",
            youtube: "This service uses YouTube API Services. YouTube notification features can monitor public channels through RSS and YouTube API data. Stored data can include Discord server ID, Discord channel ID, YouTube channel ID, last seen video ID, custom message, cooldown, quiet hours, pause state, and last notification time. The bot may fetch public video metadata such as title, thumbnail, publication time, duration, and view count. It does not ask users to sign in with YouTube or access private YouTube accounts. Use of YouTube features is subject to YouTube's terms and Google's privacy policy.",
            twitch: "Twitch notification features use Twitch Helix data to monitor public live status. Stored data can include Twitch username, Discord server ID, Discord channel ID, custom message, cooldown, quiet hours, pause state, live-state cache, and last notification time. Public stream metadata such as stream title, game, viewer count, profile image, thumbnail, and start time may be displayed in Discord. Twitch data is provided by Twitch. Fakegaming Bot is not affiliated with or endorsed by Twitch.",
            steam: "Steam news features monitor public Steam app news and use Steam app lookup data to help server administrators choose games. Stored data can include Steam App ID, optional game name, Discord server ID, Discord channel ID, last seen news item, last announcement timestamp, custom message, cooldown, quiet hours, and pause state. Steam-related data for this instance is stored in {storageCountries}. Fakegaming Bot does not request Steam passwords, Steam account login, or nonpublic Steam end-user account data. Steam data is provided as is and as available by Steam and Valve. Fakegaming Bot is not affiliated with or endorsed by Valve or Steam.",
            weather: "Weather commands send the requested location text to OpenWeather to retrieve current weather and forecast data. The current bot code may fall back to Open-Meteo geocoding and forecast services when OpenWeather is not configured or is unavailable. The bot does not create a persistent per-user weather profile from lookup history.",
            bluesky: "Bluesky notification features monitor public Bluesky accounts for new posts. Stored data can include the Bluesky handle, Discord server ID, Discord channel ID, last seen post URI and CID, custom message, cooldown, quiet hours, pause state, and last notification time. The bot uses public Bluesky data and does not access private Bluesky accounts.",
            anilist: "Anime features use AniList to search anime and manga titles and retrieve public airing schedule metadata. Stored data can include AniList media IDs, titles, selected channel or user reminder settings, reminder timing, pause state, and last-notified episode state so duplicate reminders are avoided.",
            patchNotes: "Patch-note features may check official game news or patch-note pages for supported games and post links, titles, images, and short Discord embed excerpts. Stored data can include the selected game, Discord server ID, Discord channel ID, pause state, and last notification state. Patch-note content belongs to the respective publishers. Fakegaming Bot is not affiliated with those publishers unless explicitly stated.",
            tiktok: "TikTok live notifications are available only when an instance operator configures TikTok credentials or cookies. This is an experimental, operator-controlled feature for public live-status alerts. Stored data can include TikTok username, Discord server ID, Discord channel ID, custom message, cooldown, quiet hours, pause state, live-state cache, and last notification time. Fakegaming Bot is not affiliated with or endorsed by TikTok and does not claim TikTok approval. Operators are responsible for deciding whether TikTok notifications are appropriate for their deployment.",
        },
        retentionTitle: "Retention and deletion",
        retentionPrefix: "Login cookies and cached Discord login data expire according to the durations above or are cleared during logout where supported. Notification settings, bot feature data, audit events, delivery records, dedupe records, personal notes, and backups remain until removed by users, server administrators where applicable, retention cleanup, or the deployment operator. For this instance, privacy requests can be sent to",
        backToLogin: "Back to login",
        terms: "Terms",
    },
    nl: {
        pageTitle: "Privacy en cookies",
        publicIntro: "Deze pagina beschrijft de officieel gehoste instantie van",
        publicIntroAt: "op",
        selfHostedIntro: "Deze pagina beschrijft de zelfgehoste upstream-dashboardsoftware en de standaardinstellingen voor ontwikkeling.",
        instanceScopeTitle: "Reikwijdte van de instantie",
        operatorName: "Weergavenaam van de beheerder:",
        storageCountries: "Landen van gegevensopslag:",
        privacyContact: "Privacycontact:",
        selfHostedScope: "Dit upstream-project wordt normaal gesproken zelf gehost. Zelfgehoste implementaties worden beheerd door hun eigen host en moeten eigen privacy-informatie publiceren, waaronder de identiteit van de beheerder, een contactmethode, landen van gegevensopslag, bewaartermijnen en ingeschakelde integraties.",
        separateDeployments: "Zelfgehoste implementaties staan los van deze officieel gehoste instantie. Ze worden beheerd door hun eigen host en moeten hun eigen privacy-informatie publiceren.",
        storageFallback: "de opslaglocatie die door de beheerder van de instantie is ingesteld",
        cookiesTitle: "Cookies",
        cookiesIntro: "Het dashboard gebruikt alleen cookies die nodig zijn voor aanmelden en verzoekbeveiliging. Het gebruikt geen advertentie-, tracking- of analysecookies.",
        cookiePurpose: [
            "Houdt het dashboard aangemeld voor API-verzoeken.",
            "Houdt een dashboardsessie actief tijdens inactieve perioden en maakt het mogelijk de sessie bij afmelden in te trekken.",
            "Beschermt wijzigende dashboardverzoeken tegen cross-site request forgery.",
        ],
        cookieDuration: ["20 minuten", "14 dagen inactiviteit, maximaal 30 dagen", "14 dagen"],
        durationLabel: "Duur:",
        botDataTitle: "Bot- en dashboardgegevens",
        botData: [
            "Serverbeheerders configureren botfuncties door Discord-server-ID's, kanaal-ID's, geselecteerde provider-ID's, meldingsinstellingen, aangepaste berichten, pauzestatus, afkoeltijden, stille uren en markeringen voor laatst gezien of laatst gemeld op te slaan. Het dashboard slaat ook kortlevende aanmeldings- en sessiegegevens, Discord-toegangstokens, gecachte Discord-profielen, gecachte lijsten met serverrechten, auditgebeurtenissen, workerstatus, bezorgingsregistraties en deduplicatieregistraties op die nodig zijn om de bot uit te voeren en problemen op te lossen.",
            "Door gebruikers ingevoerde botgegevens, zoals citaten, herinneringen, verjaardagen, gekoppelde Riot-accounts en anime-abonnementen, worden alleen opgeslagen voor de functie die ze heeft ontvangen. Persoonlijke dashboardnotities worden opgeslagen onder het Discord-gebruikers-ID waarmee ze zijn gemaakt en zijn niet aan een Discord-server gekoppeld. Sla geen wachtwoorden, API-sleutels, tokens, herstelcodes, privésleutels of andere geheimen op in notities. Serverbeheerders kunnen veel serverconfiguraties via het dashboard of botbeheercommando's verwijderen. Beheerders bepalen voor hun eigen implementatie de databaseback-ups, logboeken, bewaartermijnen en opslaglocatie.",
        ],
        thirdPartyTitle: "Diensten en gegevensbronnen van derden",
        sourceLabel: "Bron:",
        providers: {
            discord: "Discord-login wordt gebruikt om je Discord-profiel en serverlijst te lezen, zodat het dashboard servers kan tonen waarop je de bot kunt beheren. De bot en het dashboard slaan Discord-ID's, server-ID's, kanaal-ID's, rol- of rechtengegevens, gecachte profiel- en servergegevens en botconfiguratie voor serverfuncties op. Discord API-gegevens worden alleen gebruikt voor bot- en dashboardfunctionaliteit. Ze worden niet verkocht, gebruikt voor advertentieprofielen, verstrekt aan datahandelaren of gebruikt om AI-modellen te trainen.",
            riot: "League of Legends- en Teamfight Tactics-functies gebruiken Riot-API's om Riot-ID's te vinden en account-, summoner-, wedstrijd-, ranked- en TFT-gegevens op te halen. Opgeslagen gekoppelde accountgegevens kunnen het Discord-gebruikers-ID, Riot-ID, de oude summonernaam, regio en PUUID bevatten.",
            youtube: "Deze dienst gebruikt YouTube API Services. YouTube-meldingsfuncties kunnen openbare kanalen volgen via RSS en YouTube API-gegevens. Opgeslagen gegevens kunnen het Discord-server-ID, Discord-kanaal-ID, YouTube-kanaal-ID, laatst geziene video-ID, aangepaste bericht, afkoeltijd, stille uren, pauzestatus en laatste meldingstijd bevatten. De bot kan openbare videometagegevens ophalen, zoals titel, miniatuur, publicatietijd, duur en aantal weergaven. Gebruikers hoeven niet met YouTube aan te melden en de bot opent geen privé-YouTube-accounts. Op het gebruik van YouTube-functies zijn de voorwaarden van YouTube en het privacybeleid van Google van toepassing.",
            twitch: "Twitch-meldingsfuncties gebruiken Twitch Helix-gegevens om de openbare livestreamstatus te volgen. Opgeslagen gegevens kunnen de Twitch-gebruikersnaam, het Discord-server-ID, Discord-kanaal-ID, aangepaste bericht, afkoeltijd, stille uren, pauzestatus, live-statuscache en laatste meldingstijd bevatten. Openbare streammetagegevens zoals streamtitel, game, aantal kijkers, profielafbeelding, miniatuur en starttijd kunnen in Discord worden weergegeven. Twitch-gegevens worden door Twitch geleverd. Fakegaming Bot is niet verbonden met of goedgekeurd door Twitch.",
            steam: "Steam-nieuwsfuncties volgen openbaar Steam-appnieuws en gebruiken Steam-appzoekgegevens om serverbeheerders games te laten kiezen. Opgeslagen gegevens kunnen Steam App ID, optionele gamenaam, Discord-server-ID, Discord-kanaal-ID, laatst gezien nieuwsitem, tijdstip van de laatste aankondiging, aangepast bericht, afkoeltijd, stille uren en pauzestatus bevatten. Steam-gerelateerde gegevens voor deze instantie worden opgeslagen in {storageCountries}. Fakegaming Bot vraagt niet om Steam-wachtwoorden, Steam-accountlogin of niet-openbare Steam-eindgebruikersgegevens. Steam-gegevens worden door Steam en Valve geleverd zoals ze zijn en voor zover beschikbaar. Fakegaming Bot is niet verbonden met of goedgekeurd door Valve of Steam.",
            weather: "Weercommando's sturen de opgevraagde locatietekst naar OpenWeather om het huidige weer en voorspellingen op te halen. De huidige botcode kan terugvallen op de geocoderings- en voorspellingsdiensten van Open-Meteo wanneer OpenWeather niet is geconfigureerd of niet beschikbaar is. De bot maakt geen permanent weerprofiel per gebruiker uit de zoekgeschiedenis.",
            bluesky: "Bluesky-meldingsfuncties volgen openbare Bluesky-accounts voor nieuwe berichten. Opgeslagen gegevens kunnen de Bluesky-handle, het Discord-server-ID, Discord-kanaal-ID, de URI en CID van het laatst geziene bericht, aangepast bericht, afkoeltijd, stille uren, pauzestatus en laatste meldingstijd bevatten. De bot gebruikt openbare Bluesky-gegevens en heeft geen toegang tot privé-Bluesky-accounts.",
            anilist: "Animefuncties gebruiken AniList om anime- en mangatitels te zoeken en openbare uitzendplanningsgegevens op te halen. Opgeslagen gegevens kunnen AniList-media-ID's, titels, geselecteerde instellingen voor kanaal- of gebruikersherinneringen, herinneringstijd, pauzestatus en laatst gemelde aflevering bevatten om dubbele herinneringen te voorkomen.",
            patchNotes: "Patchnotitiefuncties kunnen officiële gamenieuws- of patchnotitiepagina's voor ondersteunde games controleren en links, titels, afbeeldingen en korte Discord-embedfragmenten plaatsen. Opgeslagen gegevens kunnen de geselecteerde game, het Discord-server-ID, Discord-kanaal-ID, pauzestatus en laatste meldingsstatus bevatten. De inhoud van patchnotities behoort toe aan de betreffende uitgevers. Fakegaming Bot is niet verbonden met die uitgevers, tenzij dit uitdrukkelijk wordt vermeld.",
            tiktok: "TikTok-livemeldingen zijn alleen beschikbaar wanneer een instantiebeheerder TikTok-inloggegevens of cookies configureert. Dit is een experimentele, door de beheerder aangestuurde functie voor openbare live-statusmeldingen. Opgeslagen gegevens kunnen de TikTok-gebruikersnaam, het Discord-server-ID, Discord-kanaal-ID, aangepast bericht, afkoeltijd, stille uren, pauzestatus, live-statuscache en laatste meldingstijd bevatten. Fakegaming Bot is niet verbonden met of goedgekeurd door TikTok en claimt geen goedkeuring van TikTok. Beheerders zijn verantwoordelijk voor de beslissing of TikTok-meldingen geschikt zijn voor hun implementatie.",
        },
        retentionTitle: "Bewaring en verwijdering",
        retentionPrefix: "Aanmeldcookies en gecachte Discord-aanmeldgegevens verlopen volgens de bovenstaande termijnen of worden, waar ondersteund, bij afmelden gewist. Meldingsinstellingen, botfunctiegegevens, auditgebeurtenissen, bezorgingsregistraties, deduplicatieregistraties, persoonlijke notities en back-ups blijven bestaan totdat ze worden verwijderd door gebruikers, waar van toepassing serverbeheerders, bewaartermijnopschoning of de implementatiebeheerder. Privacyverzoeken voor deze instantie kunnen worden gestuurd naar",
        backToLogin: "Terug naar inloggen",
        terms: "Voorwaarden",
    },
} as const satisfies Record<DashboardLocale, PrivacyCopy>;

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

function interpolateStorageCountries(value: string, storageCountries: string): string {
    return value.replace("{storageCountries}", storageCountries);
}

export function PrivacyPageContent({ legalConfig }: { legalConfig: PublicLegalConfig }) {
    const { locale } = useDashboardI18n();
    const copy = privacyCopy[locale];
    const storageCountries = legalConfig.storageCountries.length > 0 ? legalConfig.storageCountries.join(", ") : copy.storageFallback;

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
                                    {interpolateStorageCountries(copy.providers[section.id], storageCountries)}
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
