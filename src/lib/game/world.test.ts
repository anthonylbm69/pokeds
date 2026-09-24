import { describe, expect, it } from "vitest";
import { SPECIES } from "./data";
import { DEX, WILD_POOL } from "./dex";
import { ITEMS } from "./items";
import {
  BUS_STOPS,
  LOCAL_SHARE,
  MAPS,
  REGION,
  STEP,
  TILES,
  ECART_EQUIPE,
  ECART_HERBE,
  PROGRESSION,
  SAUT_MAX,
  followerSpot,
  groundAt,
  groundFlag,
  regionNodeOf,
  rollEncounter,
  seesPlayer,
  tileAt,
  walkable,
  type MapId,
  type MapSpec,
  type Trail,
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
    // Le contraire du vivier : ce que les herbes ne doivent jamais rendre.
    const vivier = new Set(WILD_POOL);
    const rares = new Set(Object.keys(DEX).map(Number).filter((id) => !vivier.has(id)));
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

describe("le Pokémon qui suit", () => {
  const trail = (over: Partial<Trail> = {}): Trail => ({
    x: 5, y: 5, fx: 5, fy: 6, moving: false, progress: 0, dir: "up", ...over,
  });

  it("se tient sur la case que le joueur vient de quitter", () => {
    const spot = followerSpot(trail());
    expect(spot).toEqual({ x: 5, y: 6, dir: "up" });
  });

  it("regarde dans la direction du pas qu'il vient de faire", () => {
    expect(followerSpot(trail({ x: 5, y: 5, fx: 4, fy: 5 })).dir).toBe("right");
    expect(followerSpot(trail({ x: 5, y: 5, fx: 6, fy: 5 })).dir).toBe("left");
    expect(followerSpot(trail({ x: 5, y: 5, fx: 5, fy: 4 })).dir).toBe("down");
    expect(followerSpot(trail({ x: 5, y: 5, fx: 5, fy: 6 })).dir).toBe("up");
  });

  it("glisse vers la case du joueur pendant le pas", () => {
    const debut = followerSpot(trail({ moving: true, progress: 0 }));
    const milieu = followerSpot(trail({ moving: true, progress: 0.5 }));
    const fin = followerSpot(trail({ moving: true, progress: 1 }));
    expect(debut.y).toBe(6);
    expect(milieu.y).toBe(5.5);
    expect(fin.y).toBe(5);
    // Il reste dans la colonne : le pas était vertical.
    for (const p of [debut, milieu, fin]) expect(p.x).toBe(5);
  });

  it("ne dépasse jamais la case visée, même si le pas déborde", () => {
    expect(followerSpot(trail({ moving: true, progress: 1.4 })).y).toBe(5);
    expect(followerSpot(trail({ moving: true, progress: -0.2 })).y).toBe(6);
  });

  it("reste empilé sur le joueur à l'arrivée sur une carte", () => {
    // `newPlayer` pose le suiveur sur la case du joueur : il n'a pas encore
    // de pas derrière lui et prend donc son regard.
    const spot = followerSpot(trail({ x: 5, y: 5, fx: 5, fy: 5, dir: "left" }));
    expect(spot).toEqual({ x: 5, y: 5, dir: "left" });
  });
});

describe("les Centres Pokémon", () => {
  const centres = (Object.entries(MAPS) as [MapId, MapSpec][]).filter(([id]) =>
    id.startsWith("centre"),
  );

  it("existent en plusieurs exemplaires", () => {
    expect(centres.length).toBeGreaterThanOrEqual(5);
  });

  it("ont tous un PC accessible depuis une case libre", () => {
    for (const [id, map] of centres) {
      const postes: { x: number; y: number }[] = [];
      map.tiles.forEach((row, y) => {
        [...row].forEach((c, x) => {
          if (TILES[c]?.kind === "pc") postes.push({ x, y });
        });
      });
      expect(postes.length, `${id} : aucun PC`).toBe(1);

      // On s'en sert en lui faisant face : il faut une case libre autour.
      const { x, y } = postes[0];
      const abords = [
        [x, y + 1], [x, y - 1], [x - 1, y], [x + 1, y],
      ].filter(([ax, ay]) => walkable(map, ax, ay, map.npcs));
      expect(abords.length, `${id} : PC inaccessible`).toBeGreaterThan(0);
    }
  });

  it("gardent leur infirmière et leur comptoir", () => {
    for (const [id, map] of centres) {
      expect(map.npcs.some((n) => n.heals), `${id} : personne pour soigner`).toBe(true);
      expect(map.indoor, `${id} : devrait être un intérieur`).toBe(true);
    }
  });
});

describe("la grotte secrète", () => {
  const grotte = MAPS.grotte;

  it("se cache derrière la porte d'une cabane, et non d'une pièce", () => {
    const porte = MAPS.route8.warps.find((w) => w.to === "grotte");
    expect(porte, "aucune porte n'y mène depuis la Route 8").toBeDefined();
    // On ressort par où l'on est entré.
    const retour = grotte.warps.filter((w) => w.to === "route8");
    expect(retour.length).toBeGreaterThan(0);
    for (const w of retour) {
      expect(w.tx).toBe(porte!.x);
      expect(w.ty).toBe(porte!.y + 1);
    }
  });

  it("garde son occupant, un Mew de niveau 55 qui flotte", () => {
    const mew = grotte.npcs.find((n) => n.id === "mew");
    expect(mew?.mon).toBeDefined();
    expect(mew!.mon!.id).toBe(151);
    expect(mew!.mon!.level).toBe(55);
    expect(mew!.mon!.floats).toBe(true);
    expect(mew!.lines.length).toBeGreaterThan(0);
    // Ce n'est pas un dresseur : on doit pouvoir l'attraper.
    expect(mew!.trainer).toBeUndefined();
  });

  it("laisse l'atteindre : une case libre devant lui", () => {
    const mew = grotte.npcs.find((n) => n.id === "mew")!;
    const abords = [
      [mew.x, mew.y + 1], [mew.x, mew.y - 1],
      [mew.x - 1, mew.y], [mew.x + 1, mew.y],
    ].filter(([x, y]) => walkable(grotte, x, y, grotte.npcs));
    expect(abords.length, "Mew est inaccessible").toBeGreaterThan(0);
  });

  it("n'a ni hautes herbes ni rencontres : Mew est la seule affaire", () => {
    expect(grotte.encounters).toBeUndefined();
    expect(grotte.tiles.some((row) => row.includes(","))).toBe(false);
  });

  it("est taillée dans la roche, close de toutes parts", () => {
    for (const row of grotte.tiles) {
      expect(row[0]).toBe("R");
      expect(row[row.length - 1]).toBe("R");
    }
    expect(grotte.tiles[0]).toMatch(/^R+$/);
  });
});

describe("les Pokémon postés sur une carte", () => {
  it("n'ont pas de sprite de personnage, et réciproquement", () => {
    for (const [id, map] of Object.entries(MAPS) as [MapId, MapSpec][]) {
      for (const npc of map.npcs) {
        const marque = `${id} : ${npc.id}`;
        if (npc.mon) {
          expect(npc.sprite, `${marque} devrait se dessiner en Pokémon`).toBeUndefined();
          expect(npc.mon.level, marque).toBeGreaterThan(0);
          expect(DEX[npc.mon.id], `${marque} : espèce inconnue`).toBeDefined();
        } else {
          expect(npc.sprite, `${marque} n'a aucun sprite`).toBeDefined();
        }
      }
    }
  });
});

describe("les objets posés au sol", () => {
  /** Tout ce que l'on peut atteindre à pied depuis une case de départ. */
  const atteignables = (map: MapSpec, depart: { x: number; y: number }) => {
    const vus = new Set<string>();
    const file = [depart];
    vus.add(`${depart.x},${depart.y}`);
    while (file.length) {
      const { x, y } = file.shift()!;
      for (const { dx, dy } of Object.values(STEP)) {
        const nx = x + dx;
        const ny = y + dy;
        const clef = `${nx},${ny}`;
        if (vus.has(clef)) continue;
        const tile = tileAt(map, nx, ny);
        // L'eau se traverse en Surf : elle ne coupe pas le monde en deux.
        if (!tile || (tile.solid && !tile.swim)) continue;
        vus.add(clef);
        file.push({ x: nx, y: ny });
      }
    }
    return vus;
  };

  /** Par où l'on entre sur cette carte : les arrivées des passages voisins. */
  const entrees = (id: MapId) => {
    const points: { x: number; y: number }[] = [];
    for (const map of Object.values(MAPS)) {
      for (const w of map.warps) {
        if (w.to === id) points.push({ x: w.tx, y: w.ty });
      }
    }
    return points;
  };

  const poses = maps.filter(([, map]) => (map.items?.length ?? 0) > 0);

  it("se trouvent sur plus d'une carte", () => {
    expect(poses.length).toBeGreaterThan(5);
  });

  it("ne nomment que des objets du catalogue", () => {
    for (const [id, map] of maps) {
      for (const objet of map.items ?? []) {
        expect(ITEMS[objet.item], `${id} : ${objet.item} inconnu`).toBeDefined();
        if (objet.count !== undefined) {
          expect(objet.count, `${id} : ${objet.item}`).toBeGreaterThan(0);
        }
      }
    }
  });

  describe.each(poses)("carte %s", (id, map) => {
    it("ne pose rien dans un mur ni dans l'eau", () => {
      for (const { x, y } of map.items!) {
        const tile = tileAt(map, x, y);
        expect(tile, `${id} : ${x},${y} hors carte`).toBeDefined();
        expect(tile!.solid, `${id} : ${x},${y} dans un mur`).toBe(false);
        expect(tile!.swim, `${id} : ${x},${y} dans l'eau`).toBeFalsy();
      }
    });

    it("ne pose rien sur une porte, un panneau ou un PNJ", () => {
      const pris = new Set([
        ...map.warps.map((w) => `${w.x},${w.y}`),
        ...map.signs.map((s) => `${s.x},${s.y}`),
        ...map.npcs.map((n) => `${n.x},${n.y}`),
      ]);
      for (const { x, y } of map.items!) {
        expect(pris.has(`${x},${y}`), `${id} : ${x},${y} occupé`).toBe(false);
      }
    });

    it("ne pose jamais deux objets sur la même case", () => {
      const cases = map.items!.map((o) => `${o.x},${o.y}`);
      expect(new Set(cases).size, `${id} : doublon`).toBe(cases.length);
    });

    it("laisse chaque objet accessible à pied depuis une entrée", () => {
      const depart = entrees(id);
      expect(depart.length, `${id} : aucune entrée`).toBeGreaterThan(0);
      const joignables = atteignables(map, depart[0]);
      for (const { x, y } of map.items!) {
        expect(
          joignables.has(`${x},${y}`),
          `${id} : ${x},${y} hors d'atteinte depuis ${depart[0].x},${depart[0].y}`,
        ).toBe(true);
      }
    });
  });

  it("donne à chaque case un marqueur qui lui est propre", () => {
    const marqueurs = new Set<string>();
    for (const [id, map] of poses) {
      for (const { x, y } of map.items!) {
        const flag = groundFlag(id, x, y);
        expect(marqueurs.has(flag), `${flag} en double`).toBe(false);
        marqueurs.add(flag);
        expect(groundAt(map, x, y)).not.toBeNull();
      }
    }
  });

  it("ne voit rien là où rien n'a été posé", () => {
    expect(groundAt(MAPS.bourg, 0, 0)).toBeNull();
    expect(groundAt(MAPS.route1, 9, 9)).toBeNull();
  });
});

describe("la courbe de difficulté", () => {
  /** Les niveaux de tous les dresseurs d'une carte, Champion compris. */
  const niveaux = (id: MapId) =>
    MAPS[id].npcs
      .filter((n) => n.trainer)
      .flatMap((n) => (n.trainer!.team ?? []).map((t) => t.level));

  /** Les niveaux des hautes herbes d'une carte. */
  const herbe = (id: MapId) =>
    (MAPS[id].encounters ?? []).flatMap((e) => [e.min, e.max]);

  const etapes = PROGRESSION.filter((id) => niveaux(id).length > 0);

  it("couvre toute zone qui a un dresseur ou des hautes herbes", () => {
    // Sans cela, une zone ajoutée échapperait silencieusement aux vérifications.
    for (const [id, map] of maps) {
      const compte = map.npcs.some((n) => n.trainer) || (map.encounters?.length ?? 0) > 0;
      if (!compte) continue;
      expect(PROGRESSION, `${id} hors de la progression`).toContain(id);
    }
  });

  it("ne nomme pas deux fois la même zone", () => {
    expect(new Set(PROGRESSION).size).toBe(PROGRESSION.length);
  });

  it("monte sans marche infranchissable", () => {
    for (let i = 1; i < etapes.length; i++) {
      const avant = etapes[i - 1];
      const apres = etapes[i];
      const saut = Math.min(...niveaux(apres)) - Math.max(...niveaux(avant));
      expect(
        saut,
        `${avant} finit à ${Math.max(...niveaux(avant))} et ${apres} commence à ${Math.min(...niveaux(apres))}`,
      ).toBeLessThanOrEqual(SAUT_MAX);
    }
  });

  it("ne redescend jamais d'une zone entière", () => {
    // Un creux serait aussi gênant qu'un mur : on n'entre pas dans une zone
    // plus faible que le bas de la précédente.
    for (let i = 1; i < etapes.length; i++) {
      const avant = etapes[i - 1];
      const apres = etapes[i];
      expect(
        Math.max(...niveaux(apres)),
        `${apres} est plus faible que ${avant}`,
      ).toBeGreaterThanOrEqual(Math.max(...niveaux(avant)));
    }
  });

  it("place chaque Champion au-dessus de ses propres dresseurs", () => {
    // Un Champion plus faible que ses sbires rend son Arène absurde.
    for (const [id, map] of maps) {
      const champion = map.npcs.find((n) => n.trainer?.badge);
      if (!champion) continue;
      const sien = Math.max(...(champion.trainer!.team ?? []).map((t) => t.level));
      const autres = map.npcs
        .filter((n) => n.trainer && n !== champion)
        .flatMap((n) => (n.trainer!.team ?? []).map((t) => t.level));
      if (!autres.length) continue;
      expect(
        sien,
        `${id} : ${champion.trainer!.name} plafonne à ${sien}, ses dresseurs à ${Math.max(...autres)}`,
      ).toBeGreaterThan(Math.max(...autres));
    }
  });

  it("ne laisse de traînard dans l'équipe de personne", () => {
    // Un Pokémon très en dessous de ses coéquipiers ne se bat pas : il
    // s'écroule, et le dresseur perd tout son sens.
    for (const [id, map] of maps) {
      for (const npc of map.npcs) {
        const equipe = (npc.trainer?.team ?? []).map((t) => t.level);
        if (!equipe.length) continue;
        const faible = Math.min(...equipe);
        const fort = Math.max(...equipe);
        expect(
          faible / fort,
          `${id} : ${npc.trainer!.name} aligne ${equipe.join("/")}`,
        ).toBeGreaterThanOrEqual(ECART_EQUIPE);
      }
    }
  });

  it("donne une équipe à chaque Champion", () => {
    for (const [id, map] of maps) {
      const champion = map.npcs.find((n) => n.trainer?.badge);
      if (!champion) continue;
      expect((champion.trainer!.team ?? []).length, `${id} : équipe vide`).toBeGreaterThan(0);
    }
  });

  it("accorde les hautes herbes aux dresseurs du lieu", () => {
    for (const id of etapes) {
      const sauvages = herbe(id);
      if (!sauvages.length) continue;
      const dres = niveaux(id);
      expect(
        Math.min(...sauvages),
        `${id} : herbe à ${Math.min(...sauvages)}, dresseurs dès ${Math.min(...dres)}`,
      ).toBeGreaterThanOrEqual(Math.min(...dres) - ECART_HERBE);
      expect(
        Math.max(...sauvages),
        `${id} : herbe à ${Math.max(...sauvages)}, dresseurs jusqu'à ${Math.max(...dres)}`,
      ).toBeLessThanOrEqual(Math.max(...dres) + ECART_HERBE);
    }
  });

  it("laisse une montée peuplée avant le Conseil 4", () => {
    // Le Plateau était un couloir vide : c'est là que le mur se formait.
    const plateau = MAPS.ligue;
    expect(plateau.npcs.filter((n) => n.trainer).length).toBeGreaterThanOrEqual(3);
    expect(plateau.encounters?.length ?? 0).toBeGreaterThan(0);
  });
});
