interface JobConfigManager<T extends object> {
    upsert?: (item: T, fields: string[]) => Promise<unknown>;
}

interface SaveableJobConfig {
    save?: () => Promise<void>;
}

export async function upsertOrSaveJobConfig<T extends object>(
    manager: JobConfigManager<T>,
    config: T,
    fields: string[] = ['id'],
): Promise<void> {
    await manager.upsert?.(config, fields)?.catch(async () => {
        await (config as SaveableJobConfig).save?.();
    });
}
