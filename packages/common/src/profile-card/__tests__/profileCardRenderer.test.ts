import { describe, expect, it } from 'vitest';
import { buildProfileCardFilename, PROFILE_CARD_MIME_TYPE, renderProfileCard } from '../profileCardRenderer.js';

describe('profileCardRenderer', () => {
    it('renders a PNG profile card', () => {
        const buffer = renderProfileCard({
            userId: '123456789012345678',
            displayName: 'Fake Gamer',
            username: 'fakegamer',
            discriminator: '0',
            globalName: 'Fake Gamer',
            nickname: 'FG',
            guildName: 'FakeGaming',
        }, { width: 640, height: 360 });

        expect(buffer.length).toBeGreaterThan(1000);
        expect(buffer.subarray(1, 4).toString()).toBe('PNG');
        expect(PROFILE_CARD_MIME_TYPE).toBe('image/png');
    });

    it('builds a safe filename', () => {
        expect(buildProfileCardFilename(' User 123 !! ')).toBe('profile-card-user-123.png');
        expect(buildProfileCardFilename('***')).toBe('profile-card-user.png');
    });
});
