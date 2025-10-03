import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth/authUtils";
import { CACHE_KEYS, CACHE_TTL, defaultCacheManager } from "@/lib/common/cache";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/env";

export async function GET(req: NextRequest) {
    // Authenticate user
    const authResult = await authenticateUser(req);
    if (!authResult.success) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.statusCode || 401 });
    }
    const user = authResult.user!;

    // Define cache key for user profile
    const userProfileCacheKey = CACHE_KEYS.userProfile(user.discordId);

    try {
        // Attempt to get user data from cache with a fallback to JWT data
        const userData = await defaultCacheManager.getCachedData(
            userProfileCacheKey,
            async () => {
                // If cache miss, try to extract data from JWT token
                console.log(`[UserAPI] Cache miss for user profile ${user.discordId}, extracting from JWT`);

                // Get JWT from cookie
                const jwtToken = req.cookies.get("jwt")?.value;
                if (!jwtToken) {
                    return null;
                }

                try {
                    // Extract more user data from the JWT
                    const decoded = jwt.verify(jwtToken, JWT_SECRET) as any;

                    // Return basic profile from JWT (this is our fallback)
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
