/**
 * Les réglages du Pokédex de la console : génération affichée, onglet ouvert,
 * son, et dernière fiche consultée. Rien qui mérite un serveur — une ligne de
 * `localStorage` suffit — mais tout se relit prudemment : un réglage abîmé
 * reprend sa valeur d'usine plutôt que de casser l'écran.
 */

import { GENERATIONS } from "./pokeapi";

export type DexTabId = "info" | "stats" | "evo";

export type DexPrefs = {
  /** Identifiant d'une entrée de `GENERATIONS` ; 0 vaut « tout ». */
  gen: number;
  tab: DexTabId;
  sound: boolean;
  /** La fiche qu'on regardait en partant. */
  id: number;
};

export const PREFS_KEY = "pokeds:dex";

const TABS: DexTabId[] = ["info", "stats", "evo"];

export const defaultPrefs = (): DexPrefs => ({
  gen: 0,
  tab: "info",
  sound: true,
  id: 1,
});

/** Relit des réglages venus du disque, champ par champ. */
export function revivePrefs(brut: unknown): DexPrefs {
  const defaut = defaultPrefs();
  if (!brut || typeof brut !== "object") return defaut;
  const p = brut as Partial<DexPrefs>;
  return {
    gen: GENERATIONS.some((g) => g.id === p.gen) ? (p.gen as number) : defaut.gen,
    tab: TABS.includes(p.tab as DexTabId) ? (p.tab as DexTabId) : defaut.tab,
    sound: typeof p.sound === "boolean" ? p.sound : defaut.sound,
    id:
      typeof p.id === "number" && Number.isFinite(p.id) && p.id >= 1
        ? Math.floor(p.id)
        : defaut.id,
  };
}

export function loadPrefs(): DexPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    return revivePrefs(JSON.parse(raw));
  } catch {
    // Navigation privée, ou une ligne illisible : on repart des valeurs d'usine.
    return defaultPrefs();
  }
}

/* ------------------------------------------------------ le petit magasin */

/**
 * Les réglages servent de source extérieure à React, via
 * `useSyncExternalStore` : le serveur rend les valeurs d'usine, le client
 * relit le disque après l'hydratation, et personne ne se plaint d'un écart.
 */

const USINE = defaultPrefs();
let courant: DexPrefs | null = null;
const abonnes = new Set<() => void>();

export function subscribePrefs(fn: () => void): () => void {
  abonnes.add(fn);
  return () => {
    abonnes.delete(fn);
  };
}

/** Ce que le client voit : lu une fois, puis gardé — la référence doit tenir. */
export function prefsSnapshot(): DexPrefs {
  if (!courant) courant = loadPrefs();
  return courant;
}

/** Ce que le serveur voit : toujours le même objet, donc un rendu stable. */
export const prefsServerSnapshot = (): DexPrefs => USINE;

export function savePrefs(prefs: DexPrefs): void {
  courant = prefs;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Quota plein : le Pokédex marche quand même, il oubliera juste.
  }
  for (const fn of abonnes) fn();
}

/** Oublie l'instantané gardé en mémoire. Les tests en ont besoin. */
export function forgetPrefs(): void {
  courant = null;
}
