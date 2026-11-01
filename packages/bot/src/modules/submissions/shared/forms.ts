import {
    FileUploadBuilder, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import type { SubmissionCategoryData, SubmissionRecordData } from '@zeffuro/fakegaming-common/managers';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { submissionCopy } from './copy.js';

export function submissionForm(categories: SubmissionCategoryData[], locale: SupportedOutputLocale, item?: SubmissionRecordData) {
    const t = submissionCopy(locale);
    const modal = new ModalBuilder().setCustomId(item ? `submissions:revision:${item.id}:${item.version}` : 'submissions:new')
        .setTitle(t(item ? 'reviseTitle' : 'formTitle'));
    const choices = new StringSelectMenuBuilder().setCustomId('category').setMinValues(1).setMaxValues(1)
        .addOptions(categories.map(category => ({ label: category.name, value: category.id, default: category.id === item?.categoryId })));
    const link = new TextInputBuilder().setCustomId('link').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(1000);
    const explanation = new TextInputBuilder().setCustomId('explanation').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
    const credit = new TextInputBuilder().setCustomId('credit').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100);
    if (item?.link) link.setValue(item.link);
    if (item?.explanation) explanation.setValue(item.explanation);
    if (item?.credit) credit.setValue(item.credit);
    return modal.addLabelComponents(
        new LabelBuilder().setLabel(t('category')).setStringSelectMenuComponent(choices),
        new LabelBuilder().setLabel(t('screenshots')).setDescription(t('screenshotsHint'))
            .setFileUploadComponent(new FileUploadBuilder().setCustomId('screenshots').setRequired(false).setMinValues(0).setMaxValues(4)),
        new LabelBuilder().setLabel(t('link')).setTextInputComponent(link),
        new LabelBuilder().setLabel(t('explanation')).setTextInputComponent(explanation),
        new LabelBuilder().setLabel(t('credit')).setDescription(t('creditHint')).setTextInputComponent(credit),
    );
}

export function reviewForm(item: SubmissionRecordData, action: 'reject' | 'changes', locale: SupportedOutputLocale) {
    const t = submissionCopy(locale);
    return new ModalBuilder().setCustomId(`submissions:${action}:${item.id}:${item.version}`)
        .setTitle(t(action === 'reject' ? 'rejectedTitle' : 'changesTitle'))
        .addLabelComponents(new LabelBuilder().setLabel(t('reason')).setTextInputComponent(
            new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000),
        ));
}
