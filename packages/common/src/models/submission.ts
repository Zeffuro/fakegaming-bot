import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';
import type { SubmissionStatus } from '../api/submissionSchemas.js';

@Table({ tableName: 'SubmissionCategories' })
export class SubmissionCategory extends Model {
    @PrimaryKey @Column(DataType.STRING) declare id: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare guildId: string;
    @Column({ type: DataType.STRING(80), allowNull: false }) declare name: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare destinationChannelId: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare reviewChannelId: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare reviewerRoleIdsJson: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare submitterRoleIdsJson: string;
    @Column({ type: DataType.BOOLEAN, allowNull: false }) declare enabled: boolean;
    @Column({ type: DataType.INTEGER, allowNull: false }) declare version: number;
}

@Table({ tableName: 'SubmissionRecords', timestamps: false })
export class SubmissionRecord extends Model {
    @PrimaryKey @Column(DataType.STRING) declare id: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare guildId: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare categoryId: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare categoryName: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare destinationChannelId: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare userId: string;
    @Column({ type: DataType.TEXT, allowNull: false }) declare explanation: string;
    @Column({ type: DataType.TEXT, allowNull: true }) declare link: string | null;
    @Column({ type: DataType.STRING(100), allowNull: true }) declare credit: string | null;
    @Column({ type: DataType.INTEGER, allowNull: false }) declare attachmentCount: number;
    @Column({ type: DataType.STRING, allowNull: false }) declare status: SubmissionStatus;
    @Column({ type: DataType.INTEGER, allowNull: false }) declare version: number;
    @Column({ type: DataType.STRING, allowNull: false }) declare reviewChannelId: string;
    @Column({ type: DataType.STRING, allowNull: true }) declare reviewMessageId: string | null;
    @Column({ type: DataType.TEXT, allowNull: false }) declare attachmentsJson: string;
    @Column({ type: DataType.STRING, allowNull: true }) declare reviewerId: string | null;
    @Column({ type: DataType.TEXT, allowNull: true }) declare reason: string | null;
    @Column({ type: DataType.STRING, allowNull: true }) declare publishedChannelId: string | null;
    @Column({ type: DataType.STRING, allowNull: true }) declare publishedMessageId: string | null;
    @Column({ type: DataType.BIGINT, allowNull: false }) declare createdAt: number;
    @Column({ type: DataType.BIGINT, allowNull: false }) declare updatedAt: number;
}

@Table({ tableName: 'SubmissionLocks', timestamps: false })
export class SubmissionLock extends Model {
    @PrimaryKey @Column(DataType.STRING) declare key: string;
    @Column({ type: DataType.BIGINT, allowNull: true }) declare lastSubmittedAt: number | null;
}

@Table({ tableName: 'SubmissionPanels' })
export class SubmissionPanel extends Model {
    @PrimaryKey @Column(DataType.STRING) declare guildId: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare channelId: string;
    @Column({ type: DataType.STRING, allowNull: false }) declare messageId: string;
}
