import { ConfigManager } from './configManager.js';
let _configManager;
export function getConfigManager() {
    if (!_configManager) {
        _configManager = new ConfigManager();
    }
    return _configManager;
}
