import {CanvasRenderingContext2D, createCanvas, loadImage} from 'canvas';
import {getAsset} from '../../../utils/assetCache.js';
import {getItemData} from '../../../cache/leagueItemDataCache.js';
import {getSummonerSpellData} from '../../../cache/leagueSummonerSpellDataCache.js';
import {getPerkStylesData} from '../../../cache/leaguePerkStylesDataCache.js';
import {getPerksData} from '../../../cache/leaguePerksDataCache.js';
import {getAugmentData} from '../../../cache/leagueAugmentDataCache.js';
import {queueMapper, gameModeConvertMap} from '../../../constants/leagueMappers.js';
import {
    drawItemSlotBackground,
    drawClippedImage,
    drawCircle,
    drawRoundedRect,
    drawVerticalList,
    drawHorizontalList,
    drawGridList,
    drawRoundedBoxLabel,
    applyShadow,
    clearShadow
} from '../../../utils/canvasExtensions.js';
import {timeAgo, formatDuration} from '../../../utils/generalUtils.js';

const ROW_HEIGHT = 110;
const WIDTH = 820;
const PADDING = 16;
const ITEM_SIZE = 32;
const ITEM_GAP = 2;
const FONT = '16px "Roboto", Arial';
const NUMBER_FONT_FAMILY = '"Roboto", Arial, sans-serif';
const TEAM_FONT_FAMILY = '"Noto Sans", "Segoe UI Symbol", "Arial Unicode MS", Arial, sans-serif';
const COMMUNITY_DRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';

// Helper to build font strings
function fontString({size = 14, weight = '', italic = false, family = TEAM_FONT_FAMILY}: {
    size?: number,
    weight?: string,
    italic?: boolean,
    family?: string
} = {}) {
    return `${italic ? 'italic ' : ''}${weight ? weight + ' ' : ''}${size}px ${family}`.trim();
}

function getResultColor(win: boolean, mode: string) {
    if (mode === 'Arena') return win ? '#2d3e5e' : '#7c3a3a';
    return win ? '#2d3e5e' : '#7c3a3a';
}

function getModeColor(mode: string) {
    if (mode === 'ARAM') return '#f9b44c';
    if (mode.includes('Ranked')) return '#4fa3ff';
    if (mode === 'Arena') return '#e67e22';
    return '#888';
}

export async function generateLeagueHistoryImage(matches: any[], identity: any): Promise<Buffer> {
    const itemsJson = await getItemData();
    const summonerSpellsJson = await getSummonerSpellData();
    const perkStylesJson = await getPerkStylesData();
    const perksJson = await getPerksData();

    const height = matches.length * ROW_HEIGHT + PADDING * 2;
    const canvas = createCanvas(WIDTH, height);
    const ctx = canvas.getContext('2d');
    ctx.font = FONT;
    ctx.textBaseline = 'top';

    await drawVerticalList(ctx, matches, PADDING, PADDING, ROW_HEIGHT, async (match, _x, y) => {
        const participant = match.info.participants.find((p: any) => p.puuid === identity.puuid);
        if (!participant) return;

        drawRowBackground(ctx, participant.win, match.info.gameMode, PADDING, y, WIDTH - PADDING * 2, ROW_HEIGHT - 8, 8);

        await drawMatchInfoLeft(ctx, match, participant, PADDING + 8, y + 8);

        const champX = PADDING + 100;
        const champPortraitSize = Math.floor(ITEM_SIZE * 1.75);
        const champY = y + 4;
        await drawChampionIconWithLevel(ctx, participant.championId, participant.champLevel, champX, champY, champPortraitSize);

        const spellSize = Math.floor(champPortraitSize / 2);
        const spellGap = 2;
        let afterSpellsX: number;
        let afterSpellsY = champY;
        let augOrRuneWidth = spellSize;

        if (match.info.gameMode === 'CHERRY') {
            afterSpellsX = champX + champPortraitSize + 8;
            const augmentIds = [];
            for (let i = 0; i < 6; i++) {
                const aug = participant[`playerAugment${i}`];
                if (aug) augmentIds.push(aug);
            }
            const augmentSize = Math.floor(champPortraitSize / 2);
            const augmentGap = 2;
            await drawAugments(ctx, augmentIds, afterSpellsX, afterSpellsY, augmentSize, augmentGap);
            augOrRuneWidth = augmentSize * 2 + augmentGap;
        } else {
            const spellX = champX + champPortraitSize + 8;
            const summonerSpellIds = [participant.summoner1Id, participant.summoner2Id];
            await drawSummonerSpells(ctx, summonerSpellIds, summonerSpellsJson, spellX, champY, spellSize, spellGap);

            afterSpellsX = spellX + spellSize + 8;
            const runeSize = spellSize;
            const perkStyles = participant.perks?.styles || [];
            await drawRunes(ctx, perkStyles, perksJson, perkStylesJson, afterSpellsX, afterSpellsY, runeSize, spellGap);

            augOrRuneWidth = runeSize;
        }
        const kdaX = afterSpellsX + augOrRuneWidth + 20;
        const kdaY = champY + 8;
        drawKDA(ctx, participant, kdaX, kdaY);

        const statsX = kdaX + 110;
        const statsY = champY + 2;
        await drawStatsVerticalList(ctx, match, participant, statsX, statsY);

        const itemsY = champY + champPortraitSize + 8;
        const itemIds = Array.from({length: 7}, (_, j) => participant[`item${j}`]);
        const itemImages = await preloadAssets(
            itemIds,
            itemsJson,
            (entry) => entry.iconPath,
            (iconPath, id) => communityDragonUrlFromAssetPath(iconPath),
            'item'
        );
        await drawHorizontalList(ctx, itemImages, champX, itemsY, ITEM_SIZE + ITEM_GAP, (itemImg, x, y) => {
            drawItemSlotBackground(ctx, x, y, ITEM_SIZE, 8, '#222');
            drawClippedImage(ctx, itemImg, x, y, ITEM_SIZE, 'rounded', 8);
        });
        drawMultikillLabelBox(ctx, participant, champX, itemsY, ITEM_SIZE, ITEM_GAP);

        const rightX = WIDTH - 280;
        if (match.info.gameMode === 'CHERRY') {
            const arenaParticipants = match.info.participants.filter((p: any) => p.placement >= 1 && p.placement <= 4);
            const subTeamMap: Record<string, any[]> = {};
            for (const p of arenaParticipants) {
                if (!subTeamMap[p.playerSubteamId]) subTeamMap[p.playerSubteamId] = [];
                subTeamMap[p.playerSubteamId].push(p);
            }
            const teamPairs = Object.values(subTeamMap).sort((a, b) => {
                const aPlace = Math.min(...a.map(p => p.placement));
                const bPlace = Math.min(...b.map(p => p.placement));
                return aPlace - bPlace;
            });
            await drawCherryTeamsWithIcons(ctx, teamPairs, rightX, y + 3, identity.puuid, '#fff');
        } else {
            const team1 = match.info.participants.filter((p: any) => p.teamId === 100);
            const team2 = match.info.participants.filter((p: any) => p.teamId === 200);
            await drawTeamNamesWithIcons(ctx, team1, rightX, y + 3, identity.puuid, '#fff');
            await drawTeamNamesWithIcons(ctx, team2, rightX + 120, y + 3, identity.puuid, '#fff');
        }
    });
    return canvas.toBuffer('image/png');
}

async function drawMatchInfoLeft(
    ctx: CanvasRenderingContext2D,
    match: any,
    participant: any,
    x: number,
    y: number
) {
    let mode = '';
    if (match.info.queueId && queueMapper[match.info.queueId]) {
        mode = queueMapper[match.info.queueId];
    } else if (match.info.gameMode && gameModeConvertMap[match.info.gameMode]) {
        mode = gameModeConvertMap[match.info.gameMode];
    } else {
        mode = match.info.gameMode || 'Unknown';
    }
    let ago = '';
    if (match.info.gameEndTimestamp) {
        ago = timeAgo(match.info.gameEndTimestamp);
    }
    const result = participant.win ? 'Victory' : 'Defeat';
    const durationSec = participant.timePlayed || Math.floor((match.info.gameDuration || 0) / 1000);
    const matchLength = formatDuration(durationSec);
    const resultColor = participant.win ? '#4fd18b' : '#e05c5c';
    const modeColor = participant.win ? '#4fa3ff' : '#e05c5c';
    const timeAgoColor = '#e0e0e0';
    const matchLengthColor = '#bdbdbd';
    const infoLines = [
        {text: mode, font: fontString({size: 16, weight: 'bold', family: NUMBER_FONT_FAMILY}), color: modeColor},
        {text: ago, font: fontString({size: 14, family: NUMBER_FONT_FAMILY}), color: timeAgoColor},
        {text: result, font: fontString({size: 15, weight: 'bold', family: NUMBER_FONT_FAMILY}), color: resultColor},
        {text: matchLength, font: fontString({size: 14, family: NUMBER_FONT_FAMILY}), color: matchLengthColor},
    ];
    await drawVerticalList(ctx, infoLines, x, y, 22, (line, lx, ly) => {
        ctx.save();
        ctx.font = line.font;
        ctx.fillStyle = line.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(line.text, lx, ly);
        ctx.restore();
    });
}

async function drawTeamNamesWithIcons(ctx: CanvasRenderingContext2D, team: any[], x: number, y: number, playerPuuid: string, color: string) {
    const rowHeight = 20;
    const iconSize = 16;
    const nameOffsetX = iconSize + 8;
    ctx.font = fontString({size: 14, family: TEAM_FONT_FAMILY});
    // Preload all champion images for the team
    const champImages = await Promise.all(team.map(async participant => {
        const champIconUrl = `${COMMUNITY_DRAGON_BASE}/v1/champion-icons/${participant.championId}.png`;
        const champIconAsset = await getAsset(champIconUrl, `${participant.championId}.png`, 'champion');
        return champIconAsset.buffer ? await loadImage(champIconAsset.buffer) : undefined;
    }));
    await drawVerticalList(ctx, team, x, y, rowHeight, (participant, px, py, i) => {
        const champImg = champImages[i];
        if (champImg) {
            if (participant.puuid === playerPuuid) {
                drawClippedImage(ctx, champImg, px, py, iconSize, 'circle');
            } else {
                drawClippedImage(ctx, champImg, px, py, iconSize, 'rounded', 4);
            }
        }
        ctx.fillStyle = participant.puuid === playerPuuid ? color : '#9e9eb1';
        ctx.font = fontString({size: 14, family: TEAM_FONT_FAMILY});
        ctx.fillText(truncateName(participant.riotIdGameName), px + nameOffsetX, py - 3);
    });
}

async function drawCherryTeamsWithIcons(ctx: CanvasRenderingContext2D, teamPairs: any[][], x: number, y: number, playerPuuid: string, color: string) {
    const rowHeight = 20;
    const iconSize = 16;
    const nameOffsetX = iconSize + 8;
    ctx.font = fontString({size: 14, family: TEAM_FONT_FAMILY});
    await drawVerticalList(ctx, teamPairs, x, y, rowHeight, async (pair, px, py) => {
        // Always draw two slots per row, even if a pair is missing a player
        const safePair = [pair[0], pair[1] || {}];
        // Preload champion images for the pair
        const champImages = await Promise.all(safePair.map(async participant => {
            if (!participant || !participant.championId) return undefined;
            const champIconUrl = `${COMMUNITY_DRAGON_BASE}/v1/champion-icons/${participant.championId}.png`;
            const champIconAsset = await getAsset(champIconUrl, `${participant.championId}.png`, 'champion');
            return champIconAsset.buffer ? await loadImage(champIconAsset.buffer) : undefined;
        }));
        await drawHorizontalList(ctx, safePair, px, py, 120, (participant, x, y, i) => {
            const champImg = champImages[i];
            if (champImg) {
                if (participant.puuid === playerPuuid) {
                    drawClippedImage(ctx, champImg, x, y, iconSize, 'circle');
                } else {
                    drawClippedImage(ctx, champImg, x, y, iconSize, 'rounded', 4);
                }
            }
            ctx.font = fontString({size: 14, family: TEAM_FONT_FAMILY});
            if (participant && participant.riotIdGameName) {
                ctx.fillStyle = participant.puuid === playerPuuid ? color : '#9e9eb1';
                ctx.fillText(truncateName(participant.riotIdGameName), x + nameOffsetX, y - 3);
            }
        });
    });
}

function truncateName(name: string, maxLen: number = 14): string {
    // Use a font stack that supports more Unicode symbols
    // Truncate but preserve valid Unicode
    return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

function communityDragonUrlFromAssetPath(assetPath: string): string {
    // Remove the leading asset prefix and fully lowercase the rest
    let relPath = assetPath.replace(/^\/lol-game-data\/assets\//i, '');
    relPath = relPath.replace(/\\+/g, '/'); // Normalize backslashes to slashes
    relPath = relPath.toLowerCase(); // Lowercase the entire path for CommunityDragon
    return COMMUNITY_DRAGON_BASE + relPath;
}

async function preloadAssets(
    ids: (number | string)[],
    jsonData: any[],
    getIconPath: (entry: any) => string | undefined,
    buildUrl: (iconPath: string, id: number | string) => string,
    assetType: string
): Promise<(import('canvas').Image | undefined)[]> {
    const images: (import('canvas').Image | undefined)[] = [];
    for (const id of ids) {
        const entry = jsonData.find((item: any) => item.id === id);
        const iconPath = entry ? getIconPath(entry) : undefined;
        if (iconPath) {
            const assetUrl = buildUrl(iconPath, id);
            const asset = await getAsset(assetUrl, `${id}.png`, assetType);
            if (asset.buffer) {
                try {
                    const img = await loadImage(asset.buffer);
                    images.push(img);
                    continue;
                } catch {
                }
            }
        }
        images.push(undefined);
    }
    return images;
}

// Drawing helpers (ordered for clarity)

function drawRowBackground(ctx: CanvasRenderingContext2D, win: boolean, mode: string, x: number, y: number, w: number, h: number, radius: number) {
    // Draw background color first (no shadow)
    ctx.save();
    ctx.fillStyle = getResultColor(win, mode);
    drawRoundedRect(ctx, x, y, w, h, radius + 4);
    ctx.restore();
}

function drawKDA(ctx: CanvasRenderingContext2D, participant: any, x: number, y: number) {
    ctx.font = fontString({size: 20, weight: 'bold', family: NUMBER_FONT_FAMILY});
    ctx.textBaseline = 'top';
    // Calculate widths for proper centering
    const killsText = `${participant.kills}`;
    const slash1 = ' / ';
    const deathsText = `${participant.deaths}`;
    const slash2 = ' / ';
    const assistsText = `${participant.assists}`;
    const kdaText = `${killsText}${slash1}${deathsText}${slash2}${assistsText}`;
    const totalWidth = ctx.measureText(kdaText).width;
    let drawX = x;
    // Draw kills
    ctx.fillStyle = '#fff';
    ctx.fillText(killsText, drawX, y);
    drawX += ctx.measureText(killsText).width;
    // Draw first slash
    ctx.fillStyle = '#fff';
    ctx.fillText(slash1, drawX, y);
    drawX += ctx.measureText(slash1).width;
    // Draw deaths in red
    ctx.fillStyle = '#e05c5c';
    ctx.fillText(deathsText, drawX, y);
    drawX += ctx.measureText(deathsText).width;
    // Draw second slash
    ctx.fillStyle = '#fff';
    ctx.fillText(slash2, drawX, y);
    drawX += ctx.measureText(slash2).width;
    // Draw assists
    ctx.fillStyle = '#fff';
    ctx.fillText(assistsText, drawX, y);
    // KDA ratio below
    ctx.font = fontString({size: 12, family: NUMBER_FONT_FAMILY}); // smaller
    ctx.fillStyle = '#bdbdbd'; // lighter gray
    ctx.fillText(`${((participant.kills + participant.assists) / Math.max(1, participant.deaths)).toFixed(2)} KDA`, x, y + 24);
}

async function drawChampionIconWithLevel(ctx: CanvasRenderingContext2D, championId: number, champLevel: number, x: number, y: number, size: number) {
    const LEVEL_CIRCLE_RATIO = 0.22;
    const LEVEL_CIRCLE_OFFSET = 8;
    const LEVEL_CIRCLE_COLOR = '#222';
    const LEVEL_CIRCLE_OPACITY = 0.85;
    const LEVEL_CIRCLE_SHADOW_BLUR = 8;
    const LEVEL_CIRCLE_SHADOW_COLOR = 'rgba(0,0,0,0.5)';
    const LEVEL_TEXT_COLOR = '#fff';
    const LEVEL_TEXT_SHADOW_COLOR = 'rgba(0,0,0,0.7)';
    const LEVEL_TEXT_SHADOW_BLUR = 3;

    const champIconUrl = `${COMMUNITY_DRAGON_BASE}/v1/champion-icons/${championId}.png`;
    const champIconAsset = await getAsset(champIconUrl, `${championId}.png`, 'champion');
    if (!champIconAsset.buffer) return;
    const champImg = await loadImage(champIconAsset.buffer);
    drawClippedImage(ctx, champImg, x, y, size, 'circle');

    // Calculate level circle position and size
    const radius = Math.floor(size * LEVEL_CIRCLE_RATIO);
    const centerX = x + size - radius - LEVEL_CIRCLE_OFFSET + radius;
    const centerY = y + size - radius - LEVEL_CIRCLE_OFFSET + radius;

    // Draw level circle with shadow
    ctx.save();
    applyShadow(ctx, LEVEL_CIRCLE_SHADOW_COLOR, LEVEL_CIRCLE_SHADOW_BLUR);
    drawCircle(ctx, centerX, centerY, radius, LEVEL_CIRCLE_COLOR, LEVEL_CIRCLE_OPACITY);
    clearShadow(ctx);

    // Draw level number with subtle shadow
    ctx.font = fontString({size: Math.floor(radius * 1.2), weight: 'bold'});
    ctx.fillStyle = LEVEL_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    applyShadow(ctx, LEVEL_TEXT_SHADOW_COLOR, LEVEL_TEXT_SHADOW_BLUR);
    ctx.fillText(String(champLevel), centerX, centerY);
    ctx.restore();
}

async function drawStatsVerticalList(
    ctx: CanvasRenderingContext2D,
    match: any,
    participant: any,
    x: number,
    y: number
) {
    let lines;
    if (match.info.gameMode === 'CHERRY') {
        const placement = participant.placement || 0;
        const placementText = placement > 0 ? `Placement: ${placement}` : 'Placement: -';
        const statFont = fontString({size: 15, weight: 'bold', family: NUMBER_FONT_FAMILY});
        const statColor = '#e05c5c';
        lines = [
            {text: placementText, color: statColor, font: statFont}
        ];
    } else {
        const team = match.info.participants.filter((p: any) => p.teamId === participant.teamId);
        const teamKills = team.reduce((sum: number, p: any) => sum + (p.kills || 0), 0);
        const killP = teamKills > 0 ? Math.round(((participant.kills + participant.assists) / teamKills) * 100) : 0;
        const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
        const durationMin = Math.max(1, (participant.timePlayed || Math.floor((match.info.gameDuration || 0) / 1000)) / 60);
        const csPerMin = cs / durationMin;
        const vision = participant.visionScore || 0;
        let rank = participant.tier ? `${participant.tier} ${participant.rank || ''}`.trim() : '';
        if (!rank && participant.leagueTier) rank = participant.leagueTier;
        if (!rank) rank = 'Unranked';
        const statFont = fontString({size: 13, family: NUMBER_FONT_FAMILY});
        const statFontBold = fontString({size: 13, weight: 'bold', family: NUMBER_FONT_FAMILY});
        const statColor = '#ccc';
        const killPColor = '#e05c5c';
        lines = [
            {text: `${killP}% Kill P.`, color: killPColor, font: statFontBold},
            {text: `${cs} CS (${csPerMin.toFixed(1)})`, color: statColor, font: statFont},
            {text: `${vision} Vision`, color: statColor, font: statFont},
            {text: rank, color: rank === 'Unranked' ? '#bdbdbd' : statColor, font: statFontBold},
        ];
    }
    await drawVerticalList(ctx, lines, x, y, 18, (line, lx, ly) => {
        ctx.save();
        ctx.font = line.font;
        ctx.fillStyle = line.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(line.text, lx, ly);
        ctx.restore();
    });
}

async function drawSummonerSpells(ctx: CanvasRenderingContext2D, spellIds: number[], summonerSpellsJson: any[], x: number, y: number, size: number, gap: number) {
    const summonerSpellImages = await preloadAssets(
        spellIds,
        summonerSpellsJson,
        (entry) => entry.iconPath,
        (iconPath, id) => communityDragonUrlFromAssetPath(iconPath),
        'summonerspell'
    );
    for (let i = 0; i < summonerSpellImages.length; i++) {
        const spellImg = summonerSpellImages[i];
        drawClippedImage(ctx, spellImg, x, y, size, 'rounded', 6);
        y += size + gap;
    }
}

async function drawRunes(ctx: CanvasRenderingContext2D, perkStyles: any[], perksJson: any[], perkStylesJson: any, x: number, y: number, size: number, gap: number) {
    const keystoneId = perkStyles[0]?.selections?.[0]?.perk;
    const keystoneImages = await preloadAssets(
        [keystoneId],
        perksJson,
        (entry) => entry.iconPath,
        (iconPath, id) => communityDragonUrlFromAssetPath(iconPath),
        'keystone'
    );
    const secondaryRuneId = perkStyles[1]?.style;
    const secondaryRuneImages = await preloadAssets(
        [secondaryRuneId],
        perkStylesJson.styles,
        (entry) => entry.iconPath,
        (iconPath, id) => communityDragonUrlFromAssetPath(iconPath),
        'perkstyle'
    );
    await drawVerticalList(ctx, [keystoneImages[0], secondaryRuneImages[0]], x, y, size + gap, (img, x, y, r) => {
        if (img) {
            if (r === 0) {
                drawCircle(ctx, x + size / 2, y + size / 2, size / 2, '#000', 0.85);
            }
            drawClippedImage(ctx, img, x, y, size, 'circle');
        }
    });
}

// Helper for drawing augments (Arena/CHERRY mode)
async function drawAugments(ctx: CanvasRenderingContext2D, augmentIds: (string | number)[], x: number, y: number, size: number, gap: number) {
    const augmentData = await getAugmentData();
    const images = await preloadAssets(
        augmentIds,
        augmentData,
        (entry) => entry.augmentSmallIconPath,
        (iconPath, id) => communityDragonUrlFromAssetPath(iconPath),
        'augment'
    );
    // Use drawGridList for a 3x2 grid (3 rows, 2 columns)
    const columns = 2;
    const cellWidth = size + gap;
    const cellHeight = size + gap;
    await drawGridList(ctx, images, x, y, columns, cellWidth, cellHeight, (img, drawX, drawY) => {
        if (img) {
            drawCircle(ctx, drawX + size / 2, drawY + size / 2, size / 2, '#000', 0.85);
            drawClippedImage(ctx, img, drawX, drawY, size, 'circle');
        }
    });
}

// Helper to get the multikill label for a participant
function getMultikillLabel(participant: any): string {
    const multikillLabels = [
        {key: 'pentaKills', label: 'Penta Kill'},
        {key: 'quadraKills', label: 'Quadra Kill'},
        {key: 'tripleKills', label: 'Triple Kill'},
        {key: 'doubleKills', label: 'Double Kill'}
    ];
    for (const {key, label} of multikillLabels) {
        if (participant[key] && participant[key] > 0) {
            return label;
        }
    }
    return '';
}

// Draws a multikill label (if any) to the right of the items in a rounded rectangle box
function drawMultikillLabelBox(ctx: CanvasRenderingContext2D, participant: any, champX: number, itemsY: number, ITEM_SIZE: number, ITEM_GAP: number) {
    const multikillLabel = getMultikillLabel(participant);
    if (multikillLabel) {
        const itemsCount = 7;
        const itemsTotalWidth = itemsCount * ITEM_SIZE + (itemsCount - 1) * ITEM_GAP;
        // Use drawRoundedBoxLabel for consistent style
        const font = fontString({size: 16, weight: 'bold', family: NUMBER_FONT_FAMILY});
        const paddingX = 14; // less padding
        const paddingY = 4;
        const borderRadius = 12;
        ctx.font = font;
        const labelWidth = ctx.measureText(multikillLabel).width + paddingX * 2;
        const labelHeight = parseInt(font.match(/\d+/)?.[0] || '16', 10) + paddingY * 2;
        const labelX = champX + itemsTotalWidth + 16;
        const labelY = itemsY + (ITEM_SIZE - labelHeight) / 2;
        drawRoundedBoxLabel(ctx, multikillLabel, labelX, labelY, {
            font,
            textColor: '#fff',
            bgColor: '#c0392b',
            paddingX,
            paddingY,
            borderRadius
        });
    }
}
