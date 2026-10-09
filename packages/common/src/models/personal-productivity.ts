import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'UserTasks' })
export class UserTask extends Model {
    @PrimaryKey
    @Column(DataType.STRING(64))
    declare id: string;

    @Column(DataType.STRING(32))
    declare userId: string;

    @Column(DataType.STRING(120))
    declare title: string;

    @Column(DataType.TEXT)
    declare checklistJson: string;

    @Column(DataType.STRING(16))
    declare state: 'active' | 'completed';

    @Column(DataType.BIGINT)
    declare dueAt: number | null;

    @Column(DataType.STRING(16))
    declare recurrenceUnit: 'day' | 'week' | 'month' | null;

    @Column(DataType.INTEGER)
    declare recurrenceInterval: number | null;

    @Column(DataType.STRING(100))
    declare timezone: string;

    @Column(DataType.STRING(64))
    declare reminderId: string | null;

    @Column(DataType.BIGINT)
    declare completedAt: number | null;

    @Column(DataType.INTEGER)
    declare version: number;

    @Column(DataType.INTEGER)
    declare completions: number;
}

@Table({ tableName: 'UserSessions' })
export class UserSession extends Model {
    @PrimaryKey
    @Column(DataType.STRING(64))
    declare id: string;

    @Column(DataType.STRING(32))
    declare userId: string;

    @Column(DataType.STRING(120))
    declare title: string;

    @Column(DataType.STRING(16))
    declare kind: 'focus' | 'gaming';

    @Column(DataType.STRING(16))
    declare state: 'running' | 'paused' | 'stopped' | 'finished';

    @Index({ name: 'ux_user_session_active', unique: true })
    @Column(DataType.STRING(32))
    declare activeKey: string | null;

    @Column(DataType.BIGINT)
    declare startedAt: number;

    @Column(DataType.BIGINT)
    declare runningSince: number | null;

    @Column(DataType.BIGINT)
    declare endedAt: number | null;

    @Column(DataType.BIGINT)
    declare workMs: number;

    @Column(DataType.BIGINT)
    declare breakElapsedMs: number;

    @Column(DataType.BIGINT)
    declare phaseElapsedMs: number;

    @Column(DataType.BIGINT)
    declare durationMs: number | null;

    @Column(DataType.BOOLEAN)
    declare pomodoro: boolean;

    @Column(DataType.STRING(16))
    declare phase: 'focus' | 'break';

    @Column(DataType.BIGINT)
    declare breakMs: number;

    @Column(DataType.INTEGER)
    declare cycles: number;

    @Column(DataType.INTEGER)
    declare cycleIndex: number;

    @Column(DataType.BIGINT)
    declare breakEveryMs: number | null;

    @Column(DataType.BIGINT)
    declare nextBreakMs: number | null;

    @Column(DataType.STRING(64))
    declare reminderId: string | null;

    @Column(DataType.TEXT)
    declare messagesJson: string;

    @Column(DataType.INTEGER)
    declare version: number;
}

@Table({ tableName: 'UserCountdowns' })
export class UserCountdown extends Model {
    @PrimaryKey
    @Column(DataType.STRING(64))
    declare id: string;

    @Column(DataType.STRING(32))
    declare userId: string;

    @Column(DataType.STRING(120))
    declare title: string;

    @Column(DataType.BIGINT)
    declare dueAt: number;

    @Column(DataType.STRING(100))
    declare timezone: string;

    @Column(DataType.INTEGER)
    declare advanceMinutes: number | null;

    @Column(DataType.TEXT)
    declare reminderIdsJson: string;
}
