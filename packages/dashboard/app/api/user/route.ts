import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth/authUtils";
import { CACHE_KEYS, CACHE_TTL, defaultCacheManager } from "@zeffuro/fakegaming-common";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/env";

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
                console.log(`[UserAPI] Cache miss for user profile ${user.discordId}, extracting from JWT`);

                const jwtToken = req.cookies.get("jwt")?.value;
                if (!jwtToken) {
                    return null;
                }

                try {
                    const decoded = jwt.verify(jwtToken, JWT_SECRET) as any;

                    return {
                        id: decoded.discordId,
                        username: decoded.username,
                        global_name: decoded.global_name,
                        discriminator: decoded.discriminator,
                        avatar: decoded.avatar
                    };
                } catch (e) {
                    console.error("[UserAPI] Failed to extract user data from JWT:", e);
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
        console.error("[UserAPI] Error fetching user data:", error);
        return NextResponse.json({ error: "Failed to retrieve user data" }, { status: 500 });
    }
}
