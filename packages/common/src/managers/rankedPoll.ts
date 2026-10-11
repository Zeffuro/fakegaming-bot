export interface RankedPollRound {
    counts: number[]; active: number[]; exhausted: number; continuing: number; eliminated: number | null;
}
export interface RankedPollResult {
    status: 'winner' | 'tie' | 'no-votes'; winners: number[]; rounds: RankedPollRound[];
}

export function validRanking(ranking: readonly number[], optionCount: number): boolean {
    return Array.isArray(ranking) && ranking.length > 0 && ranking.length <= optionCount && new Set(ranking).size === ranking.length
        && ranking.every(index => Number.isInteger(index) && index >= 0 && index < optionCount);
}

export function countRankedPoll(optionCount: number, ballots: Iterable<readonly number[]>): RankedPollResult {
    if (!Number.isInteger(optionCount) || optionCount < 2 || optionCount > 5) throw new Error('Invalid ranked poll options');
    const rankings = [...ballots];
    if (!rankings.every(ranking => validRanking(ranking, optionCount))) throw new Error('Invalid ranked poll ballot');
    const active = new Set(Array.from({ length: optionCount }, (_, index) => index));
    const rounds: RankedPollRound[] = [];
    if (!rankings.length) return { status: 'no-votes', winners: [], rounds };
    while (active.size) {
        const counts = Array.from({ length: optionCount }, () => 0);
        let exhausted = 0;
        for (const ranking of rankings) {
            const first = ranking.find(index => active.has(index));
            if (first === undefined) exhausted++;
            else counts[first] = (counts[first] ?? 0) + 1;
        }
        const continuing = rankings.length - exhausted;
        const round = { counts, active: [...active], exhausted, continuing, eliminated: null as number | null };
        rounds.push(round);
        const winner = [...active].find(index => (counts[index] ?? 0) > continuing / 2);
        if (winner !== undefined) return { status: 'winner', winners: [winner], rounds };
        const lowest = Math.min(...[...active].map(index => counts[index] ?? 0));
        const tied = [...active].filter(index => counts[index] === lowest);
        // An elimination tie cannot safely select a winner without a declared tie-break rule.
        if (!continuing || tied.length > 1) return { status: 'tie', winners: [...active], rounds };
        round.eliminated = tied[0] ?? null;
        active.delete(tied[0]!);
    }
    throw new Error('Invalid ranked poll count');
}
