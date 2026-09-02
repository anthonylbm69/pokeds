/**
 * Données du jeu : types, attaques, espèces et les formules officielles de
 * statistiques et d'expérience. Tout est local — la PokéAPI ne sert plus qu'à
 * fournir les sprites, pour qu'un combat n'attende jamais le réseau.
 */

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
};

const MOVE_DATA = {
  charge: { name: "Charge", type: "normal", category: "physique", power: 50, accuracy: 100, pp: 35 },
  griffe: { name: "Griffe", type: "normal", category: "physique", power: 40, accuracy: 100, pp: 35 },
  "vive-attaque": { name: "Vive-Attaque", type: "normal", category: "physique", power: 40, accuracy: 100, pp: 30, priority: 1 },
  morsure: { name: "Morsure", type: "dark", category: "physique", power: 60, accuracy: 100, pp: 25 },
  "fouet-lianes": { name: "Fouet Lianes", type: "grass", category: "physique", power: 35, accuracy: 100, pp: 25 },
  "tranch-herbe": { name: "Tranch'Herbe", type: "grass", category: "physique", power: 55, accuracy: 95, pp: 25 },
  flammeche: { name: "Flammèche", type: "fire", category: "speciale", power: 40, accuracy: 100, pp: 25 },
  "pistolet-a-o": { name: "Pistolet à O", type: "water", category: "speciale", power: 40, accuracy: 100, pp: 25 },
  picpic: { name: "Picpic", type: "flying", category: "physique", power: 35, accuracy: 100, pp: 35 },
  tornade: { name: "Tornade", type: "flying", category: "speciale", power: 40, accuracy: 100, pp: 35 },
  rugissement: { name: "Rugissement", type: "normal", category: "statut", power: 0, accuracy: 100, pp: 40, lower: { stat: "atk", stages: 1 } },
  "groz-yeux": { name: "Groz'Yeux", type: "normal", category: "statut", power: 0, accuracy: 100, pp: 30, lower: { stat: "def", stages: 1 } },
  "mimi-queue": { name: "Mimi-Queue", type: "normal", category: "statut", power: 0, accuracy: 100, pp: 30, lower: { stat: "def", stages: 1 } },
  "jet-de-sable": { name: "Jet de Sable", type: "ground", category: "statut", power: 0, accuracy: 100, pp: 15, lower: { stat: "acc", stages: 1 } },
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
  },
};

export const species = (id: number): Species => SPECIES[id];

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
