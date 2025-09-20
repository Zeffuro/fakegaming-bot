import {BaseManager} from './baseManager.js';
import {TwitchStreamConfig} from '../types/twitchStreamConfig.js';

export class TwitchManager extends BaseManager<TwitchStreamConfig> {
    constructor() {
        super('twitchStreams');
    }
}