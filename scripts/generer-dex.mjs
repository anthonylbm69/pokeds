/**
 * Engendre `src/lib/game/dex.ts` : les six cent quarante-neuf premières
 * espèces relevées chez PokéAPI, puis figées dans le dépôt.
 *
 * Le jeu n'interroge jamais le réseau pendant une partie — seuls les sprites
 * viennent de la PokéAPI. Ce script se relance à la main quand on veut
 * rafraîchir la table :
 *
 *   node scripts/generer-dex.mjs
 *
 * Il fait environ deux mille requêtes ; comptez deux à trois minutes.
 */
import { writeFileSync } from "node:fs";

const MAX = 649;
const CONCURRENCE = 10;
const SORTIE = new URL("../src/lib/game/dex.ts", import.meta.url);

const STATS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

/**
 * Le jeu ne connaît ni pierre, ni échange, ni bonheur. Ces déclencheurs
 * reçoivent un niveau de convention pour que la lignée reste atteignable en
 * jouant normalement.
 */
const NIVEAU_PAR_DEFAUT = { "use-item": 30, trade: 35, "level-up": 22 };
const NIVEAU_AUTRE = 32;

async function json(url, essais = 4) {
  for (let i = 0; i < essais; i++) {
    try {
      const reponse = await fetch(url);
      if (reponse.ok) return await reponse.json();
      if (reponse.status === 404) return null;
    } catch {
      // Réseau capricieux : on repasse après une pause qui s'allonge.
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw new Error(`abandon sur ${url}`);
}

/** Fait tourner `tache` sur chaque entrée, quelques-unes de front. */
async function enParallele(entrees, tache) {
  let curseur = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCE }, async () => {
      while (curseur < entrees.length) await tache(entrees[curseur++]);
    }),
  );
}

/* ------------------------------------------------------------- les fiches */

const fiches = new Array(MAX);
const chaines = new Map(); // numéro d'espèce -> adresse de sa chaîne d'évolution

await enParallele([...Array(MAX).keys()].map((i) => i + 1), async (id) => {
  const [mon, esp] = await Promise.all([
    json(`https://pokeapi.co/api/v2/pokemon/${id}`),
    json(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
  ]);
  if (!mon || !esp) return;

  const enFrancais = (liste, champ) =>
    liste.find((e) => e.language.name === "fr")?.[champ] ??
    liste.find((e) => e.language.name === "en")?.[champ];

  const base = {};
  for (const s of mon.stats) base[s.stat.name] = s.base_stat;

  fiches[id - 1] = {
    id,
    nom: enFrancais(esp.names, "name") ?? mon.name,
    genre: enFrancais(esp.genera, "genus") ?? "Pokémon",
    types: mon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    stats: STATS.map((s) => base[s] ?? 50),
    capture: esp.capture_rate ?? 45,
    exp: mon.base_experience ?? 60,
    // Les légendaires et les fabuleux n'ont rien à faire dans les herbes.
    rare: Boolean(esp.is_legendary || esp.is_mythical),
  };
  if (esp.evolution_chain?.url) chaines.set(id, esp.evolution_chain.url);
});

const manquantes = fiches.filter((f) => !f).length;
if (manquantes) throw new Error(`${manquantes} espèces manquantes`);
console.log(`${MAX} fiches relevées`);

/* --------------------------------------------------------- les évolutions */

const adresses = [...new Set(chaines.values())];
const arbres = [];
await enParallele(adresses, async (url) => {
  const arbre = await json(url);
  if (arbre?.chain) arbres.push(arbre.chain);
});
console.log(`${arbres.length} chaînes d'évolution récupérées`);

const numero = (url) => Number(url.match(/\/(\d+)\/?$/)[1]);
const evolutions = {};

function parcourir(noeud) {
  const depuis = numero(noeud.species.url);
  for (const suite of noeud.evolves_to) {
    const vers = numero(suite.species.url);
    const detail = suite.evolution_details[0];
    // Une espèce à plusieurs branches — Évoli — ne garde que la première.
    if (detail && depuis <= MAX && vers <= MAX && !evolutions[depuis]) {
      evolutions[depuis] = [
        detail.min_level ??
          NIVEAU_PAR_DEFAUT[detail.trigger?.name] ??
          NIVEAU_AUTRE,
        vers,
      ];
    }
    parcourir(suite);
  }
}
for (const arbre of arbres) parcourir(arbre);

/* ------------------------------------------------------------- l'écriture */

const ligneFiche = (f) =>
  `  ${f.id}: [${JSON.stringify(f.nom)}, ${JSON.stringify(f.genre)}, ` +
  `${JSON.stringify(f.types)}, [${f.stats.join(", ")}], ` +
  `${f.capture}, ${f.exp}${f.rare ? ", 1" : ""}],`;

const ligneEvolution = ([id, [niveau, vers]]) => `  ${id}: [${niveau}, ${vers}],`;

const fichier = `/**
 * Les ${MAX} premières espèces, relevées une fois pour toutes chez PokéAPI puis
 * figées ici : le jeu n'interroge jamais le réseau en cours de partie.
 *
 * Chaque entrée tient en un tuple compact — nom et genre français, types,
 * statistiques de base dans l'ordre PV / Attaque / Défense / Attaque Spé. /
 * Défense Spé. / Vitesse, taux de capture, expérience de base, puis 1 pour un
 * légendaire ou un fabuleux, que les hautes herbes ne proposent jamais.
 *
 * Fichier engendré par \`scripts/generer-dex.mjs\` : relancez-le plutôt que de
 * corriger une ligne à la main.
 */

export type DexEntry = [
  nom: string,
  genre: string,
  types: string[],
  base: number[],
  capture: number,
  exp: number,
  rare?: 1,
];

export const DEX: Record<number, DexEntry> = {
${fiches.map(ligneFiche).join("\n")}
};

/** Dernier numéro couvert : la Génération V s'arrête à Unys. */
export const DEX_MAX = ${MAX};

/** Espèces que l'on peut croiser dans les hautes herbes. */
export const WILD_POOL: number[] = Object.entries(DEX)
  .filter(([, entry]) => !entry[6])
  .map(([id]) => Number(id));

/**
 * Évolutions par montée de niveau. Le jeu ne connaît ni pierre, ni échange,
 * ni bonheur : ces déclencheurs reçoivent un niveau de convention pour que la
 * lignée reste atteignable en jouant normalement.
 */
export const EVOLUTIONS: Record<number, [level: number, into: number]> = {
${Object.entries(evolutions)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(ligneEvolution)
  .join("\n")}
};
`;

writeFileSync(SORTIE, fichier);
console.log(
  `écrit : ${MAX} espèces, dont ${fiches.filter((f) => f.rare).length} écartées ` +
    `des herbes, et ${Object.keys(evolutions).length} évolutions`,
);
