/**
 * TypeScript definitions for scraped Aeon's End wiki dataset records.
 */

export interface ScrapedSupplyCard {
  id?: string;
  name: string;
  type: string;
  cost?: string | number;
  effect?: string;
  expansions?: string[];
  page_url?: string;
}

export interface ScrapedUniqueStarter {
  id?: string;
  name: string;
  type: string;
  cost?: string | number;
  effect?: string;
  expansions?: string[];
  mage?: string;
  page_url?: string;
}

export interface ScrapedMage {
  name: string;
  type: string;
  title?: string;
  expansions?: string[];
  charges?: string | number;
  ability_name?: string;
  ability_activation?: string;
  ability_effect?: string;
  unique_cards?: string[];
  starting_hand?: string;
  starting_deck?: string;
  breaches?: string[][];
  page_url?: string;
}

export interface ScrapedNemesis {
  name: string;
  type: string;
  health?: string;
  difficulty?: string;
  expedition_battle?: string;
  unleash?: string;
  increased_difficulty?: string;
  rules?: string;
  setup?: string;
  expansions?: string[];
  page_url?: string;
}

export interface ScrapedNemesisCard {
  id?: string;
  name: string;
  type: string;
  tier?: string;
  effect?: string;
  nemesis?: string;
  expansions?: string[];
  page_url?: string;
  life?: string | number;
  power?: string;
}

export interface ScrapedDataset {
  supply: ScrapedSupplyCard[];
  unique_starters: ScrapedUniqueStarter[];
  mages: ScrapedMage[];
  nemeses: ScrapedNemesis[];
  nemesis_cards: ScrapedNemesisCard[];
}
