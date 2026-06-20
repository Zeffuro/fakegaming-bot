import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Unique, Index, Default } from 'sequelize-typescript';

export const INTEGRATION_HEALTH_STATUSES = ['unknown', 'healthy', 'warning', 'error', 'paused'] as const;
export type IntegrationHealthStatus = typeof INTEGRATION_HEALTH_STATUSES[number];
export type IntegrationHealthMetadata = Record<string, unknown>;

@Table({ tableName: 'IntegrationHealth' })
export class IntegrationHealth extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique('unique_integration_health_provider_config')
    @Index('ix_integrationhealth_provider')
    @Index('ix_integrationhealth_guild_provider')
    @Column(DataType.STRING(64))
    declare provider: string;

    @Unique('unique_integration_health_provider_config')
    @Column(DataType.STRING(128))
    declare configId: string;

    @Index('ix_integrationhealth_guild_provider')
    @Column(DataType.STRING)
    declare guildId?: string | null;

    @Column(DataType.STRING)
    declare channelId?: string | null;

    @Index('ix_integrationhealth_status')
    @Default('unknown')
    @Column(DataType.STRING(16))
    declare status: IntegrationHealthStatus;

    @Column(DataType.DATE)
    declare lastCheckedAt?: Date | null;

    @Column(DataType.DATE)
    declare lastSuccessAt?: Date | null;

    @Column(DataType.DATE)
    declare lastFailureAt?: Date | null;

    @Column(DataType.DATE)
    declare lastDeliveryAt?: Date | null;

    @Default(0)
    @Column(DataType.INTEGER)
    declare consecutiveFailures: number;

    @Column(DataType.STRING(64))
    declare lastErrorCode?: string | null;

    @Column(DataType.TEXT)
    declare lastErrorMessage?: string | null;

    @Column(DataType.JSON)
    declare metadata?: IntegrationHealthMetadata | null;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare createdAt: Date;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare updatedAt: Date;
}
