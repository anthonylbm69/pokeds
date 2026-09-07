import { describe, expect, it } from "vitest";
import {
  MAPS,
  WATER_POOL,
  isWater,
  rollWaterEncounter,
  walkable,
  type MapId,
  type MapSpec,
} from "./world";
import { DEX } from "./dex";
import { SURF_BADGE, canSurf, newGame, withFlag } from "./state";
import { ITEMS, SHOP_STOCK, emptyBag } from "./items";
import { createMon, startWild, throwBall } from "./battle";

/** Une carte qui a de l'eau, et la première case d'eau qu'on y trouve. */
function premiereEau(): { map: MapSpec; x: number; y: number } {
  for (const map of Object.values(MAPS) as MapSpec[]) {
    for (let y = 0; y < map.tiles.length; y++) {
      const x = map.tiles[y].indexOf("~");
      if (x >= 0) return { map, x, y };
    }
  }
  throw new Error("aucune eau sur aucune carte");
}

describe("le Surf", () => {
  it("laisse l'eau infranchissable à pied", () => {
    const { map, x, y } = premiereEau();
    expect(isWater(map, x, y)).toBe(true);
    expect(walkable(map, x, y, [])).toBe(false);
  });

  it("l'ouvre dès que l'on nage", () => {
    const { map, x, y } = premiereEau();
    expect(walkable(map, x, y, [], true)).toBe(true);
  });

  it("ne rend pas les murs franchissables pour autant", () => {
    const { map } = premiereEau();
    // Un arbre reste un arbre, que l'on nage ou non.
    const murs: { x: number; y: number }[] = [];
    map.tiles.forEach((row, y) => {
      const x = row.indexOf("#");
      if (x >= 0) murs.push({ x, y });
    });
    if (!murs.length) return;
    expect(walkable(map, murs[0].x, murs[0].y, [], true)).toBe(false);
  });

  it("demande l'insigne de Mions", () => {
    const debut = newGame("Test");
    expect(canSurf(debut)).toBe(false);
    expect(canSurf(withFlag(debut, `insigne:${SURF_BADGE}`))).toBe(true);
  });

  it("ne reprend jamais une partie au milieu de l'eau", () => {
    // `newGame` part à pied ; `loadGame` remet le drapeau à faux.
    expect(newGame("Test").surfing).toBe(false);
  });
});

describe("les rencontres en mer", () => {
  it("ne proposent que des espèces d'eau", () => {
    expect(WATER_POOL.length).toBeGreaterThan(30);
    for (const id of WATER_POOL) {
      expect(DEX[id][2], `${DEX[id][0]} n'est pas de type Eau`).toContain("water");
    }
  });

  it("écartent les légendaires, comme les herbes", () => {
    for (const legendaire of [382, 383, 384, 490]) {
      expect(WATER_POOL).not.toContain(legendaire);
    }
  });

  it("tirent dans une fourchette de niveaux plus haute qu'en bordure de route", () => {
    const vus = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const { id, level } = rollWaterEncounter();
      vus.add(id);
      expect(level).toBeGreaterThanOrEqual(15);
      expect(level).toBeLessThanOrEqual(35);
      expect(DEX[id][2]).toContain("water");
    }
    expect(vus.size).toBeGreaterThan(10);
  });
});

describe("la Master Ball", () => {
  it("ne figure dans aucun rayon", () => {
    expect(SHOP_STOCK).not.toContain("masterball");
    expect(ITEMS.masterball.price).toBe(0);
    // Tout ce qui se vend a bien un prix.
    for (const id of SHOP_STOCK) expect(ITEMS[id].price).toBeGreaterThan(0);
  });

  it("attrape à tous les coups", () => {
    expect(ITEMS.masterball.bonus).toBeGreaterThan(200);
    for (let i = 0; i < 40; i++) {
      // Un légendaire au taux de capture le plus bas, en pleine forme.
      const foe = createMon(487, 70, false);
      const state = startWild(
        [createMon(495, 50, false)],
        foe,
        { ...emptyBag(), masterball: 1 },
      );
      expect(throwBall(state, "masterball").state.outcome).toBe("capture");
    }
  });
});

describe("l'après-Ligue", () => {
  it("fait apparaître un second légendaire dans la grotte", () => {
    const tardif = MAPS.grotte.npcs.filter((n) => n.needs?.length);
    expect(tardif.length).toBeGreaterThan(0);
    for (const n of tardif) {
      expect(n.needs).toContain("insigne:ligue");
      expect(n.mon, `${n.id} devrait être un Pokémon`).toBeDefined();
    }
  });

  it("ne le montre pas avant que la Ligue soit tombée", () => {
    const giratina = MAPS.grotte.npcs.find((n) => n.id === "giratina");
    expect(giratina?.mon?.id).toBe(487);
    expect(giratina?.mon?.level).toBeGreaterThan(60);
    expect(giratina?.needs).toEqual(["insigne:ligue"]);
  });

  it("laisse Mew accessible dès le départ", () => {
    const mew = MAPS.grotte.npcs.find((n) => n.id === "mew");
    expect(mew?.needs).toBeUndefined();
  });

  it("garde chaque occupant sur sa propre case", () => {
    const places = MAPS.grotte.npcs.map((n) => `${n.x},${n.y}`);
    expect(new Set(places).size).toBe(places.length);
    for (const n of MAPS.grotte.npcs) {
      expect(walkable(MAPS.grotte, n.x, n.y, []), `${n.id} dans un mur`).toBe(true);
    }
  });

  it("laisse un accès libre à chacun", () => {
    for (const n of MAPS.grotte.npcs) {
      const abords = [
        [n.x, n.y + 1], [n.x, n.y - 1], [n.x - 1, n.y], [n.x + 1, n.y],
      ].filter(([x, y]) => walkable(MAPS.grotte, x, y, MAPS.grotte.npcs));
      expect(abords.length, `${n.id} est inaccessible`).toBeGreaterThan(0);
    }
  });
});

describe("toutes les cartes", () => {
  it("restent traversables à pied comme en Surf", () => {
    // Une régression de `walkable` casserait le jeu entier : on vérifie que
    // nager n'ouvre jamais ce qui doit rester fermé.
    for (const [id, map] of Object.entries(MAPS) as [MapId, MapSpec][]) {
      map.tiles.forEach((row, y) => {
        [...row].forEach((c, x) => {
          if (c !== "#" && c !== "X" && c !== "W") return;
          expect(walkable(map, x, y, [], true), `${id} (${x},${y})`).toBe(false);
        });
      });
    }
  });
});
