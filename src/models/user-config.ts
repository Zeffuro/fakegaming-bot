import {Table, Column, Model, DataType, PrimaryKey, HasOne} from 'sequelize-typescript';
import {LeagueConfig} from './league-config.js';

@Table
export class UserConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare discordId: string;

    @HasOne(() => LeagueConfig)
    declare league?: LeagueConfig;

    @Column(DataType.STRING)
    declare timezone?: string;

    @Column(DataType.STRING)
    declare defaultReminderTimeSpan?: string;
}