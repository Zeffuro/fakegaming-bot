import { apiRequest } from './core';
import type { PersonalToday, TodayTaskAction, TodayScheduleAction, TodaySessionAction } from '@zeffuro/fakegaming-common/api';
import type { EditableTask } from './userTasks';
export type { PersonalToday, TodayTask, TodayReminder, TodaySchedule, TodayCountdown, TodaySession } from '@zeffuro/fakegaming-common/api';

const endpoint = '/api/external/personalToday';
export const personalTodayApi = {
    get: () => apiRequest<PersonalToday>(endpoint),
    task: (id: string, body: TodayTaskAction) => apiRequest<EditableTask>(`${endpoint}/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    schedule: (id: string, body: TodayScheduleAction) => apiRequest(`${endpoint}/schedules/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    session: (id: string, body: TodaySessionAction) => apiRequest(`${endpoint}/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
};
