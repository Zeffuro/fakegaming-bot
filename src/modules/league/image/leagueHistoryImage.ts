import {CanvasRenderingContext2D, createCanvas, loadImage} from 'canvas';
import {getAsset} from '../../../utils/assetCache.js';
import {getItemData} from '../../../cache/leagueItemDataCache.js';
import {getSummonerSpellData} from '../../../cache/leagueSummonerSpellDataCache.js';
import {getPerkStylesData} from '../../../cache/leaguePerkStylesDataCache.js';
import {getPerksData} from '../../../cache/leaguePerksDataCache.js';
import {queueMapper, gameModeConvertMap} from '../../../constants/leagueMappers.js';
import {
    drawItemSlotBackground,
    drawItemSlotIcon,
    drawItemSlotBorder,
    drawClippedImage,
    drawCircle
} from '../../../utils/canvasExtensions.js';

const ROW_HEIGHT = 110;
const WIDTH = 820;
const PADDING = 16;
const ICON_SIZE = 64;
const ITEM_SIZE = 32;
const ITEM_GAP = 2;
const FONT = '16px "Roboto", Arial';

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

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const y = PADDING + i * ROW_HEIGHT;

        // Find participant
        const participant = match.info.participants.find((p: any) => p.puuid === identity.puuid);
        if (!participant) continue;

        // Row background (rounded)
        ctx.save();
        ctx.fillStyle = getResultColor(participant.win, match.info.gameMode);
        const rowRadius = 8;
        const rowX = PADDING;
        const rowY = y;
        const rowW = WIDTH - PADDING * 2;
        const rowH = ROW_HEIGHT - 8;
        drawRoundedRect(ctx, rowX, rowY, rowW, rowH, rowRadius);
        ctx.restore();

        // Game mode label
        const queueLabel = queueMapper[match.info.queueId];
        const modeLabel = gameModeConvertMap[match.info.gameMode];
        const gameTypeLabel = queueLabel || modeLabel || match.info.gameMode;

        // Game mode color
        ctx.fillStyle = getModeColor(gameTypeLabel);
        ctx.font = 'bold 18px "Roboto", Arial';
        ctx.fillText(gameTypeLabel, PADDING + 8, y + 8);

        // Champion icon above items, clipped as circle, smaller and padded Y
        const champIconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${participant.championId}.png`;
        const champIconAsset = await getAsset(champIconUrl, `${participant.championId}.png`, 'champion');
        let champX = PADDING + ICON_SIZE + 180;
        let champPortraitSize = Math.floor(ITEM_SIZE * 1.75); // smaller
        let champY = y + 3;
        if (champIconAsset.buffer) {
            const champImg = await loadImage(champIconAsset.buffer);
            drawClippedImage(ctx, champImg, champX, champY, champPortraitSize, 'circle');
            // Draw champLevel in a small circle at bottom right using drawCircle, a bit smaller than 0.28
            const levelCircleRadius = Math.floor(champPortraitSize * 0.22);
            const levelCircleX = champX + champPortraitSize - levelCircleRadius - 8;
            const levelCircleY = champY + champPortraitSize - levelCircleRadius - 8;
            ctx.save();
            drawCircle(ctx, levelCircleX + levelCircleRadius, levelCircleY + levelCircleRadius, levelCircleRadius, '#222', 0.85);
            ctx.font = `bold ${Math.floor(levelCircleRadius * 1.2)}px Roboto, Arial`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(participant.champLevel), levelCircleX + levelCircleRadius, levelCircleY + levelCircleRadius);
            ctx.restore();
        }

        // Summoner spell icons for main player (vertically stacked to the right of champion icon)
        const spellSize = Math.floor(champPortraitSize / 2);
        const spellGap = 2;
        const spellX = champX + champPortraitSize + 8;
        let spellY = champY;
        for (const spellId of [participant.summoner1Id, participant.summoner2Id]) {
            const spellData = summonerSpellsJson.find((s: any) => s.id === spellId);
            if (spellData && spellData.iconPath) {
                const match = spellData.iconPath.toLowerCase().match(/spells\/icons2d\/[^\/]+\.png$/);
                if (match) {
                    const spellIconUrl = `https://raw.communitydragon.org/latest/game/data/spells/icons2d/${match[0].split('/').pop()}`;
                    const spellIconAsset = await getAsset(spellIconUrl, `${spellId}.png`, 'summonerspell');
                    if (spellIconAsset.buffer) {
                        const spellImg = await loadImage(spellIconAsset.buffer);
                        drawClippedImage(ctx, spellImg, spellX, spellY, spellSize, 'rounded', 6);
                    }
                }
            }
            spellY += spellSize + spellGap;
        }
        // Rune tree icons next to summoner spells
        const runeSize = spellSize;
        const runeGap = spellGap;
        const runeX = spellX + spellSize + 8;
        let runeY = champY;
        const perkStyles = participant.perks?.styles || [];
        for (let r = 0; r < 2; r++) {
            const styleId = perkStyles[r]?.style;
            const styleData = perkStylesJson.styles.find((s: any) => s.id === styleId);
            if (styleData && styleData.iconPath) {
                let runeIconUrl = '';
                if (r === 0) {
                    // For the first style, use the keystone icon from perks.json
                    const keystoneId = perkStyles[0]?.selections?.[0]?.perk;
                    const keystoneData = perksJson.find((p: any) => p.id === keystoneId);
                    if (keystoneData && keystoneData.iconPath) {
                        // Convert to lowercase and fix path
                        const iconPath = keystoneData.iconPath
                            .replace('/lol-game-data/assets/v1/', '')
                            .replace(/([A-Z])/g, ((match: string) => match.toLowerCase()));
                        runeIconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/${iconPath}`;
                    }
                } else {
                    // For secondary style, use the style icon as before
                    const styleNameMatch = styleData.iconPath.match(/\/perk-images\/Styles\/(\d+)_([A-Za-z]+)\.png$/i);
                    const styleName = styleNameMatch ? styleNameMatch[2].toLowerCase() : '';
                    if (styleName) {
                        runeIconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${styleNameMatch[1]}_${styleName}.png`;
                    }
                }
                if (runeIconUrl) {
                    const assetType = r === 0 ? 'keystone' : 'perkstyle';
                    const runeIconAsset = await getAsset(runeIconUrl, `${styleId}.png`, assetType);
                    if (runeIconAsset.buffer) {
                        const runeImg = await loadImage(runeIconAsset.buffer);
                        // Draw black circle behind keystone using drawCircle from canvasExtensions
                        drawCircle(ctx, runeX + runeSize / 2, runeY + runeSize / 2, runeSize / 2, r === 0 ? '#000' : 'rgba(0,0,0,0)', r === 0 ? 0.85 : 0);
                        drawClippedImage(ctx, runeImg, runeX, runeY, runeSize, 'circle');
                    }
                }
            }
            runeY += runeSize + runeGap;
        }

        // Move result and multikill to left, above KDA
        ctx.font = 'bold 16px "Roboto", Arial';
        ctx.fillStyle = participant.win ? '#4fd18b' : '#e05c5c';
        ctx.fillText(participant.win ? 'Victory' : 'Defeat', PADDING + ICON_SIZE + 24, y + 8);

        // Multikill label (if any)
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

        if (multikillLabel != '') {
            ctx.font = 'bold 14px "Roboto", Arial';
            ctx.fillStyle = '#ffb74d';
            ctx.fillText(multikillLabel, PADDING + ICON_SIZE + 120, y + 8);
        }

        // KDA
        ctx.font = 'bold 20px "Roboto", Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${participant.kills} / ${participant.deaths} / ${participant.assists}`, PADDING + ICON_SIZE + 24, y + 38);

        // KDA ratio
        ctx.font = '14px "Roboto", Arial';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`${((participant.kills + participant.assists) / Math.max(1, participant.deaths)).toFixed(2)} KDA`, PADDING + ICON_SIZE + 24, y + 62);

        // Game time (move to right of team names)
        const duration = match.info.gameDuration;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        ctx.font = '14px "Roboto", Arial';
        ctx.fillStyle = '#bbb';
        ctx.fillText(`${mins}m ${secs}s`, WIDTH - 40, y + 8);

        // Items with backgrounds and borders at the bottom (properly contained)
        // Place items so they are visually centered above the rounded bottom
        const itemsY = y + rowH - ITEM_SIZE - rowRadius / 2;
        for (let j = 0; j <= 6; j++) {
            const itemId = participant[`item${j}`];
            const x = PADDING + ICON_SIZE + 180 + j * (ITEM_SIZE + ITEM_GAP);
            drawItemSlotBackground(ctx, x, itemsY, ITEM_SIZE, 8, '#222');
            if (itemId && itemId > 0) {
                const itemData = itemsJson.find((item: any) => item.id === itemId);
                if (itemData && itemData.iconPath) {
                    const match = itemData.iconPath.toLowerCase().match(/items\/icons2d\/[^\/]+\.png$/);
                    if (match) {
                        const iconPath = `assets/${match[0]}`;
                        const itemIconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/${iconPath}`;
                        const itemIconAsset = await getAsset(itemIconUrl, `${itemId}.png`, 'item');
                        if (itemIconAsset.buffer) {
                            const itemImg = await loadImage(itemIconAsset.buffer);
                            drawItemSlotIcon(ctx, itemImg, x, itemsY, ITEM_SIZE, 8);
                        }
                    }
                }
            }
        }

        // Team names on the right, highlight player
        const team1 = match.info.participants.filter((p: any) => p.teamId === 100);
        const team2 = match.info.participants.filter((p: any) => p.teamId === 200);

        // Draw both teams on the right with icons, adjust spacing to prevent overflow
        const rightX = WIDTH - 240;
        await drawTeamNamesWithIcons(ctx, team1, rightX, y + 3, identity.riotIdGameName, '#4fd18b');
        await drawTeamNamesWithIcons(ctx, team2, rightX + 120, y + 3, identity.riotIdGameName, '#e05c5c');
    }

    return canvas.toBuffer('image/png');
}

async function drawTeamNamesWithIcons(ctx: CanvasRenderingContext2D, team: any[], x: number, y: number, playerName: string, color: string) {
    const rowHeight = 20;
    const iconSize = 16;
    const nameOffsetX = iconSize + 8;
    ctx.font = '14px "Roboto", Arial';
    for (let i = 0; i < team.length; i++) {
        const participant = team[i];
        // Champion icon
        const champIconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${participant.championId}.png`;
        const champIconAsset = await getAsset(champIconUrl, `${participant.championId}.png`, 'champion');
        if (champIconAsset.buffer) {
            const champImg = await loadImage(champIconAsset.buffer);
            if (participant.riotIdGameName === playerName) {
                drawClippedImage(ctx, champImg, x, y + i * rowHeight, iconSize, 'circle');
            } else {
                drawClippedImage(ctx, champImg, x, y + i * rowHeight, iconSize, 'rounded', 4);
            }
        }
        // Name
        ctx.fillStyle = participant.riotIdGameName === playerName ? color : '#eee';
        ctx.fillText(truncateName(participant.riotIdGameName), x + nameOffsetX, y + i * rowHeight);
    }
}

function truncateName(name: string, maxLen: number = 10): string {
    return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}
