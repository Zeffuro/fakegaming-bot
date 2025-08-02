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
    drawGridList
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
        drawGameModeLabel(ctx, gameTypeLabel, getModeColor(match.info.gameMode), PADDING + 16, y);

        // Game time
        drawGameTime(ctx, match.info.gameDuration, PADDING + 16, y + 8);

        // Champion icon above items, clipped as circle, smaller and padded Y
        let champX = PADDING + ICON_SIZE + 180;
        let champPortraitSize = Math.floor(ITEM_SIZE * 1.75); // smaller
        let champY = y + 3;
        await drawChampionIconWithLevel(ctx, participant.championId, participant.champLevel, champX, champY, champPortraitSize);

        // Summoner spell icons for main player (vertically stacked to the right of champion icon)
        const spellSize = Math.floor(champPortraitSize / 2);
        const spellGap = 2;
        const spellX = champX + champPortraitSize + 12;
        let spellY = champY;
        const summonerSpellIds = [participant.summoner1Id, participant.summoner2Id];
        await drawSummonerSpells(ctx, summonerSpellIds, summonerSpellsJson, spellX, spellY, spellSize, spellGap);

        // Arena (CHERRY) mode: show augments instead of spells/runes
        if (match.info.gameMode === 'CHERRY') {
            const augmentIds = [];
            for (let i = 0; i < 6; i++) {
                const aug = participant[`playerAugment${i}`];
                if (aug) augmentIds.push(aug);
            }
            const augmentSize = Math.floor(champPortraitSize / 2);
            const augmentGap = 2;
            const augmentX = spellX + spellSize + 4;
            const augmentY = champY;
            await drawAugments(ctx, augmentIds, augmentX, augmentY, augmentSize, augmentGap);
        } else {
            // Rune tree icons next to summoner spells
            const runeSize = spellSize;
            const runeGap = spellGap;
            const runeX = spellX + spellSize + 4;
            const runeY = champY;
            const perkStyles = participant.perks?.styles || [];
            await drawRunes(ctx, perkStyles, perksJson, perkStylesJson, runeX, runeY, runeSize, runeGap);
        }

        // Move result and multikill to left, above KDA
        ctx.font = 'bold 16px "Roboto", Arial';
        ctx.fillStyle = participant.win ? '#4fd18b' : '#e05c5c';
        ctx.fillText(participant.win ? 'Victory' : 'Defeat', PADDING + ICON_SIZE + 24, y + 8);

        // Multikill label (if any)
        drawMultikillLabel(ctx, participant, PADDING + ICON_SIZE + 120, y + 8);

        // KDA
        drawKDA(ctx, participant, PADDING + ICON_SIZE + 24, y + 38);

        // Items with backgrounds and borders at the bottom (properly contained)
        // Place items so they are visually centered above the rounded bottom
        const itemsY = y + ROW_HEIGHT - ITEM_SIZE - 12;
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
        });

        // Team names on the right, highlight player
        const rightX = WIDTH - 280;
        if (match.info.gameMode === 'CHERRY') {
            // Arena: Only show teams with placement 1-4, grouped by playerSubteamId
            const arenaParticipants = match.info.participants.filter((p: any) => p.placement >= 1 && p.placement <= 4);
            // Group by playerSubteamId
            const subTeamMap: Record<string, any[]> = {};
            for (const p of arenaParticipants) {
                if (!subTeamMap[p.playerSubteamId]) subTeamMap[p.playerSubteamId] = [];
                subTeamMap[p.playerSubteamId].push(p);
            }
            // Convert to array of pairs, sort by best (lowest) placement in each pair
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
        ctx.fillStyle = participant.puuid === playerPuuid ? color : '#9e9eb1';
        ctx.fillText(truncateName(participant.riotIdGameName), px + nameOffsetX, py - 3);
    });
}

async function drawCherryTeamsWithIcons(ctx: CanvasRenderingContext2D, teamPairs: any[][], x: number, y: number, playerPuuid: string, color: string) {
    const rowHeight = 20;
    const iconSize = 16;
    const nameOffsetX = iconSize + 8;
    ctx.font = '14px "Noto Sans", "Segoe UI Symbol", "Arial Unicode MS", Arial, sans-serif';
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
    const COMMUNITY_DRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';
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
    ctx.save();
    ctx.fillStyle = getResultColor(win, mode);
    drawRoundedRect(ctx, x, y, w, h, radius);
    ctx.restore();
}

function drawGameModeLabel(ctx: CanvasRenderingContext2D, label: string, color: string, x: number, y: number) {
    ctx.fillStyle = color;
    ctx.font = 'bold 18px "Roboto", Arial';
    ctx.fillText(label, x, y);
}

function drawGameTime(ctx: CanvasRenderingContext2D, duration: number, x: number, y: number) {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    ctx.font = '14px "Roboto", Arial';
    ctx.fillStyle = '#bbb';
    ctx.fillText(`${mins}m ${secs}s`, x, y);
}

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

function drawKDA(ctx: CanvasRenderingContext2D, participant: any, x: number, y: number) {
    ctx.font = 'bold 20px "Roboto", Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${participant.kills} / ${participant.deaths} / ${participant.assists}`, x, y);
    ctx.font = '14px "Roboto", Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText(`${((participant.kills + participant.assists) / Math.max(1, participant.deaths)).toFixed(2)} KDA`, x, y + 24);
}

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
