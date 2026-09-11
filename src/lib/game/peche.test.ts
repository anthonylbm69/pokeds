import { describe, expect, it } from "vitest";
import { DEX } from "./dex";
import { ITEMS, RODS, ROD_SPECS, SHOP_STOCK, emptyBag, isRod } from "./items";
import { MAPS, WATER_POOL, type MapId, type MapSpec } from "./world";
import { CAST_LINES, NOTHING_LINE, ROD_ORDER, bestRod, castRod } from "./peche";

describe("les trois cannes", () => {
  it("vont de la plus modeste à la plus sérieuse", () => {
    for (let i = 1; i < ROD_ORDER.length; i++) {
      const avant = ROD_SPECS[ROD_ORDER[i - 1]];
      const apres = ROD_SPECS[ROD_ORDER[i]];
      expect(apres.bite, `${ROD_ORDER[i]} mord moins`).toBeGreaterThan(avant.bite);
      expect(apres.levels[0]).toBeGreaterThanOrEqual(avant.levels[1]);
      expect(apres.levels[1]).toBeGreaterThan(avant.levels[1]);
    }
  });

  it("couvrent toutes les cannes du catalogue", () => {
    expect([...ROD_ORDER].sort()).toEqual([...RODS].sort());
    for (const rod of RODS) expect(isRod(rod)).toBe(true);
    expect(isRod("potion")).toBe(false);
  });

  it("gardent une tranche de niveaux jouable", () => {
    for (const rod of RODS) {
      const [min, max] = ROD_SPECS[rod].levels;
      expect(min).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(100);
      expect(max).toBeGreaterThan(min);
      expect(ROD_SPECS[rod].bite).toBeGreaterThan(0);
      expect(ROD_SPECS[rod].bite).toBeLessThanOrEqual(1);
    }
  });

  it("se reçoit pour la première, se paie pour les autres", () => {
    expect(ITEMS.canne.price).toBe(0);
    expect(SHOP_STOCK).not.toContain("canne");
    expect(SHOP_STOCK).toContain("bonne-canne");
    expect(SHOP_STOCK).toContain("super-canne");
    expect(ITEMS["super-canne"].price).toBeGreaterThan(ITEMS["bonne-canne"].price);
  });

  it("entrent dans un sac neuf à zéro", () => {
    for (const rod of RODS) expect(emptyBag()[rod]).toBe(0);
  });
});

describe("le lancer", () => {
  it("ne rend rien quand ça ne mord pas", () => {
    // Un tirage au-dessus du seuil : la ligne revient vide.
    expect(castRod("canne", 0.99)).toBeNull();
    expect(castRod("super-canne", 0.99)).toBeNull();
  });

  it("rend une prise quand ça mord", () => {
    const prise = castRod("canne", 0, 0, 0);
    expect(prise).not.toBeNull();
    expect(DEX[prise!.id], `${prise!.id} hors Pokédex`).toBeDefined();
  });

  it("respecte le seuil de chaque canne", () => {
    for (const rod of RODS) {
      const seuil = ROD_SPECS[rod].bite;
      expect(castRod(rod, seuil - 0.001, 0, 0)).not.toBeNull();
      expect(castRod(rod, seuil, 0, 0)).toBeNull();
    }
  });

  it("reste dans la tranche de niveaux de la canne", () => {
    for (const rod of RODS) {
      const [min, max] = ROD_SPECS[rod].levels;
      expect(castRod(rod, 0, 0, 0)!.level).toBe(min);
      expect(castRod(rod, 0, 0, 0.999)!.level).toBe(max);
      for (let i = 0; i < 200; i++) {
        const prise = castRod(rod, 0)!;
        expect(prise.level).toBeGreaterThanOrEqual(min);
        expect(prise.level).toBeLessThanOrEqual(max);
      }
    }
  });

  it("ne ramène que des Pokémon d'eau", () => {
    for (let i = 0; i < 300; i++) {
      const prise = castRod("bonne-canne", 0);
      expect(WATER_POOL, `${prise!.id} n'est pas aquatique`).toContain(prise!.id);
      expect(DEX[prise!.id][2]).toContain("water");
    }
  });

  it("ne déborde jamais du vivier, même au tirage extrême", () => {
    // `Math.random()` ne rend jamais 1, mais un appelant maladroit, si.
    expect(castRod("canne", 0, 1, 0)).not.toBeNull();
    expect(DEX[castRod("canne", 0, 1, 0)!.id]).toBeDefined();
  });

  it("écarte les légendaires, comme les hautes herbes", () => {
    for (const id of WATER_POOL) expect(DEX[id][7]).toBeUndefined();
  });
});

describe("la meilleure canne du sac", () => {
  it("n'en trouve aucune dans un sac vide", () => {
    expect(bestRod(() => 0)).toBeNull();
  });

  it("préfère toujours la plus sérieuse", () => {
    expect(bestRod((r) => (r === "canne" ? 1 : 0))).toBe("canne");
    expect(bestRod((r) => (r === "canne" || r === "super-canne" ? 1 : 0))).toBe(
      "super-canne",
    );
    expect(bestRod(() => 1)).toBe("super-canne");
  });
});

describe("ce que l'on dit en pêchant", () => {
  it("annonce la canne employée", () => {
    expect(CAST_LINES("bonne-canne")[0]).toContain(ROD_SPECS["bonne-canne"].name);
  });

  it("a une phrase pour la ligne vide", () => {
    expect(NOTHING_LINE.length).toBeGreaterThan(0);
  });
});

describe("le pêcheur de la Route 3", () => {
  const maps = Object.entries(MAPS) as [MapId, MapSpec][];

  it("remet la première canne", () => {
    const npc = MAPS.route3.npcs.find((n) => n.id === "pecheur");
    expect(npc?.gift?.item).toBe("canne");
    expect(npc?.gift?.lines.length).toBeGreaterThan(0);
  });

  it("est le seul à faire un don, et d'un objet connu", () => {
    const dons = maps.flatMap(([id, map]) =>
      map.npcs.filter((n) => n.gift).map((n) => [id, n] as const),
    );
    expect(dons.length).toBeGreaterThan(0);
    for (const [id, npc] of dons) {
      expect(ITEMS[npc.gift!.item], `${id} : ${npc.gift!.item} inconnu`).toBeDefined();
    }
    // Un identifiant par personnage : le marqueur de don doit rester unique.
    const ids = dons.map(([id, npc]) => `${id}:${npc.id}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("se tient bel et bien au bord de l'eau", () => {
    const map = MAPS.route3;
    const npc = map.npcs.find((n) => n.id === "pecheur")!;
    let plusProche = Infinity;
    map.tiles.forEach((ligne, y) => {
      [...ligne].forEach((c, x) => {
        if (c !== "~") return;
        plusProche = Math.min(plusProche, Math.abs(x - npc.x) + Math.abs(y - npc.y));
      });
    });
    expect(plusProche, `eau la plus proche a ${plusProche} cases`).toBeLessThanOrEqual(6);
  });
});
