import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'CalendarConnections' })
export class CalendarConnection extends Model {
    @PrimaryKey @Column(DataType.STRING(32)) declare userId: string;
    @Column(DataType.TEXT) declare encryptedAccessToken: string | null;
    @Column(DataType.TEXT) declare encryptedRefreshToken: string | null;
    @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 }) declare expiresAt: number;
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 }) declare version: number;
    @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'disconnected' }) declare status: 'connected' | 'disconnected';
}

@Table({ tableName: 'CalendarOAuthStates' })
export class CalendarOAuthState extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare encryptedVerifier: string;
    @Column({ type: DataType.BIGINT, allowNull: false }) declare expiresAt: number;
}

@Table({ tableName: 'CalendarSources' })
export class CalendarSource extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ix_calendar_source_owner' })
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare calendarId: string;
    @Column({ type: DataType.STRING(250), allowNull: false }) declare label: string;
    @Column({ type: DataType.STRING(100), allowNull: false }) declare timezone: string;
    @Column(DataType.STRING(200)) declare titleFilter: string | null;
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true }) declare enabled: boolean;
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 }) declare version: number;
    @Column(DataType.BIGINT) declare lastSyncedAt: number | null;
}
