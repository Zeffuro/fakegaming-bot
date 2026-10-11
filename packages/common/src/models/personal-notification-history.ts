import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';
import type { NotificationHistoryKind, NotificationHistoryReason, NotificationHistoryStatus } from '../api/notificationHistory.js';

@Table({ tableName: 'PersonalNotificationHistory', timestamps: false })
export class PersonalNotificationHistory extends Model {
    @PrimaryKey @Column(DataType.STRING(64)) declare id: string;
    @Index({ name: 'ux_personal_notification_occurrence', unique: true })
    @Column({ type: DataType.STRING(32), allowNull: false }) declare userId: string;
    @Index({ name: 'ux_personal_notification_occurrence', unique: true })
    @Column({ type: DataType.STRING(16), allowNull: false }) declare kind: NotificationHistoryKind;
    @Index({ name: 'ux_personal_notification_occurrence', unique: true })
    @Column({ type: DataType.STRING(256), allowNull: false }) declare occurrenceKey: string;
    @Column({ type: DataType.STRING(16), allowNull: false }) declare status: NotificationHistoryStatus;
    @Column(DataType.STRING(16)) declare reason: NotificationHistoryReason | null;
    @Column({ type: DataType.STRING(200), allowNull: false }) declare title: string;
    @Column({ type: DataType.BIGINT, allowNull: false }) declare scheduledAt: number;
    @Column({ type: DataType.BIGINT, allowNull: false }) declare updatedAt: number;
    @Column(DataType.BIGINT) declare sentAt: number | null;
    @Column(DataType.STRING(32)) declare messageId: string | null;
    @Column(DataType.STRING(32)) declare channelId: string | null;
}
