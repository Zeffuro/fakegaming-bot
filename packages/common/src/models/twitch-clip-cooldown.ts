import {Table, Column, Model, DataType, PrimaryKey, AllowNull} from 'sequelize-typescript';

@Table
export class TwitchClipCooldown extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare broadcasterId: string;

    @AllowNull(false)
    @Column(DataType.DATE)
    declare availableAt: Date;
}
