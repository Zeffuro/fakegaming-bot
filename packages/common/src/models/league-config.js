var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { UserConfig } from './user-config.js';
let LeagueConfig = class LeagueConfig extends Model {
};
__decorate([
    Column(DataType.STRING)
], LeagueConfig.prototype, "summonerName", void 0);
__decorate([
    Column(DataType.STRING)
], LeagueConfig.prototype, "region", void 0);
__decorate([
    Column(DataType.STRING)
], LeagueConfig.prototype, "puuid", void 0);
__decorate([
    ForeignKey(() => UserConfig),
    Column({
        type: DataType.STRING,
        onDelete: 'CASCADE'
    })
], LeagueConfig.prototype, "discordId", void 0);
__decorate([
    BelongsTo(() => UserConfig)
], LeagueConfig.prototype, "user", void 0);
LeagueConfig = __decorate([
    Table
], LeagueConfig);
export { LeagueConfig };
