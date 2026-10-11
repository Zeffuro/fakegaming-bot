import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'MorningBriefingSettings' })
export class MorningBriefingSettings extends Model {
    @PrimaryKey @Column(DataType.STRING(32)) declare userId: string;
    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) declare enabled: boolean;
    @Column({ type: DataType.STRING(5), allowNull: false, defaultValue: '09:00' }) declare localTime: string;
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) declare version: number;
}

@Table({ tableName: 'MorningBriefingDeliveries' })
export class MorningBriefingDelivery extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ux_morning_briefing_day', unique: true })
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Index({ name: 'ux_morning_briefing_day', unique: true })
    @Column({ type: DataType.STRING(10), allowNull: false }) declare localDate: string;
    @Column({ type: DataType.STRING(100), allowNull: false }) declare timezone: string;
    @Column({ type: DataType.INTEGER, allowNull: false }) declare settingsVersion: number;
    @Column({ type: DataType.STRING(16), allowNull: false }) declare status: 'sending' | 'sent' | 'rejected' | 'uncertain' | 'skipped';
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 }) declare attempts: number;
    @Column({ type: DataType.STRING(64), allowNull: false }) declare claimToken: string;
    @Column({ type: DataType.BIGINT, allowNull: false }) declare attemptedAt: number;
    @Column(DataType.BIGINT) declare retryAt: number | null;
}
