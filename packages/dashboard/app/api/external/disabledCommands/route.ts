import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '@/lib/util/apiClient';
import type {
  disabledCommands_guild_guildId_get_Response200,
  disabledCommands_post_Request,
} from '@/types/apiResponses';

const BOT_API_TOKEN = process.env.BOT_API_TOKEN;
const apiClient = new ApiClient(BOT_API_TOKEN);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');
  if (!guildId) {
    return NextResponse.json({ error: 'Missing guildId' }, { status: 400 });
  }
  try {
    const data = await apiClient.get<disabledCommands_guild_guildId_get_Response200>(`/disabledCommands/guild/${guildId}`);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: error?.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: disabledCommands_post_Request = await req.json();
    const data = await apiClient.post('/disabledCommands', body);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: error?.status || 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    const data = await apiClient.delete(`/disabledCommands/${id}`);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: error?.status || 500 });
  }
}

