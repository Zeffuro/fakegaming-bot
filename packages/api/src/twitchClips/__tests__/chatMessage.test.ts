import { describe, expect, it } from 'vitest';
import { getClipCommandTitle, matchesClipCommand, type ClipCommandConfig, type TwitchClipChatMessage } from '../chatMessage.js';

const config: ClipCommandConfig = {
    id: 'config', broadcasterId: '123', command: '!clip', aliases: ['!moment'],
    permission: 'everyone', enabled: true, cooldownSeconds: 30, durationSeconds: 30,
};
const message: TwitchClipChatMessage = {
    broadcaster_user_id: '123', broadcaster_user_name: 'Streamer', chatter_user_id: '456',
    chatter_user_name: 'Viewer', message_id: 'message', message: { text: '!clip' }, badges: [],
};

describe('Twitch clip command matching', () => {
    it('uses trailing context as an optional bounded Unicode title', () => {
        expect(getClipCommandTitle(message)).toBeUndefined();
        expect(getClipCommandTitle({ ...message, message: { text: '  !moment   Nice\nplay\u0000!  ' } })).toBe('Nice play !');
        expect(getClipCommandTitle({ ...message, message: { text: `!clip ${'😀'.repeat(101)}` } })).toBe('😀'.repeat(100));
        expect(getClipCommandTitle({ ...message, message: { text: '!clip   ' } })).toBeUndefined();
    });
    it('matches a whole command or alias case-insensitively with optional trailing text', () => {
        expect(matchesClipCommand(config, { ...message, message: { text: '  !CLIP nice play' } })).toBe(true);
        expect(matchesClipCommand(config, { ...message, message: { text: '!moment' } })).toBe(true);
        for (const text of ['!clipper', 'hello !clip', '', '!momentous']) {
            expect(matchesClipCommand(config, { ...message, message: { text } })).toBe(false);
        }
    });

    it('ignores disabled, different-channel and relayed Shared Chat commands', () => {
        expect(matchesClipCommand({ ...config, enabled: false }, message)).toBe(false);
        expect(matchesClipCommand({ ...config, broadcasterId: 'other' }, message)).toBe(false);
        expect(matchesClipCommand(config, { ...message, source_broadcaster_user_id: 'other' })).toBe(false);
        expect(matchesClipCommand(config, { ...message, source_broadcaster_user_id: '123' })).toBe(true);
    });

    it('enforces owner, moderator and subscriber/founder permissions', () => {
        const owner = { ...message, chatter_user_id: '123' };
        const mod = { ...message, badges: [{ set_id: 'moderator' }] };
        const sub = { ...message, badges: [{ set_id: 'subscriber' }] };
        const founder = { ...message, badges: [{ set_id: 'founder' }] };
        for (const permission of ['owner', 'moderators', 'subscribers']) {
            expect(matchesClipCommand({ ...config, permission }, owner)).toBe(true);
            expect(matchesClipCommand({ ...config, permission }, message)).toBe(false);
        }
        expect(matchesClipCommand({ ...config, permission: 'owner' }, mod)).toBe(false);
        expect(matchesClipCommand({ ...config, permission: 'moderators' }, mod)).toBe(true);
        expect(matchesClipCommand({ ...config, permission: 'moderators' }, sub)).toBe(false);
        expect(matchesClipCommand({ ...config, permission: 'subscribers' }, mod)).toBe(true);
        expect(matchesClipCommand({ ...config, permission: 'subscribers' }, sub)).toBe(true);
        expect(matchesClipCommand({ ...config, permission: 'subscribers' }, founder)).toBe(true);
        expect(matchesClipCommand({ ...config, permission: 'unknown' }, owner)).toBe(false);
    });
});
