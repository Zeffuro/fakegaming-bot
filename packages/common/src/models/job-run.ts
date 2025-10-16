import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Index, Default } from 'sequelize-typescript';

/**
 * Persistent record of a background job execution run.
 */
@Table({ tableName: 'JobRuns' })
export class JobRun extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Index('ix_jobruns_name')
    @Column(DataType.STRING)
    declare name: string; // e.g., 'birthdays', 'heartbeat'

    @Index('ix_jobruns_startedAt')
    @Column(DataType.DATE)
    declare startedAt: Date;

    @Index('ix_jobruns_finishedAt')
    @Column(DataType.DATE)
    declare finishedAt: Date;

    @Column(DataType.BOOLEAN)
    declare ok: boolean;

    @Column(DataType.JSON)
    declare meta?: Record<string, unknown>;

    @Column(DataType.TEXT)
    declare error?: string;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare createdAt: Date;

    @Default(DataType.NOW)
    @Column(DataType.DATE)
    declare updatedAt: Date;
}

