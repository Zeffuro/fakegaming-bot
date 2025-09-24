var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType } from 'sequelize-typescript';
let PatchSubscriptionConfig = class PatchSubscriptionConfig extends Model {
};
__decorate([
    Column(DataType.STRING)
], PatchSubscriptionConfig.prototype, "game", void 0);
__decorate([
    Column(DataType.STRING)
], PatchSubscriptionConfig.prototype, "channelId", void 0);
__decorate([
    Column(DataType.BIGINT)
], PatchSubscriptionConfig.prototype, "lastAnnouncedAt", void 0);
PatchSubscriptionConfig = __decorate([
    Table
], PatchSubscriptionConfig);
export { PatchSubscriptionConfig };
