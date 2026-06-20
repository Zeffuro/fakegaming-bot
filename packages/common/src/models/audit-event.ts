import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Index, Default } from 'sequelize-typescript';

export const AUDIT_EVENT_SEVERITIES = ['info', 'warn', 'error'] as const;
export const AUDIT_EVENT_STATUSES = ['success', 'failure'] as const;
export const AUDIT_ACTOR_TYPES = ['user', 'service', 'system'] as const;

export type AuditEventSeverity = typeof AUDIT_EVENT_SEVERITIES[number];
export type AuditEventStatus = typeof AUDIT_EVENT_STATUSES[number];
export type AuditActorType = typeof AUDIT_ACTOR_TYPES[number];
export type AuditEventMetadata = Record<string, unknown>;

@Table({ tableName: 'AuditEvents' })
export class AuditEvent extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Index('ix_auditevents_timestamp')
    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare timestamp: Date;

    @Index('ix_auditevents_actor')
    @Column(DataType.STRING)
    declare actorId?: string | null;

    @Default('user')
    @Column(DataType.STRING(32))
    declare actorType: AuditActorType;

    @Index('ix_auditevents_action')
    @Column(DataType.STRING(128))
    declare action: string;

    @Column(DataType.STRING(64))
    declare targetType: string;

    @Column(DataType.STRING)
    declare targetId?: string | null;

    @Index('ix_auditevents_guild')
    @Column(DataType.STRING)
    declare guildId?: string | null;

    @Index('ix_auditevents_severity_status')
    @Default('info')
    @Column(DataType.STRING(16))
    declare severity: AuditEventSeverity;

    @Index('ix_auditevents_severity_status')
    @Default('success')
    @Column(DataType.STRING(16))
    declare status: AuditEventStatus;

    @Column(DataType.STRING(128))
    declare requestId?: string | null;

    @Column(DataType.JSON)
    declare metadata?: AuditEventMetadata | null;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare createdAt: Date;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare updatedAt: Date;
}
