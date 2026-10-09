import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'CalendarPublications' })
export class CalendarPublication extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ix_calendar_publication_owner' }) @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.STRING(64)) declare sourceId: string;
    @Column(DataType.STRING(32)) declare guildId: string;
    @Column(DataType.STRING(32)) declare channelId: string;
    @Column(DataType.STRING(100)) declare guildName: string;
    @Column(DataType.STRING(100)) declare channelName: string;
    @Column(DataType.INTEGER) declare lookaheadDays: number;
    @Column(DataType.INTEGER) declare eventLeadDays: number | null;
    @Column(DataType.STRING(100)) declare publicTitle: string | null;
    @Column({ type: DataType.BOOLEAN, defaultValue: false }) declare includeEventDetails: boolean;
    @Column({ type: DataType.BOOLEAN, defaultValue: false }) declare enabled: boolean;
    @Column({ type: DataType.INTEGER, defaultValue: 1 }) declare version: number;
    @Column(DataType.STRING(32)) declare lastError: string | null;
}

@Table({ tableName: 'CalendarPublicationDrafts' })
export class CalendarPublicationDraft extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.JSON) declare configuration: Record<string, unknown>;
    @Column(DataType.STRING(64)) declare snapshotHash: string;
    @Column(DataType.BIGINT) declare previewAt: number;
    @Column(DataType.BIGINT) declare expiresAt: number;
}

@Table({ tableName: 'CalendarPublicationDeliveries' })
export class CalendarPublicationDelivery extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ix_calendar_publication_delivery' }) @Column(DataType.STRING(64)) declare publicationId: string;
    @Column(DataType.STRING(64)) declare occurrenceId: string;
    @Column(DataType.STRING(16)) declare kind: 'message' | 'event';
    @Column(DataType.STRING(16)) declare status: 'sending' | 'sent' | 'rejected' | 'uncertain' | 'missing';
    @Column(DataType.STRING(32)) declare remoteId: string | null;
    @Column(DataType.STRING(64)) declare renderedHash: string | null;
    @Column(DataType.BIGINT) declare attemptedAt: number;
}

@Table({ tableName: 'CalendarEventSnapshotStates' })
export class CalendarEventSnapshotState extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare sourceId: string;
    @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.BIGINT) declare observedAt: number;
}

@Table({ tableName: 'CalendarEventSnapshots' })
export class CalendarEventSnapshot extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ix_calendar_snapshot_source' }) @Column(DataType.STRING(64)) declare sourceId: string;
    @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.STRING(64)) declare scheduleId: string;
    @Column(DataType.STRING(1024)) declare eventId: string;
    @Column(DataType.STRING(160)) declare title: string;
    @Column(DataType.STRING(2048)) declare htmlLink: string | null;
    @Column(DataType.STRING(100)) declare location: string | null;
    @Column(DataType.STRING(1000)) declare description: string | null;
    @Column(DataType.STRING(100)) declare timezone: string;
    @Column(DataType.BIGINT) declare plannedAt: number;
    @Column(DataType.BIGINT) declare endAt: number | null;
    @Column(DataType.BOOLEAN) declare allDay: boolean;
    @Column(DataType.BOOLEAN) declare cancelled: boolean;
}
