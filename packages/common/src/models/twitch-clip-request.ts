import {Table, Column, Model, DataType, PrimaryKey, AllowNull} from 'sequelize-typescript';

@Table
export class TwitchClipRequest extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare broadcasterId: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare status: 'creating' | 'ready' | 'failed' | 'delivered';

    @Column(DataType.STRING)
    declare clipId: string | null;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare targetsJson: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare triggerName: string;

    @AllowNull(false)
    @Column(DataType.DATE)
    declare requestedAt: Date;

    @Column(DataType.STRING)
    declare errorCode: string | null;
}
