import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth/authUtils";
import { CACHE_KEYS, CACHE_TTL, defaultCacheManager, verifyJwt } from "@zeffuro/fakegaming-common";
import { getJwtConfig } from "@/lib/env";
import { createSimpleLogger } from "@/lib/simpleColorLogger";

const log = createSimpleLogger("dashboard:user-api");

export async function GET(req: NextRequest) {
    const authResult = await authenticateUser(req);
    if (!authResult.success) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.statusCode || 401 });
    }
    const user = authResult.user!;

    const userProfileCacheKey = CACHE_KEYS.userProfile(user.discordId);

    try {
        const userData = await defaultCacheManager.getCachedData(
            userProfileCacheKey,
            async () => {
                log.debug({ userId: user.discordId }, "Cache miss for user profile, extracting from JWT");

                const jwtToken = req.cookies.get("jwt")?.value;
                if (!jwtToken) {
                    return null;
                }

                try {
                    const { secret, audience, issuer } = getJwtConfig();
                    const decoded = verifyJwt(jwtToken, secret, audience, issuer) as any;

                    return {
                        id: decoded.discordId,
                        username: decoded.username,
                        global_name: decoded.global_name,
                        discriminator: decoded.discriminator,
                        avatar: decoded.avatar
                    };
                } catch (e) {
                    log.warn({ err: e }, "Failed to extract user data from JWT");
                    return null;
                }
            },
            CACHE_TTL.USER_PROFILE
        );

        if (!userData) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        return NextResponse.json(userData);
    } catch (error) {
        log.error({ err: error }, "Error fetching user data");
        return NextResponse.json({ error: "Failed to retrieve user data" }, { status: 500 });
    }
}
