import {CanvasRenderingContext2D, Image, createCanvas, loadImage} from 'canvas';
import {getAsset} from '../../../utils/assetCache.js';
import {
    drawClippedImage,
    drawCircle,
    drawGridList,
    drawHorizontalList,
    drawItemSlotBackground,
    drawRoundedBoxLabel,
    drawRoundedRect,
} from '../../../utils/canvasExtensions.js';
import {formatDuration, timeAgo} from '../../../utils/generalUtils.js';
import {getAugmentData} from '../cache/leagueAugmentDataCache.js';
import {getItemData} from '../cache/leagueItemDataCache.js';
import {getPerksData} from '../cache/leaguePerksDataCache.js';
import {getPerkStylesData} from '../cache/leaguePerkStylesDataCache.js';
import {getSummonerSpellData} from '../cache/leagueSummonerSpellDataCache.js';
import {gameModeConvertMap, queueMapper} from '../constants/leagueMappers.js';
import type {
    LeagueAugment,
    LeagueItem,
    LeaguePerk,
    LeaguePerkStyle,
    LeaguePerkStylesData,
    LeagueSummonerSpell,
} from '../types/leagueAssetTypes.js';
import type {LeagueMatchDto, LeagueMatchParticipantDto} from '../types/riotDtos.js';
import {communityDragonAssetUrl, leagueChampionIconUrl} from '../utils/assetUrl.js';
import {historyFontString as fontString} from './textRender.js';

type ArenaParticipant = LeagueMatchParticipantDto & { playerSubteamId?: number };

const ROW_HEIGHT = 110;
const WIDTH = 820;
const PADDING = 16;
const ITEM_SIZE = 32;
const ITEM_GAP = 2;
const TEAM_FONT_FAMILY = '"Noto Sans", "Segoe UI Symbol", "Arial Unicode MS", Arial, sans-serif';
const TEXT_COLOR = '#ffffff';
const MUTED_COLOR = '#bdbdbd';

export async function generateLeagueHistoryImage(matches: LeagueMatchDto[], identity: {
    puuid: string
}): Promise<Buffer> {
    const [itemsJson, summonerSpellsJson, perkStylesJson, perksJson] = await Promise.all([
        getItemData(),
        getSummonerSpellData(),
        getPerkStylesData(),
        getPerksData(),
    ]);

    const height = matches.length * ROW_HEIGHT + PADDING * 2;
    const canvas = createCanvas(WIDTH, height);
    const ctx = canvas.getContext('2d');
    ctx.font = fontString();
    ctx.textBaseline = 'top';

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const y = PADDING + i * ROW_HEIGHT;
        const participant = match.info.participants.find((p) => p.puuid === identity.puuid);
        if (!participant) continue;

        await drawMatchRow(ctx, match, participant, identity.puuid, {
            items: itemsJson,
            summonerSpells: summonerSpellsJson,
            perkStyles: perkStylesJson,
            perks: perksJson,
        }, PADDING, y);
    }

    return canvas.toBuffer('image/png');
}

async function drawMatchRow(
    ctx: CanvasRenderingContext2D,
    match: LeagueMatchDto,
    participant: LeagueMatchParticipantDto,
    playerPuuid: string,
    data: {
        items: LeagueItem[];
        summonerSpells: LeagueSummonerSpell[];
        perkStyles: LeaguePerkStylesData;
        perks: LeaguePerk[];
    },
    x: number,
    y: number
): Promise<void> {
    const rowWidth = WIDTH - PADDING * 2;
    const rowHeight = ROW_HEIGHT - 8;
    const mode = getModeLabel(match);
    const accentColor = participant.win ? '#58a6ff' : '#ff6673';

    drawRowBackground(ctx, participant.win, mode, x, y, rowWidth, rowHeight, accentColor);
    drawMatchInfo(ctx, match, participant, x + 16, y + 8);

    const championX = x + 100;
    const championSize = 56;
    const championY = y + 4;
    await drawChampionIconWithLevel(ctx, participant, championX, championY, championSize);

    const sideIconSize = Math.floor(championSize / 2);
    const sideIconGap = 2;
    let afterSideIconsX: number;
    let sideIconsWidth = sideIconSize;

    if (match.info.gameMode === 'CHERRY') {
        afterSideIconsX = championX + championSize + 8;
        await drawAugments(ctx, getAugmentIds(participant), afterSideIconsX, championY, sideIconSize, sideIconGap);
        sideIconsWidth = sideIconSize * 2 + sideIconGap;
    } else {
        const spellX = championX + championSize + 8;
        await drawSummonerSpells(ctx, [participant.summoner1Id, participant.summoner2Id], data.summonerSpells, spellX, championY, sideIconSize, sideIconGap);

        afterSideIconsX = spellX + sideIconSize + 8;
        await drawRunes(ctx, participant.perks?.styles ?? [], data.perks, data.perkStyles, afterSideIconsX, championY, sideIconSize, sideIconGap);
    }

    const kdaX = afterSideIconsX + sideIconsWidth + 20;
    drawKda(ctx, participant, kdaX, championY + 8);
    drawStats(ctx, match, participant, kdaX + 110, championY + 2);

    const itemsY = championY + championSize + 8;
    await drawItems(ctx, participant, data.items, championX, itemsY);
    drawMultikillLabelBox(ctx, participant, championX, itemsY);

    const rightX = WIDTH - 280;
    if (match.info.gameMode === 'CHERRY') {
        await drawArenaTeams(ctx, match, playerPuuid, rightX, y + 3);
        return;
    }

    const team1 = match.info.participants.filter((p) => p.teamId === 100);
    const team2 = match.info.participants.filter((p) => p.teamId === 200);
    await drawTeamNames(ctx, team1, rightX, y + 3, playerPuuid);
    await drawTeamNames(ctx, team2, rightX + 120, y + 3, playerPuuid);
}

function drawRowBackground(ctx: CanvasRenderingContext2D, win: boolean, mode: string, x: number, y: number, w: number, h: number, accentColor: string): void {
    ctx.save();
    ctx.fillStyle = getResultColor(win, mode);
    drawRoundedRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, x, y, 7, h, 5);
    ctx.restore();
}

function drawMatchInfo(ctx: CanvasRenderingContext2D, match: LeagueMatchDto, participant: LeagueMatchParticipantDto, x: number, y: number): void {
    const mode = getModeLabel(match);
    const elapsed = match.info.gameEndTimestamp ? timeAgo(match.info.gameEndTimestamp) : '';
    const result = participant.win ? 'Victory' : 'Defeat';
    const durationSec = participant.timePlayed || Math.floor((match.info.gameDuration || 0) / 1000);
    const modeColor = participant.win ? '#4fa3ff' : '#e05c5c';
    const resultColor = participant.win ? '#4fd18b' : '#e05c5c';

    ctx.save();
    ctx.font = fontString({size: 16, weight: 'bold'});
    ctx.fillStyle = modeColor;
    drawTextFit(ctx, mode, x, y, 84);

    ctx.font = fontString({size: 14});
    ctx.fillStyle = '#e0e0e0';
    drawTextFit(ctx, elapsed, x, y + 22, 84);

    ctx.font = fontString({size: 15, weight: 'bold'});
    ctx.fillStyle = resultColor;
    ctx.fillText(result, x, y + 44);

    ctx.font = fontString({size: 14});
    ctx.fillStyle = MUTED_COLOR;
    ctx.fillText(formatDuration(durationSec), x, y + 66);
    ctx.restore();
}

async function drawChampionIconWithLevel(ctx: CanvasRenderingContext2D, participant: LeagueMatchParticipantDto, x: number, y: number, size: number): Promise<void> {
    const champImg = await loadChampionImage(participant.championId);
    drawClippedImage(ctx, champImg, x, y, size, 'circle');

    const radius = Math.floor(size * 0.22);
    const centerX = x + size - 8;
    const centerY = y + size - 8;
    drawCircle(ctx, centerX, centerY, radius, '#222222', 0.86);

    ctx.save();
    ctx.font = fontString({size: Math.floor(radius * 1.2), weight: 'bold'});
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(participant.champLevel), centerX, centerY);
    ctx.restore();
}

function drawKda(ctx: CanvasRenderingContext2D, participant: LeagueMatchParticipantDto, x: number, y: number): void {
    const kills = participant.kills ?? 0;
    const deaths = participant.deaths ?? 0;
    const assists = participant.assists ?? 0;
    const ratio = ((kills + assists) / Math.max(1, deaths)).toFixed(2);

    ctx.save();
    ctx.font = fontString({size: 20, weight: 'bold'});
    ctx.textBaseline = 'top';
    let drawX = x;
    drawX = drawColoredText(ctx, `${kills}`, drawX, y, TEXT_COLOR);
    drawX = drawColoredText(ctx, ' / ', drawX, y, TEXT_COLOR);
    drawX = drawColoredText(ctx, `${deaths}`, drawX, y, '#e05c5c');
    drawX = drawColoredText(ctx, ' / ', drawX, y, TEXT_COLOR);
    drawColoredText(ctx, `${assists}`, drawX, y, TEXT_COLOR);

    ctx.font = fontString({size: 12});
    ctx.fillStyle = MUTED_COLOR;
    ctx.fillText(`${ratio} KDA`, x, y + 24);
    ctx.restore();
}

function drawStats(ctx: CanvasRenderingContext2D, match: LeagueMatchDto, participant: LeagueMatchParticipantDto, x: number, y: number): void {
    const lines = getStatLines(match, participant);
    ctx.save();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        ctx.font = line.bold ? fontString({size: line.size, weight: 'bold'}) : fontString({size: line.size});
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, x, y + i * 18);
    }
    ctx.restore();
}

function getStatLines(match: LeagueMatchDto, participant: LeagueMatchParticipantDto): { text: string; color: string; size: number; bold: boolean }[] {
    if (gameModeConvertMap[match.info.gameMode ?? ''] === 'Arena') {
        const placement = participant.placement ? String(participant.placement) : '-';
        return [{text: `Placement: ${placement}`, color: '#e05c5c', size: 15, bold: true}];
    }

    const team = match.info.participants.filter((p) => p.teamId === participant.teamId);
    const teamKills = team.reduce((sum, p) => sum + (p.kills || 0), 0);
    const killP = teamKills > 0 ? Math.round(((participant.kills + participant.assists) / teamKills) * 100) : 0;
    const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
    const durationMin = Math.max(1, (participant.timePlayed || Math.floor((match.info.gameDuration || 0) / 1000)) / 60);
    const csPerMin = cs / durationMin;
    const vision = participant.visionScore || 0;
    const rank = getParticipantRank(participant);

    return [
        {text: `${killP}% Kill P.`, color: '#e05c5c', size: 13, bold: true},
        {text: `${cs} CS (${csPerMin.toFixed(1)})`, color: '#cccccc', size: 13, bold: false},
        {text: `${vision} Vision`, color: '#cccccc', size: 13, bold: false},
        {text: rank, color: rank === 'Unranked' ? MUTED_COLOR : '#cccccc', size: 13, bold: true},
    ];
}

async function drawItems(ctx: CanvasRenderingContext2D, participant: LeagueMatchParticipantDto, itemsJson: LeagueItem[], x: number, y: number): Promise<void> {
    const itemIds = [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5,
        participant.item6,
    ];
    const itemImages = await preloadAssets(
        itemIds,
        itemsJson,
        (entry) => entry.iconPath,
        (iconPath) => communityDragonAssetUrl(iconPath),
        'item'
    );

    await drawHorizontalList(ctx, itemImages, x, y, ITEM_SIZE + ITEM_GAP, (itemImg, itemX, itemY) => {
        drawItemSlotBackground(ctx, itemX, itemY, ITEM_SIZE, 8, '#222222');
        drawClippedImage(ctx, itemImg, itemX, itemY, ITEM_SIZE, 'rounded', 8);
    });
}

async function drawTeamNames(ctx: CanvasRenderingContext2D, team: LeagueMatchParticipantDto[], x: number, y: number, playerPuuid: string): Promise<void> {
    const rowHeight = 20;
    const iconSize = 16;
    const champImages = await Promise.all(team.map((participant) => loadChampionImage(participant.championId)));

    for (let i = 0; i < team.length; i++) {
        const participant = team[i];
        const rowY = y + i * rowHeight;
        const isPlayer = participant.puuid === playerPuuid;
        const champImg = champImages[i];
        drawClippedImage(ctx, champImg, x, rowY, iconSize, isPlayer ? 'circle' : 'rounded', 4);

        ctx.save();
        ctx.font = fontString({size: 14, family: TEAM_FONT_FAMILY});
        ctx.fillStyle = isPlayer ? TEXT_COLOR : '#9e9eb1';
        drawTextFit(ctx, getParticipantName(participant), x + iconSize + 8, rowY - 3, 94);
        ctx.restore();
    }
}

async function drawArenaTeams(ctx: CanvasRenderingContext2D, match: LeagueMatchDto, playerPuuid: string, x: number, y: number): Promise<void> {
    const participants = (match.info.participants as ArenaParticipant[])
        .filter((participant) => typeof participant.placement === 'number' && participant.placement >= 1);
    const teamMap = new Map<number, ArenaParticipant[]>();
    for (const participant of participants) {
        if (participant.playerSubteamId === undefined) continue;
        const team = teamMap.get(participant.playerSubteamId) ?? [];
        team.push(participant);
        teamMap.set(participant.playerSubteamId, team);
    }

    const teams = [...teamMap.values()]
        .sort((a, b) => Math.min(...a.map((p) => p.placement ?? Number.MAX_SAFE_INTEGER)) - Math.min(...b.map((p) => p.placement ?? Number.MAX_SAFE_INTEGER)))
        .slice(0, 4);

    for (let i = 0; i < teams.length; i++) {
        await drawArenaTeamPair(ctx, teams[i], x, y + i * 20, playerPuuid);
    }
}

async function drawArenaTeamPair(ctx: CanvasRenderingContext2D, team: ArenaParticipant[], x: number, y: number, playerPuuid: string): Promise<void> {
    const pair = team.slice(0, 2);
    const champImages = await Promise.all(pair.map((participant) => loadChampionImage(participant.championId)));
    for (let i = 0; i < 2; i++) {
        const participant = pair[i];
        if (!participant) continue;
        const cellX = x + i * 120;
        const isPlayer = participant.puuid === playerPuuid;
        drawClippedImage(ctx, champImages[i], cellX, y, 16, isPlayer ? 'circle' : 'rounded', 4);

        ctx.save();
        ctx.font = fontString({size: 14, family: TEAM_FONT_FAMILY});
        ctx.fillStyle = isPlayer ? TEXT_COLOR : '#9e9eb1';
        drawTextFit(ctx, getParticipantName(participant), cellX + 24, y - 3, 92);
        ctx.restore();
    }
}

function drawColoredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): number {
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    return x + ctx.measureText(text).width;
}

async function drawSummonerSpells(ctx: CanvasRenderingContext2D, spellIds: number[], summonerSpellsJson: LeagueSummonerSpell[], x: number, y: number, size: number, gap: number): Promise<void> {
    const images = await preloadAssets<LeagueSummonerSpell>(
        spellIds,
        summonerSpellsJson,
        (entry) => entry.iconPath,
        (iconPath) => communityDragonAssetUrl(iconPath),
        'summonerspell'
    );

    for (let i = 0; i < images.length; i++) {
        drawClippedImage(ctx, images[i], x, y + i * (size + gap), size, 'rounded', 6);
    }
}

async function drawRunes(ctx: CanvasRenderingContext2D, perkStyles: unknown[], perksJson: LeaguePerk[], perkStylesJson: LeaguePerkStylesData, x: number, y: number, size: number, gap: number): Promise<void> {
    const keystoneId = (perkStyles[0] as { selections?: { perk?: number }[] } | undefined)?.selections?.[0]?.perk;
    const secondaryRuneId = (perkStyles[1] as { style?: number } | undefined)?.style;
    const styles: LeaguePerkStyle[] = perkStylesJson.styles;

    const [keystoneImage] = await preloadAssets<LeaguePerk>(
        typeof keystoneId === 'number' ? [keystoneId] : [],
        perksJson,
        (entry) => entry.iconPath,
        (iconPath) => communityDragonAssetUrl(iconPath),
        'keystone'
    );
    const [secondaryImage] = await preloadAssets<LeaguePerkStyle>(
        typeof secondaryRuneId === 'number' ? [secondaryRuneId] : [],
        styles,
        (entry) => entry.iconPath,
        (iconPath) => communityDragonAssetUrl(iconPath),
        'perkstyle'
    );

    const images = [keystoneImage, secondaryImage];
    for (let i = 0; i < images.length; i++) {
        const drawY = y + i * (size + gap);
        drawCircle(ctx, x + size / 2, drawY + size / 2, size / 2, '#000000', 0.85);
        drawClippedImage(ctx, images[i], x, drawY, size, 'circle');
    }
}

async function drawAugments(ctx: CanvasRenderingContext2D, augmentIds: (string | number)[], x: number, y: number, size: number, gap: number): Promise<void> {
    const augmentData = await getAugmentData();
    const images = await preloadAssets<LeagueAugment>(
        augmentIds,
        augmentData,
        (entry) => entry.augmentSmallIconPath,
        (iconPath) => communityDragonAssetUrl(iconPath),
        'augment'
    );

    await drawGridList(ctx, images, x, y, 2, size + gap, size + gap, (img, drawX, drawY) => {
        drawCircle(ctx, drawX + size / 2, drawY + size / 2, size / 2, '#000000', 0.85);
        drawClippedImage(ctx, img, drawX, drawY, size, 'circle');
    });
}

function getAugmentIds(participant: LeagueMatchParticipantDto): number[] {
    return [
        participant.playerAugment1,
        participant.playerAugment2,
        participant.playerAugment3,
        participant.playerAugment4,
        participant.playerAugment5,
        participant.playerAugment6,
    ].filter((id): id is number => typeof id === 'number');
}

async function preloadAssets<T>(
    ids: (number | string)[],
    jsonData: T[],
    getIconPath: (_entry: T) => string | undefined,
    buildUrl: (_iconPath: string, _id: number | string) => string,
    assetType: string
): Promise<(Image | undefined)[]> {
    const images: (Image | undefined)[] = [];
    for (const id of ids) {
        const entry = jsonData.find((item) => (item as Record<string, unknown>).id === id);
        const iconPath = entry ? getIconPath(entry) : undefined;
        if (iconPath) {
            const asset = await getAsset(buildUrl(iconPath, id), `${id}.png`, assetType);
            if (asset.buffer) {
                try {
                    images.push(await loadImage(asset.buffer));
                    continue;
                } catch {
                    // Ignore malformed cached image data and render the empty slot.
                }
            }
        }
        images.push(undefined);
    }
    return images;
}

async function loadChampionImage(championId: number): Promise<Image | undefined> {
    const asset = await getAsset(leagueChampionIconUrl(championId), `${championId}.png`, 'champion');
    return asset.buffer ? await loadImage(asset.buffer) : undefined;
}

function getModeLabel(match: LeagueMatchDto): string {
    if (match.info.queueId && queueMapper[match.info.queueId]) return queueMapper[match.info.queueId];
    if (match.info.gameMode && gameModeConvertMap[match.info.gameMode]) return gameModeConvertMap[match.info.gameMode];
    return match.info.gameMode || 'Unknown';
}

function getResultColor(win: boolean, _mode: string): string {
    return win ? '#2d3e5e' : '#7c3a3a';
}

function getParticipantRank(participant: LeagueMatchParticipantDto): string {
    const rank = participant.tier ? `${participant.tier} ${participant.rank ?? ''}`.trim() : participant.leagueTier;
    return rank || 'Unranked';
}

function getParticipantName(participant: LeagueMatchParticipantDto): string {
    if (participant.riotIdGameName && participant.riotIdTagline) {
        return `${participant.riotIdGameName}#${participant.riotIdTagline}`;
    }
    return participant.riotIdGameName ?? participant.summonerName ?? participant.championName ?? `Champion ${participant.championId}`;
}

function getMultikillLabel(participant: LeagueMatchParticipantDto): string {
    if ((participant as { pentaKills?: number }).pentaKills) return 'Penta Kill';
    if ((participant as { quadraKills?: number }).quadraKills) return 'Quadra Kill';
    if ((participant as { tripleKills?: number }).tripleKills) return 'Triple Kill';
    if ((participant as { doubleKills?: number }).doubleKills) return 'Double Kill';
    return '';
}

function drawMultikillLabelBox(ctx: CanvasRenderingContext2D, participant: LeagueMatchParticipantDto, itemsX: number, itemsY: number): void {
    const multikillLabel = getMultikillLabel(participant);
    if (!multikillLabel) return;

    const itemsTotalWidth = 7 * ITEM_SIZE + 6 * ITEM_GAP;
    const font = fontString({size: 16, weight: 'bold'});
    const labelHeight = 16 + 8;
    drawRoundedBoxLabel(ctx, multikillLabel, itemsX + itemsTotalWidth + 16, itemsY + (ITEM_SIZE - labelHeight) / 2, {
        font,
        textColor: TEXT_COLOR,
        bgColor: '#c0392b',
        paddingX: 14,
        paddingY: 4,
        borderRadius: 12,
    });
}

function drawTextFit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number): void {
    const chars = Array.from(text);
    let fitted = text;
    while (ctx.measureText(fitted).width > maxWidth && chars.length > 3) {
        chars.pop();
        fitted = `${chars.slice(0, Math.max(1, chars.length - 3)).join('')}...`;
    }
    ctx.fillText(fitted, x, y);
}
