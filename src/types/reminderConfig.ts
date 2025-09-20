/**
 * Configuration for a user reminder.
 * - id: The unique ID of the reminder.
 * - userId: The Discord user ID for whom the reminder is set.
 * - message: The reminder message.
 * - timespan: The timespan until the reminder triggers.
 * - timestamp: The timestamp when the reminder was created.
 * - completed: Whether the reminder has been completed (optional).
 */
export type ReminderConfig = {
    id: string;
    userId: string;
    message: string;
    timespan: string;
    timestamp: number;
    completed?: boolean;
};