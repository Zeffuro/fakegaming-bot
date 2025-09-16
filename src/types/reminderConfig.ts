export type ReminderConfig = {
    id: string;
    userId: string;
    message: string;
    timespan: string;
    timestamp: number;
    completed?: boolean;
};