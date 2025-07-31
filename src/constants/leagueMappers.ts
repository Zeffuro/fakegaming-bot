export const queueMapper: Record<number, string> = {
    400: 'Draft Pick',
    420: 'Ranked Solo',
    430: 'Blind Pick',
    440: 'Ranked Flex',
    450: 'ARAM',
    700: 'Clash',
    830: 'Co-op vs. AI Intro',
    840: 'Co-op vs. AI Beginner',
    850: 'Co-op vs. AI Intermediate',
    900: 'URF',
    920: 'Legend of the Poro King',
    940: 'Snow ARAM',
    1020: 'One for All',
    1300: 'Nexus Blitz',
    1400: 'Ultimate Spellbook',
    1700: 'Arena',
    2000: 'Tutorial 1',
    2010: 'Tutorial 2',
    2020: 'Tutorial 3',
};

export const rankedTypeMapper: Record<string, string> = {
    'RANKED_SOLO_5x5': 'Ranked Solo',
    'RANKED_FLEX_SR': 'Ranked Flex',
    'RANKED_FLEX_TT': 'Ranked Flex TT',
    'RANKED_TFT': 'Ranked TFT',
};

export const gameModeConvertMap: Record<string, string> = {
    'CLASSIC': 'Summoner\'s Rift',
    'ARAM': 'ARAM',
    'TUTORIAL': 'Tutorial',
    'URF': 'AR Ultra Rapid Fire',
    'CHERRY': 'Arena',
    'ONEFORALL': 'One for All',
    'NEXUSBLITZ': 'Nexus Blitz',
    'ULTBOOK': 'Ultimate Spellbook',
    'FIRSTBLOOD': 'Snowdown Showdown',
    'ASCENSION': 'Ascension',
    'KINGPORO': 'Legend of the Poro King',
    'SIEGE': 'Nexus Siege',
    'ODYSSEY': 'Odyssey',
};