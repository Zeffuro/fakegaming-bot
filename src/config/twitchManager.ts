import {BaseManager} from './baseManager.js';
import {TwitchStreamConfig} from '../types/twitchStreamConfig.js';

/**
 * Manages Twitch stream configuration records.
 */
export class TwitchManager extends BaseManager<TwitchStreamConfig> {
    /**
     * Creates a new TwitchManager.
     */
    constructor() {
        super('twitchStreams');
    }
}