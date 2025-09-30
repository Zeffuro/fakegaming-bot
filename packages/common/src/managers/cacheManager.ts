import {BaseManager} from './baseManager.js';
import {CacheConfig} from '../models/cache-config.js';

/**
 * Manages Cache configuration records.
 */
export class CacheManager extends BaseManager<CacheConfig> {
    constructor() {
        super(CacheConfig);
    }
}