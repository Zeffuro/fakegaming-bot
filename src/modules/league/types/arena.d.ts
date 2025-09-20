import 'twisted/dist/models-dto/matches/match-v5/match.dto.js';

declare module 'twisted/dist/models-dto/matches/match-v5/match.dto.js' {
    namespace MatchV5DTOs {
        interface ParticipantDto {
            playerSubteamId?: number;
        }
    }
}