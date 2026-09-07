import { describe, expect, it } from "vitest";
import {
  MOMENT_FR,
  NIGHT_POOL,
  NIGHT_SHARE,
  TINT,
  atNight,
  momentAt,
  momentNow,
  type Moment,
} from "./heure";
import { DEX, WILD_POOL } from "./dex";
import { BOX_ORDER_FR, sortedBox, type BoxOrder } from "./state";
import { createMon } from "./battle";

describe("l'heure du jeu", () => {
  it("découpe la journée sans trou ni chevauchement", () => {
    const vus = new Set<Moment>();
    for (let h = 0; h < 24; h++) {
      const m = momentAt(h);
      expect(MOMENT_FR[m], `${h} h`).toBeDefined();
      vus.add(m);
    }
    expect(vus).toEqual(new Set(["jour", "soir", "nuit"]));
  });

  it("place le jour, le soir et la nuit aux bonnes heures", () => {
    expect(momentAt(6)).toBe("jour");
    expect(momentAt(12)).toBe("jour");
    expect(momentAt(17)).toBe("jour");
    expect(momentAt(18)).toBe("soir");
    expect(momentAt(20)).toBe("soir");
    expect(momentAt(21)).toBe("nuit");
    expect(momentAt(3)).toBe("nuit");
    expect(momentAt(5)).toBe("nuit");
  });

  it("se lit sur l'horloge de la machine", () => {
    expect(momentNow(new Date(2026, 0, 1, 13))).toBe("jour");
    expect(momentNow(new Date(2026, 0, 1, 23))).toBe("nuit");
  });

  it("ne voile pas le plein jour, et assombrit de plus en plus", () => {
    expect(TINT.jour.alpha).toBe(0);
    expect(TINT.soir.alpha).toBeGreaterThan(0);
    expect(TINT.nuit.alpha).toBeGreaterThan(TINT.soir.alpha);
    // Un voile trop épais rendrait la carte illisible.
    expect(TINT.nuit.alpha).toBeLessThan(0.5);
  });
});

describe("la faune nocturne", () => {
  it("ne retient que des espèces des types de la nuit", () => {
    expect(NIGHT_POOL.length).toBeGreaterThan(50);
    for (const id of NIGHT_POOL) {
      const types = DEX[id][2];
      expect(
        types.some((t) => ["ghost", "dark", "poison", "bug"].includes(t)),
        `${DEX[id][0]} n'a rien de nocturne`,
      ).toBe(true);
    }
  });

  it("reste un sous-ensemble de ce que l'on peut croiser", () => {
    const vivier = new Set(WILD_POOL);
    for (const id of NIGHT_POOL) expect(vivier.has(id)).toBe(true);
  });

  it("ne change rien de jour ni au crépuscule", () => {
    for (const moment of ["jour", "soir"] as const) {
      for (const tirage of [0, 0.2, 0.6, 0.99]) {
        expect(atNight(25, moment, tirage)).toBe(25);
      }
    }
  });

  it("laisse la moitié des rencontres nocturnes intactes", () => {
    // Au-delà du seuil, l'espèce de la carte est gardée telle quelle.
    expect(atNight(25, "nuit", NIGHT_SHARE)).toBe(25);
    expect(atNight(25, "nuit", 0.99)).toBe(25);
    // En deçà, c'est une créature de la nuit qui se présente.
    expect(NIGHT_POOL).toContain(atNight(25, "nuit", 0.1));
  });

  it("ne rend jamais autre chose qu'une espèce connue", () => {
    for (let i = 0; i < 500; i++) {
      const id = atNight(25, "nuit", Math.random());
      expect(DEX[id], `espèce ${id} inconnue`).toBeDefined();
    }
  });
});

describe("le rangement du PC", () => {
  const boite = () => {
    const a = { ...createMon(25, 30, false), name: "Pikachu" };
    const b = { ...createMon(1, 50, false), name: "Bulbizarre" };
    const c = { ...createMon(143, 10, false), name: "Ronflex" };
    return [a, b, c];
  };

  it("nomme chaque façon de ranger", () => {
    for (const id of Object.keys(BOX_ORDER_FR) as BoxOrder[]) {
      expect(BOX_ORDER_FR[id].length).toBeGreaterThan(0);
    }
  });

  it("garde l'ordre d'arrivée par défaut", () => {
    expect(sortedBox(boite(), "arrivee")).toEqual([0, 1, 2]);
  });

  it("range par numéro, par niveau et par nom", () => {
    const box = boite();
    expect(sortedBox(box, "numero").map((i) => box[i].id)).toEqual([1, 25, 143]);
    expect(sortedBox(box, "niveau").map((i) => box[i].level)).toEqual([50, 30, 10]);
    expect(sortedBox(box, "nom").map((i) => box[i].name)).toEqual([
      "Bulbizarre",
      "Pikachu",
      "Ronflex",
    ]);
  });

  it("ne perd ni ne duplique personne, quel que soit le tri", () => {
    const box = boite();
    for (const order of Object.keys(BOX_ORDER_FR) as BoxOrder[]) {
      const rangs = sortedBox(box, order);
      expect(rangs).toHaveLength(box.length);
      expect(new Set(rangs).size).toBe(box.length);
      for (const i of rangs) expect(box[i]).toBeDefined();
    }
  });

  it("ne touche pas à la boîte elle-même", () => {
    const box = boite();
    const avant = box.map((m) => m.name);
    sortedBox(box, "nom");
    expect(box.map((m) => m.name)).toEqual(avant);
  });

  it("ne bronche pas sur une boîte vide", () => {
    for (const order of Object.keys(BOX_ORDER_FR) as BoxOrder[]) {
      expect(sortedBox([], order)).toEqual([]);
    }
  });
});
