import {NextRequest, NextResponse} from "next/server";
import { verifyJwt } from '@zeffuro/fakegaming-common/src/discord/auth';

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "fakegaming-dashboard";

export async function PUT(req: NextRequest) {
    const jwtToken = req.cookies.get("jwt")?.value;
    console.log("JWT_SECRET", JWT_SECRET, "JWT_AUDIENCE", JWT_AUDIENCE, "jwtToken", jwtToken);
    if (!jwtToken) {
        console.error("No JWT cookie found");
        return NextResponse.json({error: "Not authenticated"}, {status: 401});
    }
    try {
        const user = verifyJwt(jwtToken, JWT_SECRET, JWT_AUDIENCE);
        return NextResponse.json({user});
    } catch (err) {
        // Log error and JWT for debugging
        console.error("JWT verification failed", err, jwtToken);
        return NextResponse.json({error: "Invalid token", details: err?.message || String(err)}, {status: 401});
    }
}
