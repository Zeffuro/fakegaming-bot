import {BaseManager} from './baseManager.js';
import {CacheConfig} from '../models/cache-config.js';

export class CacheManager extends BaseManager<CacheConfig> {
    constructor() {
        super(CacheConfig);
    }
}