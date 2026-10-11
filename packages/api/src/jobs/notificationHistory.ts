import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager, type NotificationHistoryInput } from '@zeffuro/fakegaming-common/managers';

const log = getLogger({ name: 'api:jobs:notification-history' });

export async function recordNotificationHistory(input: NotificationHistoryInput): Promise<void> {
    try {
        await getConfigManager().personalNotificationHistoryManager.record({ ...input, title: input.title.slice(0, 200) });
    } catch (error) {
        log.warn({ err: error, kind: input.kind }, 'Private notification history write failed');
    }
}
