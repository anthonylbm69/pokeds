import { describe, expect, it } from "vitest";
import { SPECIES } from "./data";
import {
  MAPS,
  REGION,
  STEP,
  TILES,
  regionNodeOf,
  seesPlayer,
  tileAt,
  walkable,
  type MapId,
  type MapSpec,
} from "./world";

const maps = Object.entries(MAPS) as [MapId, MapSpec][];
const solid = (map: MapSpec, x: number, y: number) => tileAt(map, x, y)?.solid !== false;

describe.each(maps)("carte %s", (id, map) => {
  it("est un rectangle de caractères connus", () => {
    const width = map.tiles[0].length;
    map.tiles.forEach((row, y) => {
      expect(row.length, `${id} ligne ${y}`).toBe(width);
      for (const char of row) {
        expect(TILES[char], `${id} ligne ${y} : « ${char} »`).toBeDefined();
      }
    });
  });

  it("ne pose aucun PNJ dans un mur", () => {
    for (const npc of map.npcs) {
      expect(solid(map, npc.x, npc.y), `${id} : ${npc.id}`).toBe(false);
    }
  });

  it("laisse chaque PNJ accessible depuis une case voisine", () => {
    for (const npc of map.npcs) {
      const reachable = Object.values(STEP).some(
        ({ dx, dy }) =>
          !solid(map, npc.x + dx, npc.y + dy) &&
          !map.npcs.some((o) => o.x === npc.x + dx && o.y === npc.y + dy),
      );
      expect(reachable, `${id} : ${npc.id} est inatteignable`).toBe(true);
    }
  });

  it("mène ses passages vers une arrivée libre", () => {
    for (const warp of map.warps) {
      expect(solid(map, warp.x, warp.y), `${id} (${warp.x},${warp.y})`).toBe(false);
      const dest = MAPS[warp.to];
      expect(dest, `${id} → ${warp.to}`).toBeDefined();
      expect(
        walkable(dest, warp.tx, warp.ty, dest.npcs),
        `${id} → ${warp.to} (${warp.tx},${warp.ty})`,
      ).toBe(true);
    }
  });

  it("place ses panneaux sur une case existante", () => {
    for (const sign of map.signs) {
      expect(tileAt(map, sign.x, sign.y), `${id} (${sign.x},${sign.y})`).not.toBeNull();
      expect(sign.text.length).toBeGreaterThan(0);
    }
  });

  it("n'annonce des rencontres que là où poussent les hautes herbes", () => {
    const grass = map.tiles.some((row) => row.includes(","));
    if (map.encounters?.length) {
      expect(grass, `${id} : table de rencontres sans herbes`).toBe(true);
      for (const spot of map.encounters) {
        expect(SPECIES[spot.id], `${id} : espèce ${spot.id} inconnue`).toBeDefined();
        expect(spot.min).toBeLessThanOrEqual(spot.max);
        expect(spot.weight).toBeGreaterThan(0);
      }
    }
  });

  it("n'oppose que des équipes d'espèces connues", () => {
    for (const npc of map.npcs) {
      if (!npc.trainer) continue;
      expect(npc.trainer.team.length).toBeGreaterThan(0);
      for (const mon of npc.trainer.team) {
        expect(SPECIES[mon.id], `${id} : ${npc.id} aligne ${mon.id}`).toBeDefined();
        expect(mon.level).toBeGreaterThan(0);
      }
      expect(npc.trainer.sight).toBeGreaterThan(0);
    }
  });
});

describe("les liaisons entre cartes", () => {
  it("reviennent toujours sur leurs pas", () => {
    for (const [id, map] of maps) {
      for (const warp of map.warps) {
        const back = MAPS[warp.to].warps.find((w) => w.to === id);
        expect(back, `${id} → ${warp.to} sans retour`).toBeDefined();
      }
    }
  });
});

describe("la carte de la région", () => {
  it("ne cite que des lieux existants, bien placés", () => {
    for (const node of REGION) {
      expect(MAPS[node.map], `${node.label} : carte inconnue`).toBeDefined();
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(100);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(100);
      for (const inside of node.inside ?? []) {
        expect(MAPS[inside], `${node.label} : intérieur ${inside} inconnu`).toBeDefined();
      }
    }
  });

  it("relie des lieux réellement voisins", () => {
    // Deux nœuds consécutifs de la carte doivent l'être aussi dans le monde.
    for (let i = 1; i < REGION.length; i++) {
      const from = MAPS[REGION[i - 1].map];
      const to = REGION[i].map;
      expect(
        from.warps.some((w) => w.to === to),
        `${REGION[i - 1].label} → ${REGION[i].label} : aucun passage`,
      ).toBe(true);
    }
  });

  it("situe chaque carte extérieure et chaque intérieur", () => {
    for (const [id, map] of maps) {
      const node = regionNodeOf(id);
      expect(node, `${map.name} (${id}) absent de la carte`).not.toBeNull();
    }
  });

  it("ne range un intérieur que dans un seul lieu", () => {
    const seen = new Set<MapId>();
    for (const node of REGION) {
      for (const inside of node.inside ?? []) {
        expect(seen.has(inside), `${inside} rattaché deux fois`).toBe(false);
        seen.add(inside);
      }
    }
  });
});

describe("le regard des dresseurs", () => {
  const route = MAPS.route1;
  const timmy = route.npcs.find((n) => n.trainer)!;

  it("repère le joueur dans son axe, à portée", () => {
    const { dx, dy } = STEP[timmy.dir];
    expect(seesPlayer(route, timmy, timmy.x + dx, timmy.y + dy)).toBe(true);
  });

  it("ignore ce qui est hors de portée ou de côté", () => {
    const { dx, dy } = STEP[timmy.dir];
    const far = timmy.trainer!.sight + 1;
    expect(seesPlayer(route, timmy, timmy.x + dx * far, timmy.y + dy * far)).toBe(false);
    expect(seesPlayer(route, timmy, timmy.x + 1, timmy.y + 1)).toBe(false);
  });
});

describe("franchissement", () => {
  it("refuse les arbres, l'eau et les bords de carte", () => {
    const route = MAPS.route1;
    expect(walkable(route, 0, 0, [])).toBe(false);
    expect(walkable(route, -1, 5, [])).toBe(false);
    expect(walkable(route, 9, 5, [])).toBe(true);
  });

  it("refuse une case occupée par un PNJ", () => {
    const bourg = MAPS.bourg;
    const npc = bourg.npcs[0];
    expect(walkable(bourg, npc.x, npc.y, [])).toBe(true);
    expect(walkable(bourg, npc.x, npc.y, bourg.npcs)).toBe(false);
  });
});
