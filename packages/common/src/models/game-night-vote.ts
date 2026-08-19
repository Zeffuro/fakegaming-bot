import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'GameNightVotes' })
export class GameNightVote extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare sessionId: string;

    @PrimaryKey
    @Column(DataType.STRING)
    declare userId: string;

    @Column(DataType.STRING)
    declare nominationId: string;
}
