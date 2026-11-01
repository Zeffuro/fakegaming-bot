import { describe, expect, it } from 'vitest';
import { SUPPORTED_OUTPUT_LOCALES } from '@zeffuro/fakegaming-common';
import { category, record, userId } from './fixtures.js';
import { reviewForm, submissionForm } from '../shared/forms.js';
import { renderOwnList, renderPublication, renderSubmission, renderSubmissionPanel } from '../shared/presentation.js';
import command from '../commands/submissions.js';

describe('submission forms and presentation', () => {
    for (const locale of SUPPORTED_OUTPUT_LOCALES) {
        it(`serializes real Discord forms and controls within API limits in ${locale}`, () => {
            const form = submissionForm([category()], locale).toJSON();
            expect(form.components).toHaveLength(5);
            expect(JSON.stringify(form)).toContain('"type":19');
            expect(JSON.stringify(form)).toContain('"max_values":4');
            expect(JSON.stringify(form)).toContain('"min_values":0');
            expect(reviewForm(record(), 'changes', locale).toJSON().components).toHaveLength(1);
            expect(submissionForm([category()], locale, record()).toJSON().custom_id).toContain(':revision:');
            expect(renderSubmissionPanel(locale).components[0]!.toJSON().components).toHaveLength(2);
        });
    }

    it('supports every configured category without free-form channel selection', () => {
        const categories = Array.from({ length: 25 }, (_, index) => category({ id: String(index), name: `Category ${index}` }));
        const json = submissionForm(categories, 'en').toJSON();
        expect(JSON.stringify(json)).toContain('Category 24');
        expect(JSON.stringify(json)).not.toContain('channel_id');
    });

    it('keeps moderator feedback and submitter identity out of the anonymous public post', () => {
        const item = record({ reason: 'PRIVATE FEEDBACK', reviewerId: 'PRIVATE REVIEWER', explanation: '@everyone funny **thing**' });
        const publicPost = renderPublication(item, 'en');
        const value = JSON.stringify(publicPost);
        expect(value).not.toContain('PRIVATE');
        expect(value).not.toContain(userId);
        expect(value).toContain('Anonymous');
        expect(publicPost.allowedMentions.parse).toEqual([]);
        expect(renderSubmission(item, 'en', true).embeds[0]!.toJSON().fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ value: `<@${userId}>` }), expect.objectContaining({ value: 'PRIVATE FEEDBACK' }),
        ]));
    });

    it('renders all screenshot attachments and terminal controls correctly', () => {
        const attachments = Array.from({ length: 4 }, (_, index) => ({ id: String(index), name: `screenshot-${index + 1}.png`, contentType: 'image/png', size: 100 }));
        const item = record({ attachments, attachmentCount: 4, status: 'changes_requested' });
        expect(renderPublication(item, 'en').embeds.map(embed => embed.toJSON().image?.url)).toEqual(attachments.map(file => `attachment://${file.name}`));
        expect(JSON.stringify(renderSubmission(item, 'en', false))).toContain('submissions:edit:');
        expect(JSON.stringify(renderSubmission(record({ status: 'rejected' }), 'en', true))).not.toContain('submissions:approve:');
        expect(renderOwnList(Array.from({ length: 5 }, () => item), 0, 'en').components).toHaveLength(2);
    });

    it('localizes all command options and keeps member commands available without administrator default permissions', () => {
        const json = command.data.toJSON();
        expect(json.default_member_permissions).toBeUndefined();
        expect(json.description_localizations?.nl).toBeTruthy();
        expect(json.options).toHaveLength(4);
    });
});
