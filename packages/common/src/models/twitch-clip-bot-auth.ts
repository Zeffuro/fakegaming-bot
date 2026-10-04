import {Table, Column, Model, DataType, PrimaryKey, AllowNull, Default} from 'sequelize-typescript';

@Table
export class TwitchClipBotAuth extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare userId: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare login: string;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare encryptedAccessToken: string;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare encryptedRefreshToken: string;

    @AllowNull(false)
    @Column(DataType.DATE)
    declare expiresAt: Date;

    @Default([])
    @AllowNull(false)
    @Column(DataType.JSON)
    declare scopes: string[];
}

@Table
export class TwitchClipOAuthState extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare actorId: string;

    @AllowNull(false)
    @Column(DataType.DATE)
    declare expiresAt: Date;
}
