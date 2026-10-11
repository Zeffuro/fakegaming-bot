export const dashboardSectionIds = ['today', 'calendar', 'tasks', 'briefing', 'notificationHistory', 'pollTemplates', 'checklistTemplates',
    'noteEditor', 'notes', 'reminders', 'anime', 'reminderEditor', 'subscriptions', 'settings', 'digest', 'riot', 'activity'] as const;
export type DashboardSectionId = typeof dashboardSectionIds[number];
export interface DashboardSection { id: DashboardSectionId; visible: boolean }
export interface PersonalDashboardLayout { schemaVersion: 1; version: number; sections: DashboardSection[] }

export function defaultDashboardSections(): DashboardSection[] {
    const order: DashboardSectionId[] = ['today', 'subscriptions', 'tasks', 'notes', 'checklistTemplates', 'pollTemplates', 'noteEditor',
        'calendar', 'reminders', 'anime', 'briefing', 'digest', 'notificationHistory', 'reminderEditor', 'settings', 'riot', 'activity'];
    return order.map(id => ({ id, visible: true }));
}

export function mergeDashboardSections(saved: unknown): DashboardSection[] {
    const result: DashboardSection[] = []; const seen = new Set<string>();
    if (Array.isArray(saved)) for (const entry of saved) {
        if (entry && typeof entry === 'object' && dashboardSectionIds.includes(entry.id as DashboardSectionId)
            && typeof entry.visible === 'boolean' && !seen.has(entry.id)) {
            seen.add(entry.id); result.push({ id: entry.id as DashboardSectionId, visible: entry.visible });
        }
    }
    return [...result, ...defaultDashboardSections().filter(entry => !seen.has(entry.id))];
}

export function validDashboardLayout(value: unknown): value is PersonalDashboardLayout {
    if (!value || typeof value !== 'object') return false;
    const layout = value as PersonalDashboardLayout;
    return Object.keys(value).every(key => ['schemaVersion', 'version', 'sections'].includes(key))
        && layout.schemaVersion === 1 && Number.isSafeInteger(layout.version) && layout.version >= 0
        && Array.isArray(layout.sections) && layout.sections.length === dashboardSectionIds.length
        && layout.sections.every(entry => entry && typeof entry === 'object' && Object.keys(entry).length === 2
            && dashboardSectionIds.includes(entry.id) && typeof entry.visible === 'boolean')
        && new Set(layout.sections.map(entry => entry.id)).size === dashboardSectionIds.length;
}
