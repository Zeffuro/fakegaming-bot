import {Table, Column, Model, DataType, ForeignKey, BelongsTo} from 'sequelize-typescript';
import {UserConfig} from './user-config.js';

@Table
export class LeagueConfig extends Model {
    @Column(DataType.STRING)
    declare summonerName: string;

    @Column(DataType.STRING)
    declare region: string;

    @Column(DataType.STRING)
    declare puuid: string;

    @ForeignKey(() => UserConfig)
    @Column({
        type: DataType.STRING,
        onDelete: 'CASCADE'
    })
    declare discordId: string;

    @BelongsTo(() => UserConfig)
    declare user: UserConfig;
}