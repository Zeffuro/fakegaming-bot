import { Column, DataType, Default, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table
export class QuoteOfDayConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.STRING)
    declare channelId: string;

    @Default(false)
    @Index('idx_quote_of_day_enabled_hour')
    @Column(DataType.BOOLEAN)
    declare enabled: boolean;

    @Default(9)
    @Index('idx_quote_of_day_enabled_hour')
    @Column(DataType.INTEGER)
    declare runHourUtc: number;
}
