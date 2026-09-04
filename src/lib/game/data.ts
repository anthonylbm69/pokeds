/**
 * Données du jeu : types, attaques, espèces et les formules officielles de
 * statistiques et d'expérience. Tout est local — la PokéAPI ne sert plus qu'à
 * fournir les sprites, pour qu'un combat n'attende jamais le réseau.
 */

import { DEX, EVOLUTIONS, type DexEntry } from "./dex";
import type { Status } from "./battle";

export type TypeName =
  | "normal"
  | "fire"
  | "water"
  | "grass"
  | "electric"
  | "ice"
  | "fighting"
  | "poison"
  | "ground"
  | "flying"
  | "psychic"
  | "bug"
  | "rock"
  | "ghost"
  | "dragon"
  | "dark"
  | "steel"
  | "fairy";

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

/** Les seules cases non neutres de la table des types. */
const CHART: Partial<Record<TypeName, Partial<Record<TypeName, number>>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2,
    flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5,
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: {
    normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5,
    rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2,
    ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/** Multiplicateur d'efficacité d'une attaque contre un ou deux types. */
export function effectiveness(move: TypeName, defender: TypeName[]): number {
  return defender.reduce((mult, t) => mult * (CHART[move]?.[t] ?? 1), 1);
}

export const TYPE_FR: Record<TypeName, string> = {
  normal: "Normal", fire: "Feu", water: "Eau", grass: "Plante",
  electric: "Électrik", ice: "Glace", fighting: "Combat", poison: "Poison",
  ground: "Sol", flying: "Vol", psychic: "Psy", bug: "Insecte",
  rock: "Roche", ghost: "Spectre", dragon: "Dragon", dark: "Ténèbres",
  steel: "Acier", fairy: "Fée",
};

/* --------------------------------------------------------------- attaques */

export type MoveCategory = "physique" | "speciale" | "statut";

export type Move = {
  name: string;
  type: TypeName;
  category: MoveCategory;
  power: number;
  accuracy: number;
  pp: number;
  priority?: number;
  /** Baisse une statistique de l'adversaire de `stages` crans. */
  lower?: { stat: Exclude<StatKey, "hp"> | "acc"; stages: number };
  /**
   * Altération posée sur la cible. Une attaque de statut la pose à coup sûr
   * si la cible est réceptive ; une attaque offensive la tire à `chance`.
   */
  inflicts?: { status: Status; chance: number };
};

const MOVE_DATA = {
  charge: { name: "Charge", type: "normal", category: "physique", power: 50, accuracy: 100, pp: 35 },
  griffe: { name: "Griffe", type: "normal", category: "physique", power: 40, accuracy: 100, pp: 35 },
  "vive-attaque": { name: "Vive-Attaque", type: "normal", category: "physique", power: 40, accuracy: 100, pp: 30, priority: 1 },
  morsure: { name: "Morsure", type: "dark", category: "physique", power: 60, accuracy: 100, pp: 25 },
  "fouet-lianes": { name: "Fouet Lianes", type: "grass", category: "physique", power: 35, accuracy: 100, pp: 25 },
  "tranch-herbe": { name: "Tranch'Herbe", type: "grass", category: "physique", power: 55, accuracy: 95, pp: 25 },
  flammeche: { name: "Flammèche", type: "fire", category: "speciale", power: 40, accuracy: 100, pp: 25, inflicts: { status: "brulure", chance: 0.1 } },
  "pistolet-a-o": { name: "Pistolet à O", type: "water", category: "speciale", power: 40, accuracy: 100, pp: 25 },
  picpic: { name: "Picpic", type: "flying", category: "physique", power: 35, accuracy: 100, pp: 35 },
  tornade: { name: "Tornade", type: "flying", category: "speciale", power: 40, accuracy: 100, pp: 35 },
  rugissement: { name: "Rugissement", type: "normal", category: "statut", power: 0, accuracy: 100, pp: 40, lower: { stat: "atk", stages: 1 } },
  "groz-yeux": { name: "Groz'Yeux", type: "normal", category: "statut", power: 0, accuracy: 100, pp: 30, lower: { stat: "def", stages: 1 } },
  "mimi-queue": { name: "Mimi-Queue", type: "normal", category: "statut", power: 0, accuracy: 100, pp: 30, lower: { stat: "def", stages: 1 } },
  "jet-de-sable": { name: "Jet de Sable", type: "ground", category: "statut", power: 0, accuracy: 100, pp: 15, lower: { stat: "acc", stages: 1 } },

  // Attaques des formes évoluées : de quoi rendre une montée de niveau utile.
  plaquage: { name: "Plaquage", type: "normal", category: "physique", power: 85, accuracy: 100, pp: 15 },
  "lame-feuille": { name: "Lame Feuille", type: "grass", category: "physique", power: 90, accuracy: 100, pp: 15 },
  "lance-flammes": { name: "Lance-Flammes", type: "fire", category: "speciale", power: 90, accuracy: 100, pp: 15, inflicts: { status: "brulure", chance: 0.1 } },
  "coquille-lame": { name: "Coquille Lame", type: "water", category: "physique", power: 75, accuracy: 95, pp: 10 },
  "coupe-vent": { name: "Coupe-Vent", type: "flying", category: "speciale", power: 60, accuracy: 95, pp: 25 },
  balayage: { name: "Balayage", type: "fighting", category: "physique", power: 65, accuracy: 100, pp: 20 },
  vibrobscur: { name: "Vibrobscur", type: "dark", category: "physique", power: 70, accuracy: 100, pp: 15 },

  // Les biomes du nord amènent leurs propres types.
  tunnel: { name: "Tunnel", type: "ground", category: "physique", power: 80, accuracy: 100, pp: 10 },
  "jet-pierres": { name: "Jet-Pierres", type: "rock", category: "physique", power: 50, accuracy: 90, pp: 15 },
  piqure: { name: "Piqûre", type: "bug", category: "physique", power: 60, accuracy: 100, pp: 20 },

  // De quoi armer les légendaires des Arènes.
  "draco-souffle": { name: "Draco-Souffle", type: "dragon", category: "speciale", power: 60, accuracy: 100, pp: 20 },
  eclair: { name: "Éclair", type: "electric", category: "speciale", power: 40, accuracy: 100, pp: 30, inflicts: { status: "paralysie", chance: 0.1 } },

  // Les hautes herbes recrachent les six cent quarante-neuf premières espèces :
  // les six types qui n'avaient encore aucune attaque en méritaient une.
  "vent-glace": { name: "Vent Glace", type: "ice", category: "speciale", power: 55, accuracy: 95, pp: 15, lower: { stat: "spe", stages: 1 } },
  blizzard: { name: "Blizzard", type: "ice", category: "speciale", power: 110, accuracy: 70, pp: 5, inflicts: { status: "gel", chance: 0.1 } },
  "choc-mental": { name: "Choc Mental", type: "psychic", category: "speciale", power: 50, accuracy: 100, pp: 25 },
  psyko: { name: "Psyko", type: "psychic", category: "speciale", power: 90, accuracy: 100, pp: 10 },
  "griffe-ombre": { name: "Griffe Ombre", type: "ghost", category: "physique", power: 70, accuracy: 100, pp: 15 },
  "griffe-acier": { name: "Griffe Acier", type: "steel", category: "physique", power: 50, accuracy: 95, pp: 35 },
  "tete-de-fer": { name: "Tête de Fer", type: "steel", category: "physique", power: 80, accuracy: 100, pp: 15 },
  acide: { name: "Acide", type: "poison", category: "speciale", power: 40, accuracy: 100, pp: 30, inflicts: { status: "poison", chance: 0.2 } },
  "direct-toxik": { name: "Direct Toxik", type: "poison", category: "physique", power: 80, accuracy: 100, pp: 20, inflicts: { status: "poison", chance: 0.3 } },
  "voix-enjoleuse": { name: "Voix Enjôleuse", type: "fairy", category: "speciale", power: 40, accuracy: 100, pp: 15 },
  "eclat-magique": { name: "Éclat Magique", type: "fairy", category: "speciale", power: 80, accuracy: 100, pp: 10 },

  // Les paliers hauts des types déjà servis, pour que les espèces engendrées
  // ne restent pas armées d'une Flammèche au niveau cinquante.
  hydrocanon: { name: "Hydrocanon", type: "water", category: "speciale", power: 110, accuracy: 80, pp: 5 },
  "tonnerre-eclair": { name: "Tonnerre", type: "electric", category: "speciale", power: 90, accuracy: 100, pp: 15, inflicts: { status: "paralysie", chance: 0.1 } },
  "eboulement": { name: "Éboulement", type: "rock", category: "physique", power: 75, accuracy: 90, pp: 10 },
  "ultimapoing": { name: "Ultimapoing", type: "fighting", category: "physique", power: 80, accuracy: 100, pp: 20 },
  "dark-lariat": { name: "Dark Lariat", type: "dark", category: "physique", power: 85, accuracy: 100, pp: 10 },
  megasabot: { name: "Mégasabot", type: "ground", category: "physique", power: 100, accuracy: 75, pp: 10 },
  "aeropique": { name: "Aéropique", type: "flying", category: "physique", power: 60, accuracy: 100, pp: 30, priority: 1 },
  "dard-nuee": { name: "Dard-Nuée", type: "bug", category: "physique", power: 90, accuracy: 100, pp: 15 },
  "colere": { name: "Colère", type: "dragon", category: "physique", power: 120, accuracy: 100, pp: 10 },

  // Les altérations, sans lesquelles la moitié de la stratégie manquait.
  "poudre-dodo": { name: "Poudre Dodo", type: "grass", category: "statut", power: 0, accuracy: 75, pp: 15, inflicts: { status: "sommeil", chance: 1 } },
  "para-spore": { name: "Para-Spore", type: "grass", category: "statut", power: 0, accuracy: 75, pp: 30, inflicts: { status: "paralysie", chance: 1 } },
  "cage-eclair": { name: "Cage-Éclair", type: "electric", category: "statut", power: 0, accuracy: 90, pp: 20, inflicts: { status: "paralysie", chance: 1 } },
  toxik: { name: "Toxik", type: "poison", category: "statut", power: 0, accuracy: 90, pp: 10, inflicts: { status: "poison", chance: 1 } },
  berceuse: { name: "Berceuse", type: "normal", category: "statut", power: 0, accuracy: 55, pp: 15, inflicts: { status: "sommeil", chance: 1 } },
  "feu-follet": { name: "Feu Follet", type: "fire", category: "statut", power: 0, accuracy: 85, pp: 15, inflicts: { status: "brulure", chance: 1 } },
} as const satisfies Record<string, Move>;

export type MoveId = keyof typeof MOVE_DATA;

/**
 * Vue élargie du catalogue : `as const` fige les clés pour `MoveId`, mais on
 * relit les attaques comme des `Move` pour garder `priority` et `lower`.
 */
export const MOVES = MOVE_DATA as Record<MoveId, Move>;

/* --------------------------------------------------------------- espèces */

export type Species = {
  /** Numéro national : sert aussi à retrouver les sprites sur la PokéAPI. */
  id: number;
  name: string;
  genus: string;
  types: TypeName[];
  base: Record<StatKey, number>;
  /** Taux de capture officiel (255 = très facile, 45 = starter). */
  catchRate: number;
  baseExp: number;
  learnset: { level: number; move: MoveId }[];
  entry: string;
  /** Niveau d'évolution et espèce obtenue, quand l'espèce évolue. */
  evolvesAt?: number;
  evolvesInto?: number;
};

export const SPECIES: Record<number, Species> = {
  495: {
    id: 495, name: "Vipélierre", genus: "Pokémon Serpherbe", types: ["grass"],
    base: { hp: 45, atk: 45, def: 55, spa: 45, spd: 55, spe: 63 },
    catchRate: 45, baseExp: 28,
    learnset: [
      { level: 1, move: "charge" },
      { level: 1, move: "groz-yeux" },
      { level: 5, move: "fouet-lianes" },
      { level: 10, move: "tranch-herbe" },
    ],
    entry: "Il fait la photosynthèse en prenant le soleil. Quand il est en forme, sa queue s'agite avec vivacité.",
    evolvesAt: 17,
    evolvesInto: 496,
  },
  498: {
    id: 498, name: "Gruikui", genus: "Pokémon Cochon Feu", types: ["fire"],
    base: { hp: 65, atk: 63, def: 45, spa: 45, spd: 45, spe: 45 },
    catchRate: 45, baseExp: 28,
    learnset: [
      { level: 1, move: "charge" },
      { level: 3, move: "mimi-queue" },
      { level: 7, move: "flammeche" },
      { level: 12, move: "morsure" },
    ],
    entry: "Il crache du feu par le groin. Quand il attrape un froid, il rejette une fumée noire au lieu des flammes.",
    evolvesAt: 17,
    evolvesInto: 499,
  },
  501: {
    id: 501, name: "Moustillon", genus: "Pokémon Loutre", types: ["water"],
    base: { hp: 55, atk: 55, def: 45, spa: 63, spd: 45, spe: 45 },
    catchRate: 45, baseExp: 28,
    learnset: [
      { level: 1, move: "charge" },
      { level: 5, move: "mimi-queue" },
      { level: 7, move: "pistolet-a-o" },
      { level: 13, move: "morsure" },
    ],
    entry: "Le coquillage de son ventre n'est pas qu'une armure : il s'en sert pour trancher ses adversaires.",
    evolvesAt: 17,
    evolvesInto: 502,
  },
  504: {
    id: 504, name: "Ratentif", genus: "Pokémon Éclaireur", types: ["normal"],
    base: { hp: 45, atk: 55, def: 39, spa: 35, spd: 39, spe: 42 },
    catchRate: 255, baseExp: 51,
    learnset: [
      { level: 1, move: "charge" },
      { level: 1, move: "groz-yeux" },
      { level: 5, move: "morsure" },
      { level: 9, move: "vive-attaque" },
    ],
    entry: "Très prudent, il se dresse sur ses pattes arrière pour surveiller les environs. Il prévient les siens au moindre danger.",
    evolvesAt: 20,
    evolvesInto: 505,
  },
  506: {
    id: 506, name: "Ponchiot", genus: "Pokémon Petit Chien", types: ["normal"],
    base: { hp: 45, atk: 60, def: 45, spa: 25, spd: 45, spe: 55 },
    catchRate: 255, baseExp: 55,
    learnset: [
      { level: 1, move: "charge" },
      { level: 1, move: "groz-yeux" },
      { level: 8, move: "morsure" },
      { level: 12, move: "vive-attaque" },
    ],
    entry: "Les poils de son visage lui servent de radar. Très loyal, il obéit au doigt et à l'œil à un Dresseur compétent.",
    evolvesAt: 16,
    evolvesInto: 507,
  },
  509: {
    id: 509, name: "Chacripan", genus: "Pokémon Sournois", types: ["dark"],
    base: { hp: 41, atk: 50, def: 37, spa: 50, spd: 37, spe: 66 },
    catchRate: 255, baseExp: 56,
    learnset: [
      { level: 1, move: "griffe" },
      { level: 1, move: "rugissement" },
      { level: 7, move: "jet-de-sable" },
      { level: 11, move: "morsure" },
    ],
    entry: "Il vole les affaires des gens pour s'amuser. Poursuivi, il prend un air adorable pour se faire pardonner.",
    evolvesAt: 20,
    evolvesInto: 510,
  },
  519: {
    id: 519, name: "Poichigeon", genus: "Pokémon Pigeonneau", types: ["normal", "flying"],
    base: { hp: 50, atk: 55, def: 50, spa: 36, spd: 30, spe: 43 },
    catchRate: 255, baseExp: 53,
    learnset: [
      { level: 1, move: "tornade" },
      { level: 1, move: "rugissement" },
      { level: 5, move: "groz-yeux" },
      { level: 9, move: "vive-attaque" },
      { level: 13, move: "picpic" },
    ],
    entry: "Il suit son Dresseur docilement. Comme il oublie souvent les ordres, on lui répète sans cesse la même chose.",
    evolvesAt: 21,
    evolvesInto: 520,
  },

  /* --------------------------------- espèces des forêts, sables et cimes */

  529: {
    id: 529, name: "Rototaupe", genus: "Pokémon Taupe", types: ["ground"],
    base: { hp: 60, atk: 85, def: 40, spa: 30, spd: 45, spe: 68 },
    catchRate: 120, baseExp: 66,
    learnset: [
      { level: 1, move: "griffe" },
      { level: 5, move: "jet-de-sable" },
      { level: 12, move: "tunnel" },
      { level: 18, move: "jet-pierres" },
      { level: 26, move: "plaquage" },
    ],
    entry: "Il creuse des galeries à dix mètres sous terre. Ses griffes viennent à bout de la roche la plus dure.",
  },
  551: {
    id: 551, name: "Mascaïman", genus: "Pokémon Croco", types: ["ground", "dark"],
    base: { hp: 50, atk: 72, def: 35, spa: 35, spd: 35, spe: 65 },
    catchRate: 180, baseExp: 58,
    learnset: [
      { level: 1, move: "morsure" },
      { level: 4, move: "jet-de-sable" },
      { level: 14, move: "tunnel" },
      { level: 20, move: "vibrobscur" },
      { level: 28, move: "plaquage" },
    ],
    entry: "Enfoui dans le sable, il ne laisse dépasser que ses yeux et guette sa proie pendant des heures.",
  },
  557: {
    id: 557, name: "Crabicoque", genus: "Pokémon Roche", types: ["bug", "rock"],
    base: { hp: 50, atk: 65, def: 85, spa: 35, spd: 35, spe: 55 },
    catchRate: 190, baseExp: 65,
    learnset: [
      { level: 1, move: "griffe" },
      { level: 8, move: "jet-pierres" },
      { level: 14, move: "piqure" },
      { level: 22, move: "plaquage" },
    ],
    entry: "Il taille sa roche avec le liquide de sa bouche et s'y installe. Sans elle, il ne trouve plus le sommeil.",
  },

  /* ------------------------------------ têtes d'affiche de la dream team */

  130: {
    id: 130, name: "Léviator", genus: "Pokémon Atroce", types: ["water", "flying"],
    base: { hp: 95, atk: 125, def: 79, spa: 60, spd: 100, spe: 81 },
    catchRate: 45, baseExp: 189,
    learnset: [
      { level: 1, move: "morsure" },
      { level: 1, move: "rugissement" },
      { level: 20, move: "pistolet-a-o" },
      { level: 25, move: "coquille-lame" },
      { level: 32, move: "jet-pierres" },
      { level: 40, move: "plaquage" },
    ],
    entry: "D'un caractère effroyable, il rase tout sur son passage quand sa colère monte. Sa fureur peut durer un mois entier.",
  },
  248: {
    id: 248, name: "Tyranocif", genus: "Pokémon Armure", types: ["rock", "dark"],
    base: { hp: 100, atk: 134, def: 110, spa: 95, spd: 100, spe: 61 },
    catchRate: 45, baseExp: 270,
    learnset: [
      { level: 1, move: "morsure" },
      { level: 1, move: "groz-yeux" },
      { level: 20, move: "jet-pierres" },
      { level: 28, move: "vibrobscur" },
      { level: 36, move: "tunnel" },
      { level: 44, move: "plaquage" },
    ],
    entry: "Sa carapace résiste à tout. Il fait s'écrouler les montagnes d'un coup d'épaule pour se bâtir un nid.",
  },
  448: {
    id: 448, name: "Lucario", genus: "Pokémon Aura", types: ["fighting", "steel"],
    base: { hp: 70, atk: 110, def: 70, spa: 115, spd: 70, spe: 90 },
    catchRate: 45, baseExp: 184,
    learnset: [
      { level: 1, move: "vive-attaque" },
      { level: 1, move: "groz-yeux" },
      { level: 18, move: "balayage" },
      { level: 26, move: "tunnel" },
      { level: 34, move: "piqure" },
      { level: 42, move: "plaquage" },
    ],
    entry: "Il perçoit l'aura de tout ce qui l'entoure et lit dans les pensées de son adversaire avant même qu'il ne bouge.",
  },
  643: {
    id: 643, name: "Reshiram", genus: "Pokémon Blancheur", types: ["dragon", "fire"],
    base: { hp: 100, atk: 120, def: 100, spa: 150, spd: 120, spe: 90 },
    catchRate: 3, baseExp: 306,
    learnset: [
      { level: 1, move: "morsure" },
      { level: 1, move: "groz-yeux" },
      { level: 10, move: "flammeche" },
      { level: 20, move: "draco-souffle" },
      { level: 30, move: "lance-flammes" },
      { level: 40, move: "plaquage" },
    ],
    entry: "Quand sa queue s'embrase, l'atmosphère entière se réchauffe. Il vient en aide à qui poursuit la vérité.",
  },

  /* ---------------------------------------- les légendaires des Arènes */

  384: {
    id: 384, name: "Rayquaza", genus: "Pokémon Ciel Haut", types: ["dragon", "flying"],
    base: { hp: 105, atk: 150, def: 90, spa: 150, spd: 90, spe: 95 },
    catchRate: 45, baseExp: 306,
    learnset: [
      { level: 1, move: "tornade" },
      { level: 1, move: "groz-yeux" },
      { level: 8, move: "draco-souffle" },
      { level: 16, move: "coupe-vent" },
      { level: 28, move: "plaquage" },
    ],
    entry: "Il vit dans la couche d'ozone, bien au-dessus des nuages, et n'en redescend presque jamais.",
  },
  644: {
    id: 644, name: "Zekrom", genus: "Pokémon Noirprofond", types: ["dragon", "electric"],
    base: { hp: 100, atk: 150, def: 120, spa: 120, spd: 100, spe: 90 },
    catchRate: 3, baseExp: 306,
    learnset: [
      { level: 1, move: "morsure" },
      { level: 1, move: "groz-yeux" },
      { level: 10, move: "eclair" },
      { level: 20, move: "draco-souffle" },
      { level: 30, move: "plaquage" },
    ],
    entry: "Dissimulé dans les nuages d'orage, il prête main-forte à qui poursuit ses idéaux. Sa queue produit une électricité colossale.",
  },

  /* ------------------------------------------------------ formes évoluées */

  496: {
    id: 496, name: "Lianaja", genus: "Pokémon Herbeserpent", types: ["grass"],
    base: { hp: 60, atk: 60, def: 75, spa: 60, spd: 75, spe: 83 },
    catchRate: 45, baseExp: 145,
    learnset: [
      { level: 1, move: "charge" },
      { level: 1, move: "groz-yeux" },
      { level: 5, move: "fouet-lianes" },
      { level: 10, move: "tranch-herbe" },
      { level: 20, move: "vive-attaque" },
      { level: 26, move: "lame-feuille" },
    ],
    entry: "Il fuit ses ennemis à toute vitesse en rampant. Sa queue lui sert de fouet quand il doit se défendre.",
    evolvesAt: 36,
    evolvesInto: 497,
  },
  497: {
    id: 497, name: "Majaspic", genus: "Pokémon Royal", types: ["grass"],
    base: { hp: 75, atk: 75, def: 95, spa: 75, spd: 95, spe: 113 },
    catchRate: 45, baseExp: 238,
    learnset: [
      { level: 1, move: "tranch-herbe" },
      { level: 20, move: "vive-attaque" },
      { level: 26, move: "lame-feuille" },
      { level: 42, move: "plaquage" },
    ],
    entry: "Son seul regard suffit à figer ses adversaires. Il n'accorde son aide qu'aux Dresseurs de grand talent.",
  },

  499: {
    id: 499, name: "Grotichon", genus: "Pokémon Cochon Feu", types: ["fire", "fighting"],
    base: { hp: 90, atk: 93, def: 55, spa: 70, spd: 55, spe: 55 },
    catchRate: 45, baseExp: 146,
    learnset: [
      { level: 1, move: "charge" },
      { level: 3, move: "mimi-queue" },
      { level: 7, move: "flammeche" },
      { level: 12, move: "morsure" },
      { level: 20, move: "balayage" },
      { level: 28, move: "lance-flammes" },
    ],
    entry: "Il se déplace avec agilité malgré sa masse. Les flammes de son menton s'intensifient quand il s'énerve.",
    evolvesAt: 36,
    evolvesInto: 500,
  },
  500: {
    id: 500, name: "Roitiflam", genus: "Pokémon Cochon Feu", types: ["fire", "fighting"],
    base: { hp: 110, atk: 123, def: 65, spa: 100, spd: 65, spe: 65 },
    catchRate: 45, baseExp: 238,
    learnset: [
      { level: 1, move: "morsure" },
      { level: 20, move: "balayage" },
      { level: 28, move: "lance-flammes" },
      { level: 44, move: "plaquage" },
    ],
    entry: "La barbe de feu qui orne son menton témoigne de sa puissance. Il maîtrise tous les arts martiaux.",
  },

  502: {
    id: 502, name: "Mateloutre", genus: "Pokémon Discipliné", types: ["water"],
    base: { hp: 75, atk: 75, def: 60, spa: 83, spd: 60, spe: 60 },
    catchRate: 45, baseExp: 145,
    learnset: [
      { level: 1, move: "charge" },
      { level: 5, move: "mimi-queue" },
      { level: 7, move: "pistolet-a-o" },
      { level: 13, move: "morsure" },
      { level: 22, move: "coquille-lame" },
      { level: 30, move: "vibrobscur" },
    ],
    entry: "Il s'entraîne sans relâche pour maîtriser ses deux coquillages, qu'il manie comme des lames jumelles.",
    evolvesAt: 36,
    evolvesInto: 503,
  },
  503: {
    id: 503, name: "Clamiral", genus: "Pokémon Type Formel", types: ["water"],
    base: { hp: 95, atk: 100, def: 85, spa: 108, spd: 70, spe: 70 },
    catchRate: 45, baseExp: 238,
    learnset: [
      { level: 1, move: "pistolet-a-o" },
      { level: 22, move: "coquille-lame" },
      { level: 30, move: "vibrobscur" },
      { level: 46, move: "plaquage" },
    ],
    entry: "D'un cri, il impose le silence à ses ennemis. La lame de son armure tranche tout sur son passage.",
  },

  505: {
    id: 505, name: "Miradar", genus: "Pokémon Vigilant", types: ["normal"],
    base: { hp: 60, atk: 85, def: 69, spa: 60, spd: 69, spe: 77 },
    catchRate: 255, baseExp: 147,
    learnset: [
      { level: 1, move: "charge" },
      { level: 1, move: "groz-yeux" },
      { level: 5, move: "morsure" },
      { level: 9, move: "vive-attaque" },
      { level: 15, move: "jet-de-sable" },
      { level: 26, move: "plaquage" },
    ],
    entry: "Ses yeux brillent dans le noir. Il repère un ennemi à des kilomètres et prévient les siens d'un cri strident.",
  },

  507: {
    id: 507, name: "Ponchien", genus: "Pokémon Loyal", types: ["normal"],
    base: { hp: 65, atk: 80, def: 65, spa: 35, spd: 65, spe: 60 },
    catchRate: 120, baseExp: 130,
    learnset: [
      { level: 1, move: "charge" },
      { level: 1, move: "groz-yeux" },
      { level: 8, move: "morsure" },
      { level: 12, move: "vive-attaque" },
      { level: 24, move: "plaquage" },
    ],
    entry: "Prudent et courageux, il suit les ordres de son Dresseur sans jamais rechigner à la tâche.",
    evolvesAt: 32,
    evolvesInto: 508,
  },
  508: {
    id: 508, name: "Mastouffe", genus: "Pokémon Grand Cœur", types: ["normal"],
    base: { hp: 85, atk: 110, def: 90, spa: 45, spd: 90, spe: 80 },
    catchRate: 45, baseExp: 225,
    learnset: [
      { level: 1, move: "morsure" },
      { level: 12, move: "vive-attaque" },
      { level: 24, move: "plaquage" },
      { level: 34, move: "vibrobscur" },
    ],
    entry: "Sa fourrure le protège du froid. On raconte qu'il a sauvé des enfants perdus dans la montagne.",
  },

  510: {
    id: 510, name: "Léopardus", genus: "Pokémon Cruel", types: ["dark"],
    base: { hp: 64, atk: 88, def: 50, spa: 88, spd: 50, spe: 106 },
    catchRate: 90, baseExp: 156,
    learnset: [
      { level: 1, move: "griffe" },
      { level: 1, move: "rugissement" },
      { level: 7, move: "jet-de-sable" },
      { level: 11, move: "morsure" },
      { level: 18, move: "vive-attaque" },
      { level: 28, move: "vibrobscur" },
    ],
    entry: "Il surgit de l'ombre sans un bruit et frappe avec ses griffes acérées avant de disparaître.",
  },

  520: {
    id: 520, name: "Colombeau", genus: "Pokémon Pigeon Sauvage", types: ["normal", "flying"],
    base: { hp: 62, atk: 77, def: 62, spa: 50, spd: 42, spe: 65 },
    catchRate: 120, baseExp: 125,
    learnset: [
      { level: 1, move: "tornade" },
      { level: 1, move: "rugissement" },
      { level: 5, move: "groz-yeux" },
      { level: 9, move: "vive-attaque" },
      { level: 13, move: "picpic" },
      { level: 24, move: "coupe-vent" },
    ],
    entry: "Il retrouve toujours son Dresseur, où qu'il se trouve. Il vit en groupe au cœur des forêts.",
    evolvesAt: 32,
    evolvesInto: 521,
  },
  521: {
    id: 521, name: "Déflaisan", genus: "Pokémon Fier", types: ["normal", "flying"],
    base: { hp: 80, atk: 115, def: 80, spa: 65, spd: 55, spe: 93 },
    catchRate: 45, baseExp: 220,
    learnset: [
      { level: 1, move: "picpic" },
      { level: 9, move: "vive-attaque" },
      { level: 24, move: "coupe-vent" },
      { level: 36, move: "plaquage" },
    ],
    entry: "Fier et vaillant, il chasse ses ennemis à grands coups d'ailes. Sa vitesse en vol est redoutable.",
  },
};

/* ------------------------------------------------- espèces reconstituées */

/**
 * Les hautes herbes tirent parmi les six cent quarante-neuf premières
 * espèces ; on ne va évidemment pas écrire à la main l'apprentissage de
 * chacune. Celles qui n'ont pas de fiche ci-dessus empruntent leurs
 * statistiques au Pokédex national et reçoivent des attaques déduites de
 * leurs types.
 */

/** Attaques offensives du catalogue, groupées par type et rangées par force. */
const BY_TYPE = (() => {
  const table: Partial<Record<TypeName, MoveId[]>> = {};
  for (const id of Object.keys(MOVES) as MoveId[]) {
    if (MOVES[id].category === "statut") continue;
    (table[MOVES[id].type] ??= []).push(id);
  }
  for (const list of Object.values(table)) {
    list.sort((a, b) => MOVES[a].power - MOVES[b].power);
  }
  return table;
})();

/** Les attaques qui posent une altération, rangées par type. */
const STATUS_BY_TYPE = (() => {
  const table: Partial<Record<TypeName, MoveId>> = {};
  for (const id of Object.keys(MOVES) as MoveId[]) {
    const mv = MOVES[id];
    if (mv.category !== "statut" || !mv.inflicts) continue;
    table[mv.type] ??= id;
  }
  return table;
})();

/** Niveau à partir duquel une espèce reconstituée sait poser un statut. */
const STATUS_LEVEL = 12;

/** Le plafond de puissance qu'un niveau autorise. */
const ceilingAt = (level: number) => 25 + level * 3;

/**
 * La plus forte attaque d'un type que le niveau permet : un sauvage de
 * niveau trois lance une Flammèche, pas un Lance-Flammes.
 */
function bestMove(type: TypeName, level: number): MoveId | null {
  const pool = BY_TYPE[type];
  if (!pool?.length) return null;
  const affordable = pool.filter((m) => MOVES[m].power <= ceilingAt(level));
  return affordable.length ? affordable[affordable.length - 1] : pool[0];
}

/**
 * Répertoire déduit des types : une attaque par type, complétée de coups
 * normaux quand le niveau les justifie. Mieux vaut deux attaques à sa portée
 * que quatre dont trois hors de saison.
 */
export function typedMoveset(types: TypeName[], level: number): MoveId[] {
  const picks: MoveId[] = [];
  const add = (move: MoveId | null | undefined) => {
    if (move && !picks.includes(move) && picks.length < 4) picks.push(move);
  };
  for (const type of types) add(bestMove(type, level));
  // Une altération à son propre type, une fois passé le niveau où elle
  // cesse d'être écrasante contre un débutant.
  if (level >= STATUS_LEVEL) {
    for (const type of types) add(STATUS_BY_TYPE[type]);
  }
  for (const filler of ["vive-attaque", "plaquage", "charge"] as MoveId[]) {
    if (picks.length >= 4) break;
    // Le premier remplissage est garanti : jamais moins de deux attaques.
    if (picks.length < 2 || MOVES[filler].power <= ceilingAt(level)) add(filler);
  }
  return picks;
}

/** Fiches reconstituées, gardées en cache : `species` est un chemin chaud. */
const REBUILT: Record<number, Species> = {};

function rebuild(id: number, entry: DexEntry): Species {
  const [name, genus, types, base, catchRate, baseExp] = entry;
  const [hp, atk, def, spa, spd, spe] = base;
  const evolution = EVOLUTIONS[id];
  return {
    id,
    name,
    genus,
    types: types as TypeName[],
    base: { hp, atk, def, spa, spd, spe },
    catchRate,
    baseExp,
    // Apprentissage vide : les attaques se déduisent des types au moment où
    // la créature est fabriquée, puis à chaque niveau gagné.
    learnset: [],
    // Seules les espèces détaillées à la main portent une notice de terrain.
    entry: "",
    evolvesAt: evolution?.[0],
    evolvesInto: evolution?.[1],
  };
}

/** Fiche d'une espèce : écrite à la main si elle existe, sinon reconstituée. */
export function species(id: number): Species {
  const written = SPECIES[id];
  if (written) return written;
  return (REBUILT[id] ??= rebuild(id, DEX[id]));
}

/* -------------------------------------------------------------- formules */

/** Statistique finale, formule Génération III et suivantes (EV nuls). */
export function computeStat(
  base: number,
  iv: number,
  level: number,
  isHp: boolean,
): number {
  if (isHp) return Math.floor(((2 * base + iv) * level) / 100) + level + 10;
  return Math.floor(((2 * base + iv) * level) / 100) + 5;
}

/** Courbe « moyenne-rapide » : n³ points pour atteindre le niveau n. */
export const expForLevel = (level: number) => level ** 3;

/** Gain d'expérience d'un adversaire vaincu (formule Génération V). */
export const expGain = (baseExp: number, level: number) =>
  Math.max(1, Math.floor((baseExp * level) / 7));

export const MAX_LEVEL = 100;
