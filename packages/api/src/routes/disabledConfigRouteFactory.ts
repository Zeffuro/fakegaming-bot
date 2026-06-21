import type { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, type GuildScopedRecord } from '../utils/authHelpers.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
    canReadGuildScopedRecord,
    loadGuildScopedRecords,
    sendGuildScopedRecords,
    sendNotFound,
} from '../utils/guildScopedRouteHelpers.js';
import { numericIdParamSchema, optionalGuildListQuerySchema } from './sharedSchemas.js';

interface DisabledConfigRecord extends GuildScopedRecord {
    id?: number | null;
    [key: string]: unknown;
}

interface DisabledConfigManager<TRecord extends DisabledConfigRecord, TCreateBody extends Record<string, unknown>> {
    getAllPlain(): Promise<TRecord[]>;
    getManyPlain(where: { guildId: string }): Promise<TRecord[]>;
    exists(where: Record<string, string>): Promise<boolean>;
    findByPkPlain(id: number): Promise<TRecord | null>;
    addPlain(body: TCreateBody): Promise<TRecord>;
    removeByPk(id: number): Promise<void>;
}

interface DisabledConfigRouteOptions<
    TRecord extends DisabledConfigRecord,
    TCreateSchema extends z.ZodTypeAny,
    TCheckSchema extends z.ZodTypeAny,
> {
    getManager: () => DisabledConfigManager<TRecord, z.output<TCreateSchema> & Record<string, unknown>>;
    createSchema: TCreateSchema;
    checkQuerySchema: TCheckSchema;
    nameField: keyof TRecord & string;
    notFoundMessage: string;
    auditTargetType: string;
    auditDisableAction: string;
    auditEnableAction: string;
}

export function createDisabledConfigRouter<
    TRecord extends DisabledConfigRecord,
    TCreateSchema extends z.ZodTypeAny,
    TCheckSchema extends z.ZodTypeAny,
>({
    getManager,
    createSchema,
    checkQuerySchema,
    nameField,
    notFoundMessage,
    auditTargetType,
    auditDisableAction,
    auditEnableAction,
}: DisabledConfigRouteOptions<TRecord, TCreateSchema, TCheckSchema>) {
    const router = createBaseRouter();

    router.get('/', validateQuery(optionalGuildListQuerySchema), async (req, res) => {
        const { guildId } = req.query as z.infer<typeof optionalGuildListQuerySchema>;
        const records = await loadGuildScopedRecords(getManager(), guildId);
        await sendGuildScopedRecords(req, res, records, guildId);
    });

    router.get('/check', jwtAuth, validateQuery(checkQuerySchema), async (req, res) => {
        const query = req.query as z.output<TCheckSchema> & { guildId: string } & Record<string, unknown>;
        const nameValue = String(query[nameField] ?? '');
        const disabled = await getManager().exists({ guildId: query.guildId, [nameField]: nameValue });
        res.json({ disabled });
    });

    router.get('/:id', validateParams(numericIdParamSchema), async (req, res) => {
        const record = await getManager().findByPkPlain(Number(req.params.id));
        if (!record) return sendNotFound(res, notFoundMessage);
        const hasAccess = await canReadGuildScopedRecord(req, res, record);
        if (!hasAccess) return;
        res.json(record);
    });

    router.post('/', jwtAuth, validateBody(createSchema), requireGuildAdmin, async (req, res) => {
        const created = await getManager().addPlain(req.body as z.output<TCreateSchema> & Record<string, unknown>);
        await recordAuditEvent(req, {
            action: auditDisableAction,
            targetType: auditTargetType,
            targetId: created.id ?? null,
            guildId: created.guildId ?? null,
            metadata: {
                [nameField]: created[nameField],
            },
        });
        res.status(201).json(created);
    });

    router.delete('/:id', jwtAuth, validateParams(numericIdParamSchema), async (req, res) => {
        const numericId = Number(req.params.id);
        const existing = await getManager().findByPkPlain(numericId);
        if (!existing) return sendNotFound(res, notFoundMessage);
        const hasAccess = await canReadGuildScopedRecord(req, res, existing);
        if (!hasAccess) return;
        await getManager().removeByPk(numericId);
        await recordAuditEvent(req, {
            action: auditEnableAction,
            targetType: auditTargetType,
            targetId: numericId,
            guildId: existing.guildId ?? null,
            metadata: {
                [nameField]: existing[nameField],
            },
        });
        res.json({ success: true });
    });

    return router;
}
