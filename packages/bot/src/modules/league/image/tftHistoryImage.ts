import {createCanvas, loadImage} from 'canvas';
import {getAsset} from '../../../utils/assetCache.js';
import {timeAgo, formatDuration} from '../../../utils/generalUtils.js';
import {tftUnitIconUrl} from "../utils/assetUrl.js";

import type {MatchTFTDTO} from 'twisted/dist/models-dto/matches/tft-matches/match-tft.dto.js';

const ROW_HEIGHT = 100;
const WIDTH = 800;
const PADDING = 16;
const FONT = '16px "Roboto", Arial';

export async function generateTftHistoryImage(matches: MatchTFTDTO[], identity: {
    puuid: string
}): Promise<Buffer> {
    const height = matches.length * ROW_HEIGHT + PADDING * 2;
    const canvas = createCanvas(WIDTH, height);
    const ctx = canvas.getContext('2d');
    ctx.font = FONT;
    ctx.textBaseline = 'top';

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const y = PADDING + i * ROW_HEIGHT;
        const participants = match.info.participants;
        type ParticipantDto = typeof participants[number];
        const participant = participants.find(
            (p: ParticipantDto) => p.puuid === identity.puuid
        ) as ParticipantDto | undefined;
        if (!participant) continue;

        // Draw background
        ctx.save();
        ctx.fillStyle = participant.placement === 1 ? '#4fd18b' : '#2d3e5e';
        ctx.fillRect(PADDING, y, WIDTH - PADDING * 2, ROW_HEIGHT - 8);
        ctx.restore();

        // Placement
        ctx.font = 'bold 28px Roboto';
        ctx.fillStyle = '#fff';
        ctx.fillText(`#${participant.placement || '-'}`, PADDING + 10, y + 10);

        // Time ago
        ctx.font = '14px Roboto';
        ctx.fillStyle = '#bdbdbd';
        ctx.fillText(timeAgo(match.info.game_datetime || match.info.game_datetime), PADDING + 80, y + 10);

        // Game length
        ctx.font = '14px Roboto';
        ctx.fillStyle = '#bdbdbd';
        ctx.fillText(formatDuration(Math.floor((match.info.game_length || 0) / 1000)), PADDING + 80, y + 30);

        // Units (champions)
        const units = participant.units || [];
        let unitX = PADDING + 220;
        for (const unit of units) {
            if (!unit.character_id) continue;
            const champId = unit.character_id.replace('TFT5_', '').replace('TFT6_', '').replace('TFT7_', '').replace('TFT8_', '').replace('TFT9_', '');
            const champIconUrl = tftUnitIconUrl(champId)
            const asset = await getAsset(champIconUrl, `${unit.character_id}.png`, 'tftchampion');
            if (asset.buffer) {
                const img = await loadImage(asset.buffer);
                ctx.drawImage(img, unitX, y + 10, 48, 48);
            }
            unitX += 54;
        }

        // Traits
        type TraitDto = typeof participant.traits[number];
        const traits = (participant.traits || []).filter((t: TraitDto) => t.tier_current > 0);
        let traitX = PADDING + 220;
        for (const trait of traits) {
            ctx.font = '12px Roboto';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(trait.name.replace('Set', ''), traitX, y + 70);
            traitX += 60;
        }
    }
    return canvas.toBuffer('image/png');
}

