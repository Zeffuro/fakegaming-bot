import type { DashboardSectionId } from '@zeffuro/fakegaming-common/dashboard-layout';

export const personalDashboardViews = ['overview', 'workspace', 'calendar', 'notifications', 'account', 'all'] as const;
export type PersonalDashboardView = typeof personalDashboardViews[number];
export type PersonalEditorId = 'noteEditor' | 'reminderEditor';
export const personalViewSections: Record<Exclude<PersonalDashboardView, 'all'>, readonly DashboardSectionId[]> = {
    overview: ['today', 'subscriptions'],
    workspace: ['tasks', 'notes', 'noteEditor', 'checklistTemplates', 'pollTemplates'],
    calendar: ['calendar'],
    notifications: ['reminders', 'reminderEditor', 'anime', 'briefing', 'digest', 'notificationHistory'],
    account: ['settings', 'riot', 'activity'],
};

export function personalDashboardView(search: string): PersonalDashboardView {
    const params = new URLSearchParams(search);
    const view = params.get('view');
    return personalDashboardViews.includes(view as PersonalDashboardView) ? view as PersonalDashboardView
        : params.has('googleCalendar') ? 'calendar' : 'overview';
}

export function sectionView(id: DashboardSectionId): Exclude<PersonalDashboardView, 'all'> {
    return (Object.keys(personalViewSections) as Exclude<PersonalDashboardView, 'all'>[])
        .find(view => personalViewSections[view].includes(id))!;
}
