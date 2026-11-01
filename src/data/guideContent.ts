import rawGuide from "../../content/guide.json";

/**
 * De inhoud van de Gids, uit content/guide.json. Net als trip.json bewerk je
 * die zonder code; `pnpm validate` controleert hem.
 */

export interface SinhalaWord {
  id: string;
  /** Latijnse schrijfwijze, zoals je het op bordjes en menukaarten tegenkomt. */
  word: string;
  /** Hetzelfde woord in Singalees schrift. */
  script: string;
  /** Uitspraak voor een Nederlandse lezer, lettergrepen met streepjes. */
  say: string;
  meaning: string;
  /** Wanneer of hoe je het gebruikt, als dat niet vanzelf spreekt. */
  tip?: string;
}

export interface WordGroup {
  id: string;
  title: string;
  /** Of de woorden meedoen in het woord van de dag. Getallen bijvoorbeeld niet. */
  daily: boolean;
  words: SinhalaWord[];
}

export interface GuideTip {
  id: string;
  title: string;
  body: string;
}

export interface TipModule {
  id: string;
  title: string;
  intro: string;
  tips: GuideTip[];
}

interface RawGuide {
  wordGroups: WordGroup[];
  tipModules: TipModule[];
}

const guide = rawGuide as RawGuide;

export const wordGroups = guide.wordGroups;
export const tipModules = guide.tipModules;
export const allWords = wordGroups.flatMap((group) => group.words);
/** De woorden waar het woord van de dag doorheen rouleert. */
export const dailyWords = wordGroups.filter((group) => group.daily).flatMap((group) => group.words);
export const allTips = tipModules.flatMap((module) => module.tips);
