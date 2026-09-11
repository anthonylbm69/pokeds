import { beforeEach, describe, expect, it } from "vitest";
import { GENERATIONS } from "./pokeapi";
import {
  PREFS_KEY,
  defaultPrefs,
  forgetPrefs,
  loadPrefs,
  prefsServerSnapshot,
  prefsSnapshot,
  subscribePrefs,
  revivePrefs,
  savePrefs,
  type DexPrefs,
} from "./reglages";

/** Un `localStorage` de fortune : les tests tournent hors navigateur. */
class MemoireLocale {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const memoire = new MemoireLocale();
beforeEach(() => {
  memoire.clear();
  (globalThis as { localStorage?: unknown }).localStorage = memoire;
  forgetPrefs();
});

describe("les valeurs d'usine", () => {
  it("ouvrent le dex national, sur la fiche d'info, avec le son", () => {
    expect(defaultPrefs()).toEqual({ gen: 0, tab: "info", sound: true, id: 1 });
  });

  it("désignent une génération qui existe", () => {
    expect(GENERATIONS.some((g) => g.id === defaultPrefs().gen)).toBe(true);
  });

  it("rendent un objet neuf à chaque appel", () => {
    expect(defaultPrefs()).not.toBe(defaultPrefs());
  });
});

describe("la relecture des réglages", () => {
  const usine = defaultPrefs();

  it("garde un jeu de réglages valide tel quel", () => {
    const prefs: DexPrefs = { gen: 5, tab: "stats", sound: false, id: 494 };
    expect(revivePrefs(prefs)).toEqual(prefs);
  });

  it("ignore ce qui n'est pas un objet", () => {
    for (const brut of [null, undefined, 3, "info", true]) {
      expect(revivePrefs(brut)).toEqual(usine);
    }
  });

  it("rejette une génération inventée", () => {
    expect(revivePrefs({ gen: 42 }).gen).toBe(usine.gen);
    expect(revivePrefs({ gen: "V" }).gen).toBe(usine.gen);
  });

  it("rejette un onglet inconnu", () => {
    expect(revivePrefs({ tab: "combat" }).tab).toBe(usine.tab);
  });

  it("rejette un son qui n'est pas un booléen", () => {
    expect(revivePrefs({ sound: "oui" }).sound).toBe(usine.sound);
    expect(revivePrefs({ sound: false }).sound).toBe(false);
  });

  it("ramène un numéro de fiche douteux à la première", () => {
    for (const id of [0, -7, Number.NaN, "025", null]) {
      expect(revivePrefs({ id }).id).toBe(usine.id);
    }
    expect(revivePrefs({ id: 25.9 }).id).toBe(25);
  });

  it("complète un objet à moitié rempli", () => {
    expect(revivePrefs({ tab: "evo" })).toEqual({ ...usine, tab: "evo" });
  });
});

describe("le va-et-vient avec le disque", () => {
  it("rend les valeurs d'usine quand rien n'a été écrit", () => {
    expect(loadPrefs()).toEqual(defaultPrefs());
  });

  it("retrouve ce qui vient d'être posé", () => {
    const prefs: DexPrefs = { gen: 2, tab: "evo", sound: false, id: 196 };
    savePrefs(prefs);
    expect(loadPrefs()).toEqual(prefs);
  });

  it("écrit sous une clé qui lui est propre", () => {
    savePrefs(defaultPrefs());
    expect(localStorage.getItem(PREFS_KEY)).not.toBeNull();
    expect(PREFS_KEY).toContain("dex");
  });

  it("survit à une ligne illisible", () => {
    localStorage.setItem(PREFS_KEY, "{ceci n'est pas du JSON");
    expect(loadPrefs()).toEqual(defaultPrefs());
  });

  it("survit à un localStorage qui refuse tout", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem() {
        throw new Error("navigation privée");
      },
      setItem() {
        throw new Error("quota plein");
      },
    };
    expect(() => savePrefs(defaultPrefs())).not.toThrow();
    expect(loadPrefs()).toEqual(defaultPrefs());
  });
});

describe("le magasin extérieur", () => {
  it("sert les valeurs d'usine au serveur, toujours le même objet", () => {
    expect(prefsServerSnapshot()).toEqual(defaultPrefs());
    expect(prefsServerSnapshot()).toBe(prefsServerSnapshot());
  });

  it("garde sa référence tant que rien ne change", () => {
    expect(prefsSnapshot()).toBe(prefsSnapshot());
  });

  it("lit le disque au premier instantané", () => {
    const prefs: DexPrefs = { gen: 3, tab: "stats", sound: false, id: 252 };
    savePrefs(prefs);
    forgetPrefs();
    expect(prefsSnapshot()).toEqual(prefs);
  });

  it("change de référence à chaque enregistrement", () => {
    const avant = prefsSnapshot();
    savePrefs({ ...avant, gen: 4 });
    expect(prefsSnapshot()).not.toBe(avant);
    expect(prefsSnapshot().gen).toBe(4);
  });

  it("prévient ses abonnés, et les oublie au désabonnement", () => {
    let appels = 0;
    const stop = subscribePrefs(() => {
      appels += 1;
    });
    savePrefs({ ...prefsSnapshot(), sound: false });
    expect(appels).toBe(1);
    stop();
    savePrefs({ ...prefsSnapshot(), sound: true });
    expect(appels).toBe(1);
  });

  it("prévient même quand le disque refuse d'écrire", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => null,
      setItem() {
        throw new Error("quota plein");
      },
    };
    let appels = 0;
    const stop = subscribePrefs(() => {
      appels += 1;
    });
    expect(() => savePrefs(defaultPrefs())).not.toThrow();
    expect(appels).toBe(1);
    stop();
  });
});
