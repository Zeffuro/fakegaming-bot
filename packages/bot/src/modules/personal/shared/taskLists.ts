import type { ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager, PersonalError, type UserTaskBoard } from '@zeffuro/fakegaming-common/managers';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { personalCopy, personalPage } from './personalCopy.js';

export async function taskListAction(interaction: ChatInputCommandInteraction, locale: SupportedOutputLocale): Promise<{ task: UserTaskBoard } | { content: string } | null> {
    const action = interaction.options.getSubcommand();
    if (!['save-list', 'lists', 'start-list', 'delete-list'].includes(action)) return null;
    const cm = getConfigManager(); const manager = cm.userChecklistTemplateManager;
    const userId = interaction.user.id; const t = personalCopy(locale);
    if (action === 'save-list') {
        const task = await cm.userTaskManager.get(interaction.options.getString('task', true), userId);
        if (!task) throw new PersonalError('missing');
        const saved = await manager.create(userId, interaction.options.getString('name', true), task.checklist.map(item => item.text));
        return { content: `${t('lists.saved', { title: saved.title })}\n${t('common.id', { id: saved.id })}` };
    }
    if (action === 'lists') {
        const page = personalPage(await manager.list(userId), interaction.options.getInteger('page') ?? 1);
        return { content: [t('lists.title'), ...page.items.map(list => `${list.title} — ${t('lists.items', { count: list.items.length })}\n${t('common.id', { id: list.id })}`),
            page.items.length ? t('common.page', { page: page.page, pages: page.pages }) : t('common.empty')].join('\n') };
    }
    const list = await manager.get(interaction.options.getString('list', true), userId);
    if (!list) throw new PersonalError('missing');
    if (action === 'delete-list') { await manager.remove(list.id, userId, list.version); return { content: t('lists.removed') }; }
    const due = interaction.options.getString('due');
    return { task: await manager.start(list.id, userId, list.version, cm.userTaskManager, { due }) };
}
