import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'PersonalSchedules' })
export class PersonalSchedule extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.STRING(64)) declare sourceId: string | null;
    @Index({ name: 'ux_personal_schedule_series', unique: true })
    @Column(DataType.STRING(64)) declare externalKey: string | null;
    @Column(DataType.STRING(160)) declare title: string;
    @Column(DataType.STRING(100)) declare timezone: string;
    @Column(DataType.BIGINT) declare anchorAt: number | null;
    @Column(DataType.INTEGER) declare repeatWeeks: number | null;
    @Column(DataType.BOOLEAN) declare enabled: boolean;
}

@Table({ tableName: 'ScheduleOccurrences' })
export class ScheduleOccurrence extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.STRING(64)) declare scheduleId: string;
    @Index({ name: 'ux_schedule_occurrence_external', unique: true })
    @Column(DataType.STRING(64)) declare externalKey: string;
    @Column(DataType.STRING(1024)) declare eventId: string | null;
    @Column(DataType.STRING(160)) declare title: string;
    @Column(DataType.STRING(100)) declare timezone: string;
    @Column(DataType.BIGINT) declare plannedAt: number;
    @Column(DataType.BIGINT) declare endAt: number | null;
    @Column(DataType.BOOLEAN) declare allDay: boolean;
    @Column(DataType.BOOLEAN) declare cancelled: boolean;
    @Column(DataType.STRING(16)) declare state: 'pending' | 'completed';
    @Column(DataType.BIGINT) declare completedAt: number | null;
    @Column(DataType.TEXT) declare note: string;
    @Column(DataType.INTEGER) declare version: number;
    @Column(DataType.BIGINT) declare nextNotifyAt: number | null;
    @Column(DataType.INTEGER) declare notificationCount: number;
    @Column({ type: DataType.INTEGER, defaultValue: 0 }) declare notificationEpoch: number;
}

@Table({ tableName: 'SchedulePreferences' })
export class SchedulePreferences extends Model {
    @PrimaryKey @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.STRING(100)) declare timezone: string;
    @Column(DataType.STRING(5)) declare quietStart: string | null;
    @Column(DataType.STRING(5)) declare quietEnd: string | null;
    @Column(DataType.INTEGER) declare followupMinutes: number;
    @Column(DataType.INTEGER) declare maxFollowups: number;
}

@Table({ tableName: 'ScheduleNotifications' })
export class ScheduleNotification extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.STRING(64)) declare occurrenceId: string;
    @Index({ name: 'ux_schedule_notification_attempt', unique: true })
    @Column(DataType.STRING(100)) declare attemptKey: string;
    @Column(DataType.STRING(16)) declare status: 'sending' | 'sent' | 'rejected' | 'uncertain';
    @Column(DataType.BIGINT) declare attemptedAt: number;
    @Column(DataType.STRING(32)) declare messageId: string | null;
    @Column(DataType.STRING(32)) declare channelId: string | null;
    @Column(DataType.INTEGER) declare renderedVersion: number;
    @Column(DataType.INTEGER) declare notificationEpoch: number;
    @Column(DataType.BIGINT) declare scheduledAt: number;
}
