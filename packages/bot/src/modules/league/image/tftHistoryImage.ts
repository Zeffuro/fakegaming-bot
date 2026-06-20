import {CanvasRenderingContext2D, Image, createCanvas, loadImage} from 'canvas';
import {getAsset} from '../../../utils/assetCache.js';
import {
    drawClippedImage,
    drawCircle,
    drawItemSlotBackground,
    drawRoundedRect,
    drawRoundedRectBorder,
} from '../../../utils/canvasExtensions.js';
import {formatDuration, timeAgo} from '../../../utils/generalUtils.js';
import {getTftItemData} from '../cache/leagueTftItemDataCache.js';
import {getTftTraitData} from '../cache/leagueTftTraitDataCache.js';
import {queueMapper} from '../constants/leagueMappers.js';
import type {TftItem, TftTrait} from '../types/leagueAssetTypes.js';
import type {TftMatchDto, TftParticipantDto, TftTraitDto, TftUnitDto} from '../types/riotDtos.js';
import {communityDragonAssetUrl, tftUnitIconUrlCandidates} from '../utils/assetUrl.js';
import {historyFontString as fontString} from './textRender.js';

const ROW_HEIGHT = 160;
const WIDTH = 940;
const PADDING = 16;
const UNIT_SIZE = 48;
const UNIT_GAP = 7;
const UNIT_SLOTS = 10;
const TRAIT_WIDTH = 92;
const TRAIT_HEIGHT = 42;
const TRAIT_GAP = 4;
const TEXT_COLOR = '#f4f7fb';
const MUTED_COLOR = '#b6bdc8';
const PANEL_COLOR = '#1b2534';

type TftItemLookup = Map<string, TftItem>;
type TftTraitLookup = Map<string, TftTrait>;

interface TftRenderUnit {
    unit: TftUnitDto;
    unitImage?: Image;
    itemImages: (Image | undefined)[];
}

export async function generateTftHistoryImage(matches: TftMatchDto[], identity: {
    puuid: string
}): Promise<Buffer> {
    const [itemLookup, traitLookup] = await Promise.all([
        getTftItemData().then(buildTftItemLookup),
        getTftTraitData().then(buildTftTraitLookup),
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

        await drawMatchRow(ctx, match, participant, itemLookup, traitLookup, PADDING, y);
    }

    return canvas.toBuffer('image/png');
}

async function drawMatchRow(
    ctx: CanvasRenderingContext2D,
    match: TftMatchDto,
    participant: TftParticipantDto,
    itemLookup: TftItemLookup,
    traitLookup: TftTraitLookup,
    x: number,
    y: number
): Promise<void> {
    const rowWidth = WIDTH - PADDING * 2;
    const rowHeight = ROW_HEIGHT - 8;
    const placementColor = getPlacementColor(participant.placement);
    const contentX = x + 148;
    const statsX = x + 742;

    ctx.save();
    ctx.fillStyle = getRowColor(participant.placement);
    drawRoundedRect(ctx, x, y, rowWidth, rowHeight, 8);
    ctx.fillStyle = placementColor;
    drawRoundedRect(ctx, x, y, 7, rowHeight, 5);
    ctx.restore();

    drawMatchInfo(ctx, match, participant, x + 16, y + 14, placementColor);
    await drawTraits(ctx, participant.traits, traitLookup, contentX, y + 14);
    await drawUnits(ctx, participant.units, itemLookup, contentX, y + 72);
    drawStats(ctx, participant, statsX, y + 25);
}

function drawMatchInfo(ctx: CanvasRenderingContext2D, match: TftMatchDto, participant: TftParticipantDto, x: number, y: number, placementColor: string): void {
    const mode = getTftModeLabel(match);
    const placementLabel = getPlacementLabel(participant.placement);
    const result = participant.placement <= 4 ? 'Top 4' : 'Bottom 4';
    const timestamp = match.info.game_datetime;
    const elapsed = typeof timestamp === 'number' ? timeAgo(timestamp) : '';
    const duration = formatDuration(Math.floor(match.info.game_length ?? participant.time_eliminated ?? 0));

    ctx.save();
    ctx.font = fontString({size: 15, weight: 'bold'});
    ctx.fillStyle = placementColor;
    drawTextFit(ctx, mode, x, y, 130);

    ctx.font = fontString({size: 30, weight: 'bold'});
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(placementLabel, x, y + 27);

    ctx.font = fontString({size: 15, weight: 'bold'});
    ctx.fillStyle = placementColor;
    ctx.fillText(result, x, y + 63);

    ctx.font = fontString({size: 13});
    ctx.fillStyle = MUTED_COLOR;
    ctx.fillText(elapsed, x, y + 84);
    ctx.fillText(duration, x, y + 101);
    ctx.restore();
}

async function drawUnits(ctx: CanvasRenderingContext2D, units: TftUnitDto[], itemLookup: TftItemLookup, x: number, y: number): Promise<void> {
    const sortedUnits = [...units]
        .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0) || (b.rarity ?? 0) - (a.rarity ?? 0))
        .slice(0, UNIT_SLOTS);

    const renderUnits = await Promise.all(sortedUnits.map((unit) => loadTftRenderUnit(unit, itemLookup)));
    for (let i = 0; i < UNIT_SLOTS; i++) {
        const renderUnit = renderUnits[i];
        const unitX = x + i * (UNIT_SIZE + UNIT_GAP);
        if (renderUnit) {
            drawUnitCard(ctx, renderUnit, unitX, y);
        } else {
            drawEmptyUnitSlot(ctx, unitX, y);
        }
    }
}

function drawUnitCard(ctx: CanvasRenderingContext2D, renderUnit: TftRenderUnit, x: number, y: number): void {
    const {unit, unitImage, itemImages} = renderUnit;
    const borderColor = getRarityColor(unit.rarity);

    ctx.save();
    ctx.fillStyle = '#161c27';
    drawRoundedRect(ctx, x - 2, y - 2, UNIT_SIZE + 4, UNIT_SIZE + 28, 7);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    drawRoundedRectBorder(ctx, x - 1, y - 1, UNIT_SIZE + 2, UNIT_SIZE + 2, 6);
    ctx.restore();

    drawClippedImage(ctx, unitImage, x, y, UNIT_SIZE, 'rounded', 6);
    drawStarTier(ctx, unit.tier ?? 1, x + 4, y - 14);
    drawItemRow(ctx, itemImages, unit.items ?? [], x + 3, y + UNIT_SIZE + 8);
}

function drawEmptyUnitSlot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(12, 17, 27, 0.68)';
    drawRoundedRect(ctx, x, y, UNIT_SIZE, UNIT_SIZE, 7);
    ctx.strokeStyle = 'rgba(151, 164, 184, 0.28)';
    ctx.lineWidth = 1;
    drawRoundedRectBorder(ctx, x + 0.5, y + 0.5, UNIT_SIZE - 1, UNIT_SIZE - 1, 7);
    ctx.restore();
}

function drawStats(ctx: CanvasRenderingContext2D, participant: TftParticipantDto, x: number, y: number): void {
    const carry = getCarryUnit(participant.units);
    const lines = [
        {label: 'Level', value: `${participant.level ?? '-'}`},
        {label: 'Round', value: formatTftRound(participant.last_round)},
        {label: 'Damage', value: formatNumber(participant.total_damage_to_players)},
        {label: 'Elims', value: `${participant.players_eliminated ?? 0}`},
        {label: 'Gold', value: `${participant.gold_left ?? 0}`},
        {label: 'Carry', value: carry ? getTftUnitDisplayName(carry) : '-'},
    ];

    ctx.save();
    ctx.fillStyle = PANEL_COLOR;
    drawRoundedRect(ctx, x - 14, y - 10, 164, 122, 8);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineY = y + i * 18;
        ctx.font = fontString({size: 12, weight: 'bold'});
        ctx.fillStyle = '#9fb0c6';
        ctx.fillText(line.label, x, lineY);
        ctx.font = fontString({size: 14, weight: 'bold'});
        ctx.fillStyle = TEXT_COLOR;
        drawTextFit(ctx, line.value, x + 70, lineY - 1, 72);
    }
    ctx.restore();
}

async function drawTraits(ctx: CanvasRenderingContext2D, traits: TftTraitDto[], traitLookup: TftTraitLookup, x: number, y: number): Promise<void> {
    const activeTraits = traits
        .filter((trait) => trait.tier_current > 0)
        .sort((a, b) => (b.style ?? 0) - (a.style ?? 0) || b.tier_current - a.tier_current || (b.num_units ?? 0) - (a.num_units ?? 0))
        .slice(0, 6);

    const traitImages = await Promise.all(activeTraits.map((trait) => loadTftTraitImage(trait, traitLookup)));
    for (let i = 0; i < activeTraits.length; i++) {
        const trait = activeTraits[i];
        if (!trait) continue;
        drawTraitChip(ctx, trait, traitImages[i], x + i * (TRAIT_WIDTH + TRAIT_GAP), y);
    }
}

function drawTraitChip(ctx: CanvasRenderingContext2D, trait: TftTraitDto, traitImage: Image | undefined, x: number, y: number): void {
    const color = getTraitColor(trait.style ?? trait.tier_current);
    const label = cleanTftName(trait.name);
    const count = trait.num_units ?? trait.tier_current;

    ctx.save();
    ctx.fillStyle = PANEL_COLOR;
    drawRoundedRect(ctx, x, y, TRAIT_WIDTH, TRAIT_HEIGHT, 7);
    ctx.fillStyle = color;
    drawRoundedRect(ctx, x, y, 5, TRAIT_HEIGHT, 4);
    drawCircle(ctx, x + 19, y + 14, 11, '#0c111b', 0.96);
    drawClippedImage(ctx, traitImage, x + 8, y + 3, 22, 'circle');

    ctx.font = fontString({size: 16, weight: 'bold'});
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(String(count), x + TRAIT_WIDTH - 10, y + 5);

    ctx.fillStyle = '#dce4ef';
    drawTraitLabel(ctx, label, x, y);
    ctx.restore();
}

function drawTraitLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): void {
    const words = label.split(/\s+/).filter(Boolean);
    const maxWidth = TRAIT_WIDTH - 14;
    if (words.length === 2) {
        ctx.font = fontString({size: 10, weight: 'bold'});
        drawTextFit(ctx, words[0], x + TRAIT_WIDTH / 2, y + 21, maxWidth, 'center');
        drawTextFit(ctx, words[1], x + TRAIT_WIDTH / 2, y + 31, maxWidth, 'center');
        return;
    }

    ctx.font = fontString({size: 12, weight: 'bold'});
    drawTextFit(ctx, label, x + TRAIT_WIDTH / 2, y + 27, maxWidth, 'center');
}

function drawStarTier(ctx: CanvasRenderingContext2D, tier: number, x: number, y: number): void {
    ctx.save();
    const count = Math.max(1, Math.min(3, tier));
    for (let i = 0; i < count; i++) {
        drawStar(ctx, x + i * 12, y + 6, 5.5, '#ffd95a');
    }
    ctx.restore();
}

function drawItemRow(ctx: CanvasRenderingContext2D, itemImages: (Image | undefined)[], items: number[], x: number, y: number): void {
    if (itemImages.length > 0) {
        for (let i = 0; i < 3; i++) {
            const img = itemImages[i];
            drawItemSlotBackground(ctx, x + i * 15, y, 13, 3, '#222936');
            if (img) {
                drawClippedImage(ctx, img, x + i * 15, y, 13, 'rounded', 3);
            }
        }
        return;
    }

    const itemCount = Math.min(3, items.filter((item) => item > 0).length);
    for (let i = 0; i < 3; i++) {
        drawItemSlotBackground(ctx, x + i * 14, y, 11, 3, i < itemCount ? '#d9a441' : '#222936');
        if (i < itemCount) {
            drawCircle(ctx, x + i * 14 + 5.5, y + 5.5, 2.3, '#fff4b0', 0.8);
        }
    }
}

async function loadTftRenderUnit(unit: TftUnitDto, itemLookup: TftItemLookup): Promise<TftRenderUnit> {
    const [unitImage, itemImages] = await Promise.all([
        loadTftUnitImage(unit),
        loadTftItemImages(unit, itemLookup),
    ]);
    return {unit, unitImage, itemImages};
}

async function loadTftUnitImage(unit: TftUnitDto): Promise<Image | undefined> {
    const asset = await getFirstAvailableAsset(tftUnitIconUrlCandidates(unit.character_id), `${unit.character_id}.png`, 'tftchampion');
    return asset.buffer ? await loadImage(asset.buffer) : undefined;
}

async function loadTftItemImages(unit: TftUnitDto, itemLookup: TftItemLookup): Promise<(Image | undefined)[]> {
    const names = (unit.itemNames ?? []).slice(0, 3);
    if (names.length === 0) return [];

    return Promise.all(names.map(async (name) => {
        const item = itemLookup.get(normalizeTftItemKey(name));
        if (!item?.squareIconPath) return undefined;
        const asset = await getAsset(communityDragonAssetUrl(item.squareIconPath), `${item.nameId}.png`, 'tftitem', {logFailures: false});
        return asset.buffer ? await loadImage(asset.buffer) : undefined;
    }));
}

async function loadTftTraitImage(trait: TftTraitDto, traitLookup: TftTraitLookup): Promise<Image | undefined> {
    const assetTrait = traitLookup.get(normalizeTftItemKey(trait.name));
    if (!assetTrait?.icon_path) return undefined;
    const asset = await getAsset(communityDragonAssetUrl(assetTrait.icon_path), `${assetTrait.trait_id}.png`, 'tfttrait', {logFailures: false});
    return asset.buffer ? await loadImage(asset.buffer) : undefined;
}

async function getFirstAvailableAsset(urls: string[], assetName: string, type: string) {
    for (let i = 0; i < urls.length; i++) {
        const asset = await getAsset(urls[i], assetName, type, {logFailures: i === urls.length - 1});
        if (asset.buffer) return asset;
    }

    return {buffer: null, path: ''};
}

function getTftModeLabel(match: TftMatchDto): string {
    const queueName = match.info.queue_id ? queueMapper[match.info.queue_id] : undefined;
    const gameType = match.info.tft_game_type ? titleCase(match.info.tft_game_type) : undefined;
    const setLabel = match.info.tft_set_number ? `Set ${match.info.tft_set_number}` : 'TFT';
    return [queueName ?? gameType ?? 'TFT', setLabel].filter(Boolean).join(' - ');
}

function buildTftItemLookup(items: TftItem[]): TftItemLookup {
    const lookup: TftItemLookup = new Map();
    for (const item of items) {
        if (!item.squareIconPath) continue;
        lookup.set(normalizeTftItemKey(item.nameId), item);
        lookup.set(normalizeTftItemKey(item.name), item);
    }
    return lookup;
}

function buildTftTraitLookup(traits: TftTrait[]): TftTraitLookup {
    const lookup: TftTraitLookup = new Map();
    for (const trait of traits) {
        if (!trait.icon_path) continue;
        lookup.set(normalizeTftItemKey(trait.trait_id), trait);
        lookup.set(normalizeTftItemKey(trait.display_name), trait);
    }
    return lookup;
}

function normalizeTftItemKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getPlacementLabel(placement: number): string {
    if (!placement) return '-';
    const suffix = placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th';
    return `${placement}${suffix}`;
}

function getRowColor(placement: number): string {
    if (placement === 1) return '#254a3f';
    if (placement <= 4) return '#273d63';
    return '#6a3234';
}

function getPlacementColor(placement: number): string {
    if (placement === 1) return '#55d38b';
    if (placement <= 4) return '#5da7ff';
    return '#ff6b6b';
}

function getRarityColor(rarity?: number): string {
    const colors = ['#7a8495', '#59b86f', '#3f9cff', '#c157ff', '#f2b84b', '#ff7070'];
    return colors[Math.max(0, Math.min(colors.length - 1, rarity ?? 0))];
}

function getTraitColor(style: number): string {
    if (style >= 4) return '#f2c94c';
    if (style === 3) return '#d6a23a';
    if (style === 2) return '#c5d3df';
    if (style === 1) return '#b0774a';
    return '#91a3b8';
}

function formatTftRound(round?: number): string {
    if (!round || round < 1) return '-';
    const stage = Math.floor((round + 3) / 7) + 1;
    const step = ((round + 3) % 7) + 1;
    return `${stage}-${step}`;
}

function formatNumber(value?: number): string {
    if (typeof value !== 'number') return '-';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return String(value);
}

function cleanTftName(value: string): string {
    const withoutPrefix = value
        .replace(/^TFT\d+[A-Z]?_/i, '')
        .replace(/^Characters?_TFT\d+[A-Z]?_/i, '')
        .replace(/^Set\d+_/i, '')
        .replace(/^TFT_/i, '')
        .replace(/_/g, ' ');
    return titleCase(withoutPrefix.replace(/([a-z])([A-Z])/g, '$1 $2'));
}

function getCarryUnit(units: TftUnitDto[]): TftUnitDto | undefined {
    return [...units].sort((a, b) => {
        const itemDiff = (b.itemNames?.length ?? b.items?.length ?? 0) - (a.itemNames?.length ?? a.items?.length ?? 0);
        if (itemDiff !== 0) return itemDiff;
        return (b.tier ?? 0) - (a.tier ?? 0) || (b.rarity ?? 0) - (a.rarity ?? 0);
    })[0];
}

function getTftUnitDisplayName(unit: TftUnitDto): string {
    return cleanTftName(unit.name || unit.character_id);
}

function drawTextFit(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    align: CanvasTextAlign = 'left'
): void {
    const chars = Array.from(text);
    let fitted = text;
    while (ctx.measureText(fitted).width > maxWidth && chars.length > 3) {
        chars.pop();
        fitted = `${chars.slice(0, Math.max(1, chars.length - 2)).join('')}...`;
    }
    const previousAlign = ctx.textAlign;
    ctx.textAlign = align;
    ctx.fillText(fitted, x, y);
    ctx.textAlign = previousAlign;
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
    const innerRadius = radius * 0.45;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const drawRadius = i % 2 === 0 ? radius : innerRadius;
        const px = x + Math.cos(angle) * drawRadius;
        const py = y + Math.sin(angle) * drawRadius;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function titleCase(value: string): string {
    return value
        .toLowerCase()
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
