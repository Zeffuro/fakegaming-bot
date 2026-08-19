import type { CommandDeployResult } from '../deploy-commands.js';

interface StartupDeploymentLogger {
    info: (bindings: object, message: string) => void;
    error: (bindings: object, message: string) => void;
}

export type DeployCommandsAtStartup = () => Promise<CommandDeployResult>;

export async function deployCommandsAtStartup(
    deploy: DeployCommandsAtStartup,
    logger: StartupDeploymentLogger,
): Promise<void> {
    try {
        const result = await deploy();
        logger.info({
            mode: result.mode,
            scope: result.scope,
            targets: result.targets.map((target) => ({
                action: target.action,
                key: target.key,
                target: target.target,
            })),
        }, 'Slash command deployment check completed.');
    } catch (err) {
        logger.error({ err }, 'Failed to deploy slash commands:');
    }
}
