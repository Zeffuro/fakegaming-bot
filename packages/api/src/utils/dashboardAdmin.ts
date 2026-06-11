import type { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedRequest } from '../types/express.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';

export function isDashboardAdmin(discordId: string | undefined): boolean {
    if (!discordId) return false;
    const raw = process.env.DASHBOARD_ADMINS || '';
    const ids = raw.split(',').map(id => id.trim()).filter(Boolean);
    return ids.includes(discordId);
}

function hasValidDashboardAdminSignature(req: Request): boolean {
    const discordId = req.header('x-dashboard-admin-user');
    const reqId = req.header('x-dashboard-admin-request');
    const signature = req.header('x-dashboard-admin-signature');
    const secret = process.env.JWT_SECRET;

    if (!discordId || !reqId || !signature || !secret) {
        return false;
    }

    const expected = createHmac('sha256', secret)
        .update(`${discordId}:${reqId}`)
        .digest('hex');

    const actualBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function requireDashboardAdmin(req: Request, res: Response, next: NextFunction): void {
    const discordId = (req as AuthenticatedRequest).user?.discordId;
    const dashboardAdminUser = req.header('x-dashboard-admin-user');
    const isTrustedDashboardAdmin = (isServiceRequest(req) && Boolean(dashboardAdminUser))
        || hasValidDashboardAdminSignature(req);

    if (!isTrustedDashboardAdmin && !isDashboardAdmin(discordId)) {
        res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Only dashboard admins can manage Riot links',
            },
        });
        return;
    }
    next();
}
