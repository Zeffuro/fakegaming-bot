import {ConfigManager} from './configManager.js';

let _configManager: ConfigManager | undefined;

export function getConfigManager(): ConfigManager {
    if (!_configManager) {
        _configManager = new ConfigManager();
    }
    return _configManager;
}