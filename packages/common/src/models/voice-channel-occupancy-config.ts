import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'VoiceChannelOccupancyConfigs' })
export class VoiceChannelOccupancyConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare guildId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    declare channelId: string;
}
