export interface LeagueMiniSeriesDto {
    progress?: string;
    wins?: number;
    losses?: number;
    target?: number;
}

export interface LeagueEntryDto {
    queueType: string;
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
    miniSeries?: LeagueMiniSeriesDto;
}

export interface LeaguePerkSelectionDto {
    perk?: number;
}

export interface LeaguePerkStyleDto {
    style?: number;
    selections?: LeaguePerkSelectionDto[];
}

export interface LeagueMatchParticipantDto {
    puuid: string;
    win: boolean;
    championId: number;
    championName?: string;
    champLevel: number;
    summoner1Id: number;
    summoner2Id: number;
    kills: number;
    deaths: number;
    assists: number;
    totalMinionsKilled: number;
    neutralMinionsKilled: number;
    visionScore: number;
    timePlayed: number;
    teamId: number;
    placement?: number;
    riotIdGameName?: string;
    riotIdTagline?: string;
    summonerName?: string;
    teamPosition?: string;
    perks?: {
        styles?: LeaguePerkStyleDto[];
    };
    item0: number;
    item1: number;
    item2: number;
    item3: number;
    item4: number;
    item5: number;
    item6: number;
    playerAugment1?: number;
    playerAugment2?: number;
    playerAugment3?: number;
    playerAugment4?: number;
    playerAugment5?: number;
    playerAugment6?: number;
    playerSubteamId?: number;
    totalDamageDealtToChampions?: number;
    goldEarned?: number;
    wardsPlaced?: number;
    wardsKilled?: number;
    tier?: string;
    rank?: string;
    leagueTier?: string;
}

export interface LeagueMatchDto {
    info: {
        participants: LeagueMatchParticipantDto[];
        gameMode?: string;
        queueId?: number;
        gameEndTimestamp?: number;
        gameDuration?: number;
    };
}

export interface TftTraitDto {
    name: string;
    tier_current: number;
    tier_total?: number;
    num_units?: number;
    style?: number;
}

export interface TftUnitDto {
    character_id: string;
    name?: string;
    tier?: number;
    rarity?: number;
    items?: number[];
    itemNames?: string[];
    chosen?: string;
}

export interface TftParticipantDto {
    puuid: string;
    placement: number;
    level?: number;
    last_round?: number;
    time_eliminated?: number;
    players_eliminated?: number;
    total_damage_to_players?: number;
    gold_left?: number;
    units: TftUnitDto[];
    traits: TftTraitDto[];
}

export interface TftMatchDto {
    info: {
        participants: TftParticipantDto[];
        game_datetime?: number;
        game_length?: number;
        queue_id?: number;
        tft_game_type?: string;
        tft_set_number?: number;
        game_variation?: string;
    };
}
