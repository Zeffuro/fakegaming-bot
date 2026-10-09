export const tasks = { name: 'tasks', description: 'Manage your private tasks and checklists' } as const;
export const session = { name: 'session', description: 'Track private focus and gaming sessions' } as const;
export const countdowns = { name: 'countdowns', description: 'Manage private countdowns to exact dates' } as const;

export const COMMANDS = [tasks, session, countdowns] as const;
void COMMANDS;
