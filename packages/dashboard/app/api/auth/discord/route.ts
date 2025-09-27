import {NextResponse} from "next/server";
import {getDiscordOAuthUrl} from "../../../utils/discordOAuth";

export async function GET() {
    const url = getDiscordOAuthUrl();
    return NextResponse.redirect(url);
}
