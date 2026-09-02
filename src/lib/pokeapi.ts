/**
 * Accès à la PokéAPI (https://pokeapi.co/api/v2/) + helpers d'affichage.
 * Les sprites sont servis directement depuis le dépôt PokeAPI/sprites afin
 * d'éviter 1025 requêtes API rien que pour peupler la liste du Pokédex.
 */

const API = "https://pokeapi.co/api/v2";
const SPRITES =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/** Dernier numéro du Pokédex National couvert par l'API. */
export const NATIONAL_DEX_MAX = 1025;

export type IndexEntry = { id: number; name: string };

export type Stat = { key: string; label: string; value: number };

export type EvoNode = { id: number; name: string; detail: string | null };

export type PokemonDetail = {
  id: number;
  name: string;
  /** Nom français quand l'API le fournit (l'index, lui, n'existe qu'en anglais). */
  nameFr: string | null;
  genus: string;
  types: string[];
  height: number; // décimètres
  weight: number; // hectogrammes
  flavor: string;
  abilities: string[];
  stats: Stat[];
  total: number;
  cry: string | null;
  sprite: string;
  artwork: string;
  /** Chaîne d'évolution aplatie par étage (gère les embranchements type Évoli). */
  evolution: EvoNode[][];
};

export const GENERATIONS = [
  { id: 0, label: "TOUT", region: "National", from: 1, to: NATIONAL_DEX_MAX },
  { id: 1, label: "I", region: "Kanto", from: 1, to: 151 },
  { id: 2, label: "II", region: "Johto", from: 152, to: 251 },
  { id: 3, label: "III", region: "Hoenn", from: 252, to: 386 },
  { id: 4, label: "IV", region: "Sinnoh", from: 387, to: 493 },
  { id: 5, label: "V", region: "Unys", from: 494, to: 649 },
  { id: 6, label: "VI", region: "Kalos", from: 650, to: 721 },
  { id: 7, label: "VII", region: "Alola", from: 722, to: 809 },
  { id: 8, label: "VIII", region: "Galar", from: 810, to: 905 },
  { id: 9, label: "IX", region: "Paldea", from: 906, to: NATIONAL_DEX_MAX },
] as const;

/* ------------------------------------------------------------------ sprites */

/**
 * Icône de boîte, utilisée dans la liste de l'écran du bas.
 * Le jeu d'icônes s'arrête à la Génération VIII : au-delà, sprite classique.
 */
export const iconUrl = (id: number) =>
  id <= 905
    ? `${SPRITES}/versions/generation-viii/icons/${id}.png`
    : `${SPRITES}/${id}.png`;

/** Sprite animé Noir/Blanc — l'authentique. Disponible jusqu'à Unys (649). */
export const animatedUrl = (id: number) =>
  id <= 649
    ? `${SPRITES}/versions/generation-v/black-white/animated/${id}.gif`
    : null;

/** Sprite animé de dos, celui du Pokémon du joueur pendant un combat. */
export const animatedBackUrl = (id: number) =>
  id <= 649
    ? `${SPRITES}/versions/generation-v/black-white/animated/back/${id}.gif`
    : null;

/** Cri d'un Pokémon, servi tel quel par le dépôt PokéAPI (aucune requête API). */
export const cryUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;

export const staticUrl = (id: number) => `${SPRITES}/${id}.png`;

export const staticBackUrl = (id: number) => `${SPRITES}/back/${id}.png`;

export const artworkUrl = (id: number) =>
  `${SPRITES}/other/official-artwork/${id}.png`;

/* --------------------------------------------------------------------- noms */

const NAME_FIX: Record<string, string> = {
  "nidoran-f": "Nidoran♀",
  "nidoran-m": "Nidoran♂",
  "mr-mime": "M. Mime",
  "mime-jr": "Mime Jr.",
  "type-null": "Type:0",
  "ho-oh": "Ho-Oh",
  "porygon-z": "Porygon-Z",
  farfetchd: "Farfetch'd",
  sirfetchd: "Sirfetch'd",
  flabebe: "Flabébé",
};

/** Suffixes de forme par défaut renvoyés par l'endpoint /pokemon. */
const FORM_SUFFIXES = [
  "-normal",
  "-altered",
  "-land",
  "-plant",
  "-red-striped",
  "-standard",
  "-incarnate",
  "-ordinary",
  "-aria",
  "-male",
  "-female",
  "-shield",
  "-average",
  "-50",
  "-baile",
  "-midday",
  "-solo",
  "-red-meteor",
  "-disguised",
  "-amped",
  "-ice",
  "-full-belly",
  "-single-strike",
  "-family-of-four",
  "-green-plumage",
  "-zero",
  "-curly",
  "-two-segment",
  "-chest",
];

export function displayName(raw: string): string {
  if (NAME_FIX[raw]) return NAME_FIX[raw];
  let name = raw;
  for (const suffix of FORM_SUFFIXES) {
    if (name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length);
      break;
    }
  }
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Numéro de dex sur 3 chiffres, comme à l'écran dans Noir/Blanc. */
export const padDex = (id: number) => id.toString().padStart(3, "0");

export const formatHeight = (dm: number) => `${(dm / 10).toFixed(1)} m`;
export const formatWeight = (hg: number) => `${(hg / 10).toFixed(1)} kg`;

/* -------------------------------------------------------------------- fetch */

async function getJson<T>(url: string, revalidate = 604800): Promise<T> {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`PokéAPI ${res.status} sur ${url}`);
  return res.json() as Promise<T>;
}

const idFromUrl = (url: string): number =>
  Number(url.split("/").filter(Boolean).pop());

/** Liste complète du Pokédex National (numéro + nom), en une seule requête. */
export async function fetchIndex(): Promise<IndexEntry[]> {
  const data = await getJson<{ results: { name: string; url: string }[] }>(
    `${API}/pokemon?limit=${NATIONAL_DEX_MAX}`,
  );
  return data.results.map((r) => ({ id: idFromUrl(r.url), name: r.name }));
}

const STAT_LABELS: Record<string, string> = {
  hp: "PV",
  attack: "ATTAQUE",
  defense: "DÉFENSE",
  "special-attack": "ATQ. SPÉ",
  "special-defense": "DÉF. SPÉ",
  speed: "VITESSE",
};

/** Priorité aux textes de Noir/Blanc, puis Noir 2/Blanc 2, puis n'importe lequel. */
const FLAVOR_PRIORITY = ["black", "white", "black-2", "white-2", "x", "y"];

type FlavorEntry = {
  flavor_text: string;
  language: { name: string };
  version: { name: string };
};

function pickFlavor(entries: FlavorEntry[], lang: string): string | null {
  const localized = entries.filter((e) => e.language.name === lang);
  if (!localized.length) return null;
  const preferred =
    FLAVOR_PRIORITY.map((v) =>
      localized.find((e) => e.version.name === v),
    ).find(Boolean) ?? localized[localized.length - 1];
  // L'API conserve les sauts de ligne et césures des cartouches d'origine.
  return preferred!.flavor_text
    .replace(/[\n\f\r­]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type EvolutionDetail = {
  min_level: number | null;
  trigger: { name: string } | null;
  item: { name: string } | null;
  held_item: { name: string } | null;
  min_happiness: number | null;
  time_of_day: string;
  known_move: { name: string } | null;
  location: { name: string } | null;
};

const TRIGGER_LABELS: Record<string, string> = {
  "level-up": "Montée de niveau",
  trade: "Échange",
  "use-item": "Objet",
  shed: "Mue",
  spin: "Toupie",
  "tower-of-darkness": "Tour des Ténèbres",
  "tower-of-waters": "Tour de l'Eau",
  "three-critical-hits": "3 coups critiques",
  "take-damage": "Dégâts subis",
  "agile-style-move": "Style Agile",
  "strong-style-move": "Style Puissant",
  "recoil-damage": "Dégâts de recul",
  other: "Condition spéciale",
};

function describeEvolution(details: EvolutionDetail[]): string | null {
  const d = details?.[0];
  if (!d) return null;

  const pretty = (s: string) =>
    s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  if (d.min_level) return `N. ${d.min_level}`;
  if (d.item) return pretty(d.item.name);
  if (d.trigger?.name === "trade") return "Échange";
  if (d.min_happiness) return "Bonheur";
  if (d.held_item) return `Tient ${pretty(d.held_item.name)}`;
  if (d.known_move) return pretty(d.known_move.name);
  if (d.location) return pretty(d.location.name);
  if (d.time_of_day) return d.time_of_day === "day" ? "Le jour" : "La nuit";
  return d.trigger ? (TRIGGER_LABELS[d.trigger.name] ?? pretty(d.trigger.name)) : null;
}

type ChainLink = {
  species: { name: string; url: string };
  evolution_details: EvolutionDetail[];
  evolves_to: ChainLink[];
};

/** Aplatit la chaîne en étages successifs pour un rendu en colonnes. */
function flattenChain(root: ChainLink): EvoNode[][] {
  const levels: EvoNode[][] = [];
  let current: ChainLink[] = [root];
  while (current.length) {
    levels.push(
      current.map((link) => ({
        id: idFromUrl(link.species.url),
        name: displayName(link.species.name),
        detail: describeEvolution(link.evolution_details),
      })),
    );
    current = current.flatMap((link) => link.evolves_to);
  }
  return levels;
}

type PokemonResponse = {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { type: { name: string } }[];
  abilities: { ability: { name: string }; is_hidden: boolean }[];
  stats: { base_stat: number; stat: { name: string } }[];
  cries?: { latest?: string; legacy?: string };
  sprites: {
    front_default: string | null;
    versions?: {
      "generation-v"?: {
        "black-white"?: { animated?: { front_default: string | null } };
      };
    };
    other?: { "official-artwork"?: { front_default: string | null } };
  };
};

type SpeciesResponse = {
  genera: { genus: string; language: { name: string } }[];
  flavor_text_entries: FlavorEntry[];
  names: { name: string; language: { name: string } }[];
  evolution_chain: { url: string } | null;
};

/** Fiche complète d'un Pokémon : données, sprite animé, cri et évolutions. */
export async function fetchPokemon(id: number): Promise<PokemonDetail> {
  const [pokemon, species] = await Promise.all([
    getJson<PokemonResponse>(`${API}/pokemon/${id}`),
    getJson<SpeciesResponse>(`${API}/pokemon-species/${id}`),
  ]);

  let evolution: EvoNode[][] = [];
  if (species.evolution_chain) {
    try {
      const chain = await getJson<{ chain: ChainLink }>(
        species.evolution_chain.url,
      );
      evolution = flattenChain(chain.chain);
    } catch {
      evolution = [];
    }
  }

  const animated =
    pokemon.sprites.versions?.["generation-v"]?.["black-white"]?.animated
      ?.front_default ?? animatedUrl(id);

  return {
    id: pokemon.id,
    name: displayName(pokemon.name),
    nameFr: species.names.find((n) => n.language.name === "fr")?.name ?? null,
    genus:
      species.genera.find((g) => g.language.name === "fr")?.genus ??
      species.genera.find((g) => g.language.name === "en")?.genus ??
      "Pokémon",
    types: pokemon.types.map((t) => t.type.name),
    height: pokemon.height,
    weight: pokemon.weight,
    flavor:
      pickFlavor(species.flavor_text_entries, "fr") ??
      pickFlavor(species.flavor_text_entries, "en") ??
      "Aucune donnée enregistrée dans ce Pokédex.",
    abilities: pokemon.abilities.map((a) =>
      a.ability.name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    ),
    stats: pokemon.stats.map((s) => ({
      key: s.stat.name,
      label: STAT_LABELS[s.stat.name] ?? s.stat.name.toUpperCase(),
      value: s.base_stat,
    })),
    total: pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0),
    cry: pokemon.cries?.latest ?? pokemon.cries?.legacy ?? null,
    sprite: animated ?? pokemon.sprites.front_default ?? staticUrl(id),
    artwork:
      pokemon.sprites.other?.["official-artwork"]?.front_default ??
      artworkUrl(id),
    evolution,
  };
}

/** Libellés FR des 18 types (l'API renvoie les identifiants anglais). */
export const TYPE_LABELS: Record<string, string> = {
  normal: "Normal",
  fire: "Feu",
  water: "Eau",
  electric: "Électrik",
  grass: "Plante",
  ice: "Glace",
  fighting: "Combat",
  poison: "Poison",
  ground: "Sol",
  flying: "Vol",
  psychic: "Psy",
  bug: "Insecte",
  rock: "Roche",
  ghost: "Spectre",
  dragon: "Dragon",
  dark: "Ténèbres",
  steel: "Acier",
  fairy: "Fée",
};
