import { beforeEach, describe, expect, it } from 'vitest';
import { SubmissionCategory, SubmissionLock, SubmissionPanel, SubmissionRecord } from '../../models/submission.js';
import { SubmissionManager } from '../submissionManager.js';
import type { SubmissionRecordData } from '../../api/submissionSchemas.js';

let now = 1_800_000_000_000;
const manager = () => new SubmissionManager({ now: () => now });
const categoryInput = { name: 'Screenshots', destinationChannelId: '2', reviewChannelId: '3',
    reviewerRoleIds: ['4'], submitterRoleIds: [], enabled: true };
const content = { explanation: 'A nice screenshot', link: 'https://example.com/image', credit: null, attachmentCount: 0 };

beforeEach(async () => {
    now = 1_800_000_000_000;
    await Promise.all([SubmissionRecord.destroy({ where: {} }), SubmissionCategory.destroy({ where: {} }),
        SubmissionLock.destroy({ where: {} }), SubmissionPanel.destroy({ where: {} })]);
});

async function uploading(userId = '10', attachmentCount = 0): Promise<SubmissionRecordData> {
    const m = manager();
    const categories = await m.listCategories('1');
    const category = categories[0] ?? await m.saveCategory('1', categoryInput);
    return m.create({ ...content, guildId: '1', userId, categoryId: category.id, attachmentCount });
}

async function pending(userId = '10'): Promise<SubmissionRecordData> {
    const row = await uploading(userId);
    return manager().finalizeUpload('1', row.id, userId, row.version,
        { reviewChannelId: '3', reviewMessageId: '100', attachments: [] });
}

describe('SubmissionManager', () => {
    it('persists category role arrays, panel references, guild isolation and optimistic edits', async () => {
        const m = manager();
        const category = await m.saveCategory('1', { ...categoryInput, reviewerRoleIds: ['4', '4'] });
        expect(category.reviewerRoleIds).toEqual(['4']);
        expect(await m.getCategory('9', category.id)).toBeNull();
        const edits = await Promise.allSettled([
            m.saveCategory('1', { ...categoryInput, name: 'One' }, category.id, 0),
            manager().saveCategory('1', { ...categoryInput, name: 'Two' }, category.id, 0),
        ]);
        expect(edits.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(edits.filter(result => result.status === 'rejected')).toHaveLength(1);
        await m.setPanel('1', { channelId: '9', messageId: '99' });
        expect(await manager().getPanel('1')).toEqual({ guildId: '1', channelId: '9', messageId: '99' });
    });

    it('reserves before uploads and enforces cooldown across manager instances and categories', async () => {
        const row = await uploading();
        const category = await manager().saveCategory('1', { ...categoryInput, name: 'Clips' });
        await expect(manager().create({ ...content, guildId: '1', categoryId: category.id, userId: '10' }))
            .rejects.toMatchObject({ code: 'cooldown' });
        expect(row).toMatchObject({ status: 'uploading' });
        now += 60_000;
        const attempts = await Promise.allSettled([
            manager().create({ ...content, guildId: '1', categoryId: row.categoryId, userId: '10' }),
            manager().create({ ...content, guildId: '1', categoryId: category.id, userId: '10' }),
        ]);
        expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
        expect(await SubmissionRecord.count()).toBe(2);
    });

    it('caps active submissions across categories and paginates only the owner records', async () => {
        for (let i = 0; i < 5; i++) { await pending(); now += 60_000; }
        await expect(uploading()).rejects.toMatchObject({ code: 'active-limit' });
        expect(await manager().listOwn('1', '10')).toHaveLength(5);
        expect(await manager().listOwn('9', '10')).toEqual([]);
        expect(await manager().listOwn('1', '11')).toEqual([]);
        expect(await manager().listOwn('1', '10', 1)).toEqual([]);
        expect(await manager().listForRefresh(0, 2)).toHaveLength(2);
        expect(await manager().listForRefresh(2, 2)).toHaveLength(2);
    });

    it('counts failed uploads toward the active limit while allowing their retry at the limit', async () => {
        const failed: SubmissionRecordData[] = [];
        for (let i = 0; i < 5; i++) {
            const row = await uploading();
            failed.push(await manager().failUpload('1', row.id, '10', row.version));
            now += 60_000;
        }
        await expect(uploading()).rejects.toMatchObject({ code: 'active-limit' });
        const retry = failed[0]!;
        const revised = await manager().beginRevision('1', retry.id, '10', retry.version, content);
        expect(revised).toMatchObject({ status: 'uploading', version: retry.version + 1 });
        expect(await SubmissionRecord.count()).toBe(5);
        now += 60_000;
        await expect(uploading()).rejects.toMatchObject({ code: 'active-limit' });
    });

    it('rejects malformed content, empty media and credential-bearing or non-HTTP links', async () => {
        const category = await manager().saveCategory('1', categoryInput);
        for (const invalid of [{ explanation: '' }, { attachmentCount: -1 }, { attachmentCount: 5 },
            { link: null }, { link: 'javascript:alert(1)' }, { link: 'https://user:password@example.com' }]) {
            await expect(manager().create({ ...content, ...invalid, guildId: '1', categoryId: category.id, userId: '10' }))
                .rejects.toMatchObject({ code: 'invalid-content' });
        }
        expect(await SubmissionRecord.count()).toBe(0);
    });

    it('enforces the category dropdown bound atomically across manager instances', async () => {
        const m = manager();
        for (let i = 0; i < 24; i++) await m.saveCategory('1', { ...categoryInput, name: `Category ${i}` });
        const attempts = await Promise.allSettled([
            m.saveCategory('1', { ...categoryInput, name: 'Last' }),
            manager().saveCategory('1', { ...categoryInput, name: 'Overflow' }),
        ]);
        expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
        expect(await m.listCategories('1')).toHaveLength(25);
    });

    it('rejects foreign owners, guilds, wrong review channels and attachment count/type mismatches', async () => {
        const row = await uploading('10', 1);
        const attachment = { id: '500', name: 'screenshot-1.png', size: 50, contentType: 'image/png' };
        const m = manager();
        await expect(m.failUpload('1', row.id, '11', 0)).rejects.toMatchObject({ code: 'forbidden' });
        await expect(m.failUpload('9', row.id, '10', 0)).rejects.toMatchObject({ code: 'not-found' });
        await expect(m.finalizeUpload('1', row.id, '10', 0, { reviewChannelId: '9', reviewMessageId: '50', attachments: [attachment] }))
            .rejects.toMatchObject({ code: 'invalid-attachments' });
        await expect(m.finalizeUpload('1', row.id, '10', 0, { reviewChannelId: '3', reviewMessageId: '50', attachments: [] }))
            .rejects.toMatchObject({ code: 'invalid-attachments' });
        await expect(m.finalizeUpload('1', row.id, '10', 0, { reviewChannelId: '3', reviewMessageId: '50', attachments: [{ ...attachment, contentType: 'image/svg+xml' }] }))
            .rejects.toMatchObject({ code: 'invalid-attachments' });
        const done = await m.finalizeUpload('1', row.id, '10', 0, { reviewChannelId: '3', reviewMessageId: '50', attachments: [attachment] });
        expect(done.attachments).toEqual([attachment]);
        expect(done).toMatchObject({ status: 'pending' });
    });

    it('permits one approval claim during concurrent approval/rejection and requires exact versions', async () => {
        const row = await pending();
        const attempts = await Promise.allSettled([
            manager().claimPublish('1', row.id, row.version, '20'),
            manager().review('1', row.id, row.version, '21', 'reject', 'Rejected'),
        ]);
        expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
        const fresh = (await manager().get('1', row.id))!;
        await expect(manager().claimPublish('1', row.id, row.version, '20')).rejects.toMatchObject({ code: 'stale' });
        expect(fresh.version).toBe(row.version + 1);
    });

    it('commits publication even when a competing approval rolls back on the shared SQLite connection', async () => {
        const row = await pending();
        const claim = manager().claimPublish('1', row.id, row.version, '20');
        const duplicate = manager().claimPublish('1', row.id, row.version, '21');
        const publish = claim.then(claimed => manager().finishPublish('1', row.id, claimed.version, '2', '999'));
        const attempts = await Promise.allSettled([publish, duplicate]);
        expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
        expect(await manager().get('1', row.id)).toMatchObject({ status: 'published',
            reviewerId: '20', publishedChannelId: '2', publishedMessageId: '999' });
    });

    it('requires resubmitted content to be reviewed and rejects stale review controls', async () => {
        const row = await pending();
        const requested = await manager().review('1', row.id, row.version, '20', 'changes', 'Please crop it');
        now += 60_000;
        const revised = await manager().beginRevision('1', row.id, '10', requested.version, { ...content, explanation: 'Cropped' });
        expect(revised).toMatchObject({ status: 'uploading' });
        expect(revised.reason).toBeNull();
        expect(revised.reviewerId).toBeNull();
        await expect(manager().claimPublish('1', row.id, row.version, '20')).rejects.toMatchObject({ code: 'stale' });
        await expect(manager().claimPublish('1', row.id, revised.version, '20')).rejects.toMatchObject({ code: 'invalid-state' });
        const ready = await manager().finalizeUpload('1', row.id, '10', revised.version, { reviewChannelId: '3', reviewMessageId: '101', attachments: [] });
        expect(ready.explanation).toBe('Cropped');
        expect(ready.reviewMessageId).toBe('101');
    });

    it('serializes duplicate revision submits and recovers failed upload with a new version', async () => {
        const row = await uploading();
        const failed = await manager().failUpload('1', row.id, '10', row.version);
        now += 60_000;
        const attempts = await Promise.allSettled([
            manager().beginRevision('1', row.id, '10', failed.version, { ...content, explanation: 'First' }),
            manager().beginRevision('1', row.id, '10', failed.version, { ...content, explanation: 'Second' }),
        ]);
        expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
        const current = (await manager().get('1', row.id))!;
        expect(current).toMatchObject({ status: 'uploading', version: failed.version + 1 });
        await expect(manager().finalizeUpload('1', row.id, '10', row.version,
            { reviewChannelId: '3', reviewMessageId: '101', attachments: [] })).rejects.toMatchObject({ code: 'stale' });
    });

    it('enforces image-only prepared filenames and aggregate attachment size', async () => {
        const row = await uploading('10', 3);
        const attachments = [1, 2, 3].map(index => ({ id: String(500 + index), name: `screenshot-${index}.png`,
            size: 8 * 1024 * 1024, contentType: 'image/png' }));
        await expect(manager().finalizeUpload('1', row.id, '10', row.version,
            { reviewChannelId: '3', reviewMessageId: '101', attachments })).rejects.toMatchObject({ code: 'invalid-attachments' });
        attachments[0]!.size = 1;
        const ready = await manager().finalizeUpload('1', row.id, '10', row.version,
            { reviewChannelId: '3', reviewMessageId: '101', attachments });
        expect(ready.attachments).toHaveLength(3);
    });

    it('blocks new/revised/reviewed submissions for a disabled category while retaining history', async () => {
        const row = await pending();
        const category = (await manager().getCategory('1', row.categoryId))!;
        await manager().saveCategory('1', { ...categoryInput, enabled: false }, category.id, category.version);
        await expect(manager().claimPublish('1', row.id, row.version, '20')).rejects.toMatchObject({ code: 'invalid-category' });
        await expect(manager().review('1', row.id, row.version, '20', 'reject', 'No')).rejects.toMatchObject({ code: 'invalid-category' });
        expect(await manager().listCategories('1', true)).toEqual([]);
        expect(await manager().get('1', row.id)).not.toBeNull();
    });

    it('serializes a category disable before a competing approval claim', async () => {
        const row = await pending();
        const category = (await manager().getCategory('1', row.categoryId))!;
        const attempts = await Promise.allSettled([
            manager().saveCategory('1', { ...categoryInput, enabled: false }, category.id, category.version),
            manager().claimPublish('1', row.id, row.version, '20'),
        ]);
        expect(attempts[0]?.status).toEqual('fulfilled');
        expect(attempts[1]).toMatchObject({ status: 'rejected', reason: { code: 'invalid-category' } });
        expect(await manager().get('1', row.id)).toMatchObject({ status: 'pending', version: row.version });
    });

    it('rejects moderation when category roles change after authorization without consuming the submission version', async () => {
        const row = await pending();
        const category = (await manager().getCategory('1', row.categoryId))!;
        const updated = await manager().saveCategory('1', { ...categoryInput, reviewerRoleIds: ['6'] }, category.id, category.version);
        await expect(manager().claimPublish('1', row.id, row.version, '20', category.version))
            .rejects.toMatchObject({ code: 'stale' });
        await expect(manager().review('1', row.id, row.version, '20', 'reject', 'No', category.version))
            .rejects.toMatchObject({ code: 'stale' });
        expect(await manager().get('1', row.id)).toMatchObject({ status: 'pending', version: row.version });
        const reviewed = await manager().review('1', row.id, row.version, '21', 'changes', 'Please crop it', updated.version);
        expect(reviewed).toMatchObject({ status: 'changes_requested', reviewerId: '21', version: row.version + 1 });
    });

    it('distinguishes safe publish retries from unknown outcomes and never replays interrupted publishes', async () => {
        const row = await pending();
        let publishing = await manager().claimPublish('1', row.id, row.version, '20');
        const failed = await manager().failPublish('1', row.id, publishing.version, false);
        publishing = await manager().claimPublish('1', row.id, failed.version, '21');
        const uncertain = await manager().failPublish('1', row.id, publishing.version, true);
        await expect(manager().claimPublish('1', row.id, uncertain.version, '20')).rejects.toMatchObject({ code: 'invalid-state' });
        const second = await pending('11');
        publishing = await manager().claimPublish('1', second.id, second.version, '20');
        const upload = await uploading('12');
        now += 1;
        expect(await manager().recoverInterrupted()).toBe(2);
        expect((await manager().get('1', second.id))?.status).toBe('uncertain');
        expect((await manager().get('1', upload.id))?.status).toBe('upload_failed');
        expect(await manager().recoverInterrupted()).toBe(0);
        await expect(manager().finishPublish('1', second.id, publishing.version, '2', '999')).rejects.toMatchObject({ code: 'stale' });
    });

    it('recovers only work older than the startup cutoff and preserves new in-flight uploads', async () => {
        const old = await uploading('10');
        now += 1000;
        const fresh = await uploading('11');
        expect(await manager().recoverInterrupted()).toBe(1);
        expect(await manager().get('1', old.id)).toMatchObject({ status: 'upload_failed', version: old.version + 1 });
        expect(await manager().get('1', fresh.id)).toMatchObject({ status: 'uploading', version: fresh.version });
    });

    it('preserves work started after a retained recovery cutoff when recovery is retried later', async () => {
        const old = await uploading('10');
        now += 1000;
        const cutoff = now;
        now += 1;
        const fresh = await uploading('11');
        now += 60_000;
        expect(await manager().recoverInterrupted(cutoff)).toBe(1);
        expect(await manager().recoverInterrupted(cutoff)).toBe(0);
        expect(await manager().get('1', old.id)).toMatchObject({ status: 'upload_failed' });
        expect(await manager().get('1', fresh.id)).toMatchObject({ status: 'uploading', version: fresh.version });
    });

    it('publishes only to the snapshotted destination and stores final message references once', async () => {
        const row = await pending();
        const publishing = await manager().claimPublish('1', row.id, row.version, '20');
        await expect(manager().finishPublish('1', row.id, publishing.version, '9', '999')).rejects.toMatchObject({ code: 'invalid-content' });
        const published = await manager().finishPublish('1', row.id, publishing.version, '2', '999');
        expect(published).toMatchObject({ status: 'published', publishedChannelId: '2', publishedMessageId: '999', reviewerId: '20' });
        await expect(manager().finishPublish('1', row.id, publishing.version, '2', '1000')).rejects.toMatchObject({ code: 'stale' });
    });

    it('reconciles only a positively identified uncertain message and never overwrites publication', async () => {
        const row = await pending();
        const claim = await manager().claimPublish('1', row.id, row.version, '20');
        const uncertain = await manager().failPublish('1', row.id, claim.version, true);
        await expect(manager().reconcilePublish('1', row.id, uncertain.version, '9', '999')).rejects.toMatchObject({ code: 'invalid-content' });
        const reconciled = await manager().reconcilePublish('1', row.id, uncertain.version, '2', '999');
        expect(reconciled).toMatchObject({ status: 'published' });
        await expect(manager().reconcilePublish('1', row.id, uncertain.version, '2', '1000')).rejects.toMatchObject({ code: 'stale' });
    });

    it('prunes old terminal content while preserving interrupted uploads and unknown publication evidence', async () => {
        const row = await pending();
        await manager().review('1', row.id, row.version, '20', 'reject', 'No thanks');
        const active = await pending('11');
        const claim = await manager().claimPublish('1', active.id, active.version, '20');
        await manager().failPublish('1', active.id, claim.version, true);
        const upload = await uploading('12');
        await manager().failUpload('1', upload.id, '12', upload.version);
        now += 91 * 24 * 60 * 60 * 1000;
        expect(await manager().pruneFinalized('1')).toBe(1);
        expect(await manager().get('1', row.id)).toBeNull();
        expect((await manager().get('1', active.id))?.status).toBe('uncertain');
        expect((await manager().get('1', upload.id))?.status).toBe('upload_failed');
    });
});
