import {CanvasRenderingContext2D, createCanvas, loadImage} from 'canvas';
import {getAsset} from '../../../utils/assetCache.js';
import {getItemData} from '../../../cache/leagueItemDataCache.js';
import {getSummonerSpellData} from '../../../cache/leagueSummonerSpellDataCache.js';
import {getPerkStylesData} from '../../../cache/leaguePerkStylesDataCache.js';
import {getPerksData} from '../../../cache/leaguePerksDataCache.js';
import {queueMapper, gameModeConvertMap} from '../../../constants/leagueMappers.js';
import {
    drawItemSlotBackground,
    drawClippedImage,
    drawCircle,
    drawRoundedRect,
    drawVerticalList,
    drawHorizontalList
} from '../../../utils/canvasExtensions.js';

const ROW_HEIGHT = 110;
const WIDTH = 820;
const PADDING = 16;
const ICON_SIZE = 64;
const ITEM_SIZE = 32;
const ITEM_GAP = 2;
const FONT = '16px "Roboto", Arial';
const COMMUNITY_DRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';

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

    await drawVerticalList(ctx, matches, PADDING, PADDING, ROW_HEIGHT, async (match, _x, y, i) => {
        // Find participant
        const participant = match.info.participants.find((p: any) => p.puuid === identity.puuid);
        if (!participant) return;

        // Row background (rounded)
        drawRowBackground(ctx, participant.win, match.info.gameMode, PADDING, y, WIDTH - PADDING * 2, ROW_HEIGHT - 8, 8);

        // Game mode label
        const queueLabel = queueMapper[match.info.queueId];
        const modeLabel = gameModeConvertMap[match.info.gameMode];
        const gameTypeLabel = queueLabel || modeLabel || match.info.gameMode;

        // Game mode color
        ctx.fillStyle = getModeColor(gameTypeLabel);
        ctx.font = 'bold 18px "Roboto", Arial';
        ctx.fillText(gameTypeLabel, PADDING + 8, y + 8);

        // Champion icon above items, clipped as circle, smaller and padded Y
        let champX = PADDING + ICON_SIZE + 180;
        let champPortraitSize = Math.floor(ITEM_SIZE * 1.75); // smaller
        let champY = y + 3;
        await drawChampionIconWithLevel(ctx, participant.championId, participant.champLevel, champX, champY, champPortraitSize);

        // Summoner spell icons for main player (vertically stacked to the right of champion icon)
        const spellSize = Math.floor(champPortraitSize / 2);
        const spellGap = 2;
        const spellX = champX + champPortraitSize + 8;
        let spellY = champY;
        const summonerSpellIds = [participant.summoner1Id, participant.summoner2Id];
        await drawSummonerSpells(ctx, summonerSpellIds, summonerSpellsJson, spellX, spellY, spellSize, spellGap);

        // Rune tree icons next to summoner spells
        const runeSize = spellSize;
        const runeGap = spellGap;
        const runeX = spellX + spellSize + 8;
        const perkStyles = participant.perks?.styles || [];
        await drawRunes(ctx, perkStyles, perksJson, perkStylesJson, runeX, champY, runeSize, runeGap);

        // Move result and multikill to left, above KDA
        ctx.font = 'bold 16px "Roboto", Arial';
        ctx.fillStyle = participant.win ? '#4fd18b' : '#e05c5c';
        ctx.fillText(participant.win ? 'Victory' : 'Defeat', PADDING + ICON_SIZE + 24, y + 8);

        // Multikill label (if any)
        drawMultikillLabel(ctx, participant, PADDING + ICON_SIZE + 120, y + 8);

        // KDA
        drawKDA(ctx, participant, PADDING + ICON_SIZE + 24, y + 38);

        // Game time (move to right of team names)
        drawGameTime(ctx, match.info.gameDuration, WIDTH - 40, y + 8);

        // Items with backgrounds and borders at the bottom (properly contained)
        // Place items so they are visually centered above the rounded bottom
        const itemsY = y + ROW_HEIGHT - ITEM_SIZE - 8 / 2;
        const itemIds = Array.from({length: 7}, (_, j) => participant[`item${j}`]);
        const itemImages = await preloadAssets(
            itemIds,
            itemsJson,
            (entry) => entry.iconPath,
            (iconPath, id) => communityDragonUrlFromAssetPath(iconPath),
            'item'
        );
        await drawHorizontalList(ctx, itemImages, PADDING + ICON_SIZE + 180, itemsY, ITEM_SIZE + ITEM_GAP, (itemImg, x, y, j) => {
            drawItemSlotBackground(ctx, x, y, ITEM_SIZE, 8, '#222');
            drawClippedImage(ctx, itemImg, x, y, ITEM_SIZE, 'rounded', 8);
            // No border for now
        });

        // Team names on the right, highlight player
        const team1 = match.info.participants.filter((p: any) => p.teamId === 100);
        const team2 = match.info.participants.filter((p: any) => p.teamId === 200);

        // Draw both teams on the right with icons, adjust spacing to prevent overflow
        const rightX = WIDTH - 300;
        await drawTeamNamesWithIcons(ctx, team1, rightX, y + 3, identity.puuid, '#4fd18b');
        await drawTeamNamesWithIcons(ctx, team2, rightX + 150, y + 3, identity.puuid, '#e05c5c');
    });

    return canvas.toBuffer('image/png');
}

async function drawTeamNamesWithIcons(ctx: CanvasRenderingContext2D, team: any[], x: number, y: number, playerPuuid: string, color: string) {
    const rowHeight = 20;
    const iconSize = 16;
    const nameOffsetX = iconSize + 8;
    ctx.font = '14px "Noto Sans", "Segoe UI Symbol", "Arial Unicode MS", Arial, sans-serif';
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
        ctx.fillStyle = participant.puuid === playerPuuid ? color : '#eee';
        ctx.fillText(truncateName(participant.riotIdGameName), px + nameOffsetX, py - 3);
    });
}

function truncateName(name: string, maxLen: number = 16): string {
    // Use a font stack that supports more Unicode symbols
    // Truncate but preserve valid Unicode
    return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

function communityDragonUrlFromAssetPath(assetPath: string): string {
    const COMMUNITY_DRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';
    let relPath = assetPath.replace(/^\/lol-game-data\/assets\//i, '');
    relPath = relPath.replace(/([A-Z])/g, (m) => m.toLowerCase());
    relPath = relPath.replace(/ /g, '');
    relPath = relPath.replace(/\\+/g, '/');
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

// Extracted helper for champion icon drawing
async function drawChampionIconWithLevel(ctx: CanvasRenderingContext2D, championId: number, champLevel: number, x: number, y: number, size: number) {
    const champIconUrl = `${COMMUNITY_DRAGON_BASE}/v1/champion-icons/${championId}.png`;
    const champIconAsset = await getAsset(champIconUrl, `${championId}.png`, 'champion');
    if (champIconAsset.buffer) {
        const champImg = await loadImage(champIconAsset.buffer);
        drawClippedImage(ctx, champImg, x, y, size, 'circle');
        // Draw champLevel in a small circle at bottom right
        const levelCircleRadius = Math.floor(size * 0.22);
        const levelCircleX = x + size - levelCircleRadius - 8;
        const levelCircleY = y + size - levelCircleRadius - 8;
        ctx.save();
        drawCircle(ctx, levelCircleX + levelCircleRadius, levelCircleY + levelCircleRadius, levelCircleRadius, '#222', 0.85);
        ctx.font = `bold ${Math.floor(levelCircleRadius * 1.2)}px Roboto, Arial`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(champLevel), levelCircleX + levelCircleRadius, levelCircleY + levelCircleRadius);
        ctx.restore();
    }
}

// Extracted helper for summoner spell drawing
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

// Extracted helper for rune icons drawing
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

// Helper for drawing multikill label
function drawMultikillLabel(ctx: CanvasRenderingContext2D, participant: any, x: number, y: number) {
    const multikillLabels = [
        {key: 'pentaKills', label: 'Penta Kill'},
        {key: 'quadraKills', label: 'Quadra Kill'},
        {key: 'tripleKills', label: 'Triple Kill'},
        {key: 'doubleKills', label: 'Double Kill'}
    ];
    let multikillLabel = '';
    for (const {key, label} of multikillLabels) {
        if (participant[key] && participant[key] > 0) {
            multikillLabel = label;
            break;
        }
    }
    if (multikillLabel !== '') {
        ctx.font = 'bold 14px "Roboto", Arial';
        ctx.fillStyle = '#ffb74d';
        ctx.fillText(multikillLabel, x, y);
    }
}

// Helper for drawing KDA and ratio
function drawKDA(ctx: CanvasRenderingContext2D, participant: any, x: number, y: number) {
    ctx.font = 'bold 20px "Roboto", Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${participant.kills} / ${participant.deaths} / ${participant.assists}`, x, y);
    ctx.font = '14px "Roboto", Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText(`${((participant.kills + participant.assists) / Math.max(1, participant.deaths)).toFixed(2)} KDA`, x, y + 24);
}

// Helper for drawing row background
function drawRowBackground(ctx: CanvasRenderingContext2D, win: boolean, mode: string, x: number, y: number, w: number, h: number, radius: number) {
    ctx.save();
    ctx.fillStyle = getResultColor(win, mode);
    drawRoundedRect(ctx, x, y, w, h, radius);
    ctx.restore();
}

// Helper for drawing game mode label
function drawGameModeLabel(ctx: CanvasRenderingContext2D, label: string, color: string, x: number, y: number) {
    ctx.fillStyle = color;
    ctx.font = 'bold 18px "Roboto", Arial';
    ctx.fillText(label, x, y);
}

// Helper for drawing game time
function drawGameTime(ctx: CanvasRenderingContext2D, duration: number, x: number, y: number) {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    ctx.font = '14px "Roboto", Arial';
    ctx.fillStyle = '#bbb';
    ctx.fillText(`${mins}m ${secs}s`, x, y);
}
