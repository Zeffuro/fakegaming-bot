import {NextRequest, NextResponse} from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export async function PUT(req: NextRequest) {
    const jwtToken = req.cookies.get("jwt")?.value;
    if (!jwtToken) return NextResponse.json({error: "Not authenticated"}, {status: 401});
    try {
        const user = jwt.verify(jwtToken, JWT_SECRET);
        return NextResponse.json({user});
    } catch {
        return NextResponse.json({error: "Invalid token"}, {status: 401});
    }
}
