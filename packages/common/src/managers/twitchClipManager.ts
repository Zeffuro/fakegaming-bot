import {BaseManager} from './baseManager.js';
import {TwitchClipConfig} from '../models/twitch-clip-config.js';

export class TwitchClipManager extends BaseManager<TwitchClipConfig> {
    constructor() {
        super(TwitchClipConfig);
    }
}
