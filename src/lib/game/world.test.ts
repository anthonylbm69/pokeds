import { describe, expect, it } from "vitest";
import { SPECIES } from "./data";
import { DEX } from "./dex";
import {
  BUS_STOPS,
  LOCAL_SHARE,
  MAPS,
  REGION,
  STEP,
  TILES,
  regionNodeOf,
  rollEncounter,
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

describe("les portes conditionnelles", () => {
  it("retiennent le joueur au bourg tant qu'il n'a pas de Pokémon", () => {
    const sorties = MAPS.bourg.warps.filter((w) => w.to === "route1");
    expect(sorties.length).toBeGreaterThan(0);
    for (const sortie of sorties) {
      expect(sortie.needs, "sortie nord libre").toContain("starter");
      expect(sortie.refusal?.length, "refus sans réplique").toBeGreaterThan(0);
    }
  });

  it("réservent le Plateau aux trois insignes", () => {
    const portes = MAPS.route8.warps.filter((w) => w.to === "ligue");
    expect(portes.length).toBeGreaterThan(0);
    for (const porte of portes) {
      expect(porte.needs ?? []).toHaveLength(0);
    }
    const entrees = MAPS.ligue.warps.filter((w) => w.to === "ligue1");
    expect(entrees.length).toBeGreaterThan(0);
    for (const entree of entrees) {
      expect(entree.needs).toEqual([
        "insigne:trio",
        "insigne:sylve",
        "insigne:roc",
      ]);
    }
  });

  it("n'ouvrent une salle de la Ligue qu'après le membre précédent", () => {
    const suite: [MapId, MapId, string][] = [
      ["ligue1", "ligue2", "battu:ligue-yen"],
      ["ligue2", "ligue3", "battu:ligue-christina"],
      ["ligue3", "ligue4", "battu:ligue-will"],
      ["ligue4", "ligue5", "battu:ligue-vic"],
    ];
    for (const [depuis, vers, marqueur] of suite) {
      const portes = MAPS[depuis].warps.filter((w) => w.to === vers);
      expect(portes.length, `${depuis} → ${vers}`).toBeGreaterThan(0);
      for (const porte of portes) {
        expect(porte.needs, `${depuis} → ${vers}`).toContain(marqueur);
      }
    }
  });

  it("ne réclame jamais un marqueur que rien ne délivre", () => {
    const delivres = new Set(["starter"]);
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs) {
        delivres.add(`battu:${npc.id}`);
        if (npc.trainer?.badge) delivres.add(`insigne:${npc.trainer.badge}`);
      }
    }
    for (const [id, map] of maps) {
      for (const warp of map.warps) {
        for (const besoin of warp.needs ?? []) {
          expect(delivres.has(besoin), `${id} exige « ${besoin} », jamais délivré`).toBe(true);
        }
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

describe("les Cars Faure", () => {
  it("desservent chaque ville et chaque route", () => {
    for (const node of REGION) {
      expect(
        BUS_STOPS.some((stop) => stop.map === node.map),
        `${node.label} sans arrêt`,
      ).toBe(true);
    }
    expect(BUS_STOPS).toHaveLength(REGION.length);
  });

  it("posent un vrai poteau sur la carte annoncée", () => {
    for (const stop of BUS_STOPS) {
      const map = MAPS[stop.map];
      expect(map, `${stop.label} : carte inconnue`).toBeDefined();
      const poteaux = map.tiles.join("").split("").filter((c) => c === "U").length;
      expect(poteaux, `${stop.label} : ${poteaux} poteau(x)`).toBe(1);
    }
  });

  it("déposent sur une case franchissable, à côté du poteau", () => {
    for (const stop of BUS_STOPS) {
      const map = MAPS[stop.map];
      expect(
        walkable(map, stop.x, stop.y, map.npcs),
        `${stop.label} : arrivée bloquée en (${stop.x},${stop.y})`,
      ).toBe(true);

      const voisin = Object.values(STEP).some(
        ({ dx, dy }) => tileAt(map, stop.x + dx, stop.y + dy)?.kind === "bus",
      );
      expect(voisin, `${stop.label} : arrivée loin du poteau`).toBe(true);
    }
  });

  it("n'exigent que des insignes réellement distribués", () => {
    const remis = new Set(
      Object.values(MAPS).flatMap((map) =>
        map.npcs.map((npc) => npc.trainer?.badge).filter(Boolean),
      ),
    );
    for (const stop of BUS_STOPS) {
      for (const badge of stop.badges) {
        expect(remis.has(badge), `insigne « ${badge} » jamais remis`).toBe(true);
      }
    }
  });

  it("laissent le départ accessible sans le moindre insigne", () => {
    const libres = BUS_STOPS.filter((stop) => !stop.badges.length).map((stop) => stop.map);
    expect(libres).toContain("bourg");
    expect(libres.length).toBeGreaterThan(0);
  });

  it("réservent le Plateau à qui possède les trois insignes", () => {
    const plateau = BUS_STOPS.find((stop) => stop.map === "ligue");
    expect(plateau, "aucun arrêt au Plateau").toBeDefined();
    expect(plateau!.badges).toHaveLength(3);
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

describe("les hautes herbes", () => {
  it("tirent dans tout le Pokédex national, pas seulement la faune locale", () => {
    const route = MAPS.route1;
    const locales = new Set(route.encounters!.map((e) => e.id));
    const vus = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      const rencontre = rollEncounter(route)!;
      vus.add(rencontre.id);
    }
    // Deux tirages sur trois viennent du Pokédex entier : on doit voir passer
    // bien plus que les deux espèces inscrites sur la carte.
    expect(vus.size).toBeGreaterThan(100);
    for (const id of locales) expect(vus.has(id)).toBe(true);
  });

  it("ne proposent que des espèces existantes et jamais un légendaire", () => {
    const rares = new Set(
      Object.keys(DEX).map(Number).filter((id) => DEX[id][6]),
    );
    for (const [id, map] of Object.entries(MAPS) as [MapId, MapSpec][]) {
      if (!map.encounters?.length) continue;
      for (let i = 0; i < 300; i++) {
        const { id: espece, level } = rollEncounter(map)!;
        expect(DEX[espece], `${id} : espèce ${espece} hors Pokédex`).toBeDefined();
        expect(rares.has(espece), `${id} : ${espece} est un légendaire`).toBe(false);
        expect(level).toBeGreaterThan(0);
      }
    }
  });

  it("gardent la tranche de niveaux inscrite sur la carte", () => {
    for (const [id, map] of Object.entries(MAPS) as [MapId, MapSpec][]) {
      if (!map.encounters?.length) continue;
      const min = Math.min(...map.encounters.map((e) => e.min));
      const max = Math.max(...map.encounters.map((e) => e.max));
      for (let i = 0; i < 200; i++) {
        const { level } = rollEncounter(map)!;
        expect(level, `${id} : niveau ${level} hors de [${min}, ${max}]`)
          .toBeGreaterThanOrEqual(min);
        expect(level).toBeLessThanOrEqual(max);
      }
    }
  });

  it("laissent la faune locale peser sa part", () => {
    const route = MAPS.route1;
    const locales = new Set(route.encounters!.map((e) => e.id));
    let chez_nous = 0;
    const tirages = 20000;
    for (let i = 0; i < tirages; i++) {
      if (locales.has(rollEncounter(route)!.id)) chez_nous += 1;
    }
    // Un peu au-dessus de LOCAL_SHARE : le tirage général peut retomber sur
    // une espèce locale. Bornes larges, on ne vérifie que l'ordre de grandeur.
    const part = chez_nous / tirages;
    expect(part).toBeGreaterThan(LOCAL_SHARE - 0.05);
    expect(part).toBeLessThan(LOCAL_SHARE + 0.1);
  });
});
