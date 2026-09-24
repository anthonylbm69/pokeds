import { describe, expect, it } from "vitest";
import {
  MOVES,
  SPECIES,
  TYPE_FR,
  species,
  typedMoveset,
  type MoveId,
  type TypeName,
} from "./data";
import { DEX, DEX_MAX, EVOLUTIONS, WILD_POOL } from "./dex";
import { createMon, statOf, maxHp } from "./battle";

const ids = Object.keys(DEX).map(Number);

describe("le Pokédex national", () => {
  it("couvre les cinq premières générations sans trou", () => {
    expect(ids.length).toBe(DEX_MAX);
    for (let id = 1; id <= DEX_MAX; id++) {
      expect(DEX[id], `numéro ${id} manquant`).toBeDefined();
    }
  });

  it("donne à chaque espèce un nom, un genre et des types connus", () => {
    for (const id of ids) {
      const [nom, genre, types, base] = DEX[id];
      expect(nom.length, `${id} sans nom`).toBeGreaterThan(0);
      expect(genre.length, `${id} sans genre`).toBeGreaterThan(0);
      expect(types.length, `${id} sans type`).toBeGreaterThan(0);
      expect(types.length).toBeLessThanOrEqual(2);
      for (const t of types) {
        expect(TYPE_FR[t as TypeName], `${id} : type « ${t} » inconnu`).toBeDefined();
      }
      expect(base.length).toBe(6);
      for (const stat of base) expect(stat).toBeGreaterThan(0);
    }
  });

  it("écarte les légendaires des hautes herbes sans les rayer du Pokédex", () => {
    expect(WILD_POOL.length).toBeLessThan(DEX_MAX);
    expect(WILD_POOL.length).toBeGreaterThan(DEX_MAX - 80);
    // Mewtwo, Rayquaza, Zekrom : présents à la fiche, absents des herbes.
    for (const legendaire of [150, 384, 644]) {
      expect(DEX[legendaire]).toBeDefined();
      expect(WILD_POOL).not.toContain(legendaire);
    }
    expect(WILD_POOL).toContain(25);
  });

  it("ne fait évoluer que vers des espèces qu'il connaît", () => {
    for (const [id, branches] of Object.entries(EVOLUTIONS)) {
      expect(branches.length, `${id} : liste vide`).toBeGreaterThan(0);
      const vues = new Set<number>();
      for (const { into, level, stone, bonheur, moment } of branches) {
        expect(DEX[into], `${id} évolue vers ${into}, hors Pokédex`).toBeDefined();
        expect(into, `${id} évolue vers lui-même`).not.toBe(Number(id));
        expect(vues.has(into), `${id} → ${into} en double`).toBe(false);
        vues.add(into);
        // Exactement un déclencheur par branche.
        const clefs = [level, stone, bonheur].filter((v) => v !== undefined);
        expect(clefs.length, `${id} → ${into} : ${clefs.length} déclencheurs`).toBe(1);
        if (level !== undefined) {
          expect(level).toBeGreaterThan(0);
          expect(level).toBeLessThanOrEqual(100);
        }
        if (moment !== undefined) expect(["jour", "nuit"]).toContain(moment);
      }
    }
  });

  it("s'accorde avec les fiches écrites à la main", () => {
    for (const id of Object.keys(SPECIES).map(Number)) {
      const ecrite = SPECIES[id];
      const releve = DEX[id];
      expect(releve, `${id} détaillé mais absent du Pokédex`).toBeDefined();
      expect(releve[0], `${id} : nom divergent`).toBe(ecrite.name);
      expect(releve[2], `${id} : types divergents`).toEqual(ecrite.types);
      expect(releve[3], `${id} : statistiques divergentes`).toEqual([
        ecrite.base.hp, ecrite.base.atk, ecrite.base.def,
        ecrite.base.spa, ecrite.base.spd, ecrite.base.spe,
      ]);
    }
  });
});

describe("les fiches reconstituées", () => {
  it("répondent pour n'importe quel numéro du Pokédex", () => {
    for (const id of ids) {
      const fiche = species(id);
      expect(fiche.id).toBe(id);
      expect(fiche.name.length).toBeGreaterThan(0);
      expect(fiche.types.length).toBeGreaterThan(0);
      expect(fiche.catchRate).toBeGreaterThan(0);
    }
  });

  it("laissent intactes les espèces écrites à la main", () => {
    expect(species(495)).toBe(SPECIES[495]);
    expect(species(495).entry.length).toBeGreaterThan(0);
    expect(species(495).learnset.length).toBeGreaterThan(0);
  });

  it("rendent toujours le même objet, le chemin étant chaud", () => {
    expect(species(1)).toBe(species(1));
  });
});

describe("les répertoires déduits des types", () => {
  it("arment toute espèce à tout niveau, sans attaque inventée", () => {
    for (const id of ids) {
      const types = species(id).types;
      for (const level of [2, 5, 12, 25, 40, 60, 100]) {
        const moves = typedMoveset(types, level);
        expect(moves.length, `${id} au niveau ${level} : aucune attaque`)
          .toBeGreaterThanOrEqual(2);
        expect(moves.length).toBeLessThanOrEqual(4);
        expect(new Set(moves).size, `${id} : doublon`).toBe(moves.length);
        for (const m of moves) {
          expect(MOVES[m], `${id} : attaque « ${m} » inconnue`).toBeDefined();
        }
      }
    }
  });

  it("donnent au moins une attaque de son propre type", () => {
    for (const id of ids) {
      const types = species(id).types;
      const moves = typedMoveset(types, 50);
      const stab = moves.some((m) => types.includes(MOVES[m].type));
      expect(stab, `${species(id).name} n'a rien à son type`).toBe(true);
    }
  });

  it("montent en puissance avec le niveau", () => {
    const force = (level: number) =>
      typedMoveset(["fire"], level).reduce((max, m) => Math.max(max, MOVES[m].power), 0);
    expect(force(3)).toBeLessThan(force(20));
    expect(force(20)).toBeLessThanOrEqual(force(60));

    // La plus forte attaque du type, quelle qu'elle soit : elle revient à
    // haut niveau et jamais au troisième. On ne la nomme pas — le catalogue
    // grandit, et un test ne doit pas figer son sommet.
    const sommet = (Object.keys(MOVES) as MoveId[])
      .filter((m) => MOVES[m].type === "fire")
      .reduce((a, b) => (MOVES[a].power >= MOVES[b].power ? a : b));
    expect(typedMoveset(["fire"], 3)).not.toContain(sommet);
    expect(force(60)).toBe(MOVES[sommet].power);
  });
});

describe("les créatures nées du Pokédex", () => {
  it("se fabriquent et se battent comme les autres", () => {
    for (const id of [1, 25, 133, 448, 570]) {
      const mon = createMon(id, 20);
      expect(mon.name).toBe(DEX[id][0]);
      expect(mon.moves.length).toBeGreaterThanOrEqual(2);
      expect(mon.hp).toBe(maxHp(mon));
      expect(statOf(mon, "atk")).toBeGreaterThan(0);
    }
  });

  it("tirent leurs statistiques du relevé officiel", () => {
    // Pikachu : 90 de Vitesse de base, la plus haute de ses statistiques.
    const pikachu = species(25);
    expect(pikachu.base.spe).toBe(90);
    expect(pikachu.name).toBe("Pikachu");
    expect(pikachu.types).toEqual(["electric"]);
  });
});

describe("le catalogue d'attaques", () => {
  const ids = Object.keys(MOVES) as MoveId[];
  const types = Object.keys(TYPE_FR) as TypeName[];
  const offensives = (t: TypeName) =>
    ids.filter((id) => MOVES[id].type === t && MOVES[id].category !== "statut");

  it("donne à chaque type de quoi frapper à plusieurs paliers", () => {
    // Le répertoire d'une espèce reconstituée se déduit de ses types : avec
    // deux attaques dans un type, tous ses Pokémon connaissaient la même
    // chose à tous les niveaux.
    for (const t of types) {
      expect(offensives(t).length, `${TYPE_FR[t]} : trop peu d'attaques`).toBeGreaterThanOrEqual(4);
    }
  });

  it("étale ces paliers, au lieu de les empiler au même endroit", () => {
    for (const t of types) {
      const forces = offensives(t).map((id) => MOVES[id].power);
      const ecart = Math.max(...forces) - Math.min(...forces);
      expect(ecart, `${TYPE_FR[t]} : paliers trop serrés`).toBeGreaterThanOrEqual(40);
    }
  });

  it("fait monter le répertoire déduit avec le niveau, pour tous les types", () => {
    for (const t of types) {
      const force = (level: number) =>
        typedMoveset([t], level).reduce((max, m) => Math.max(max, MOVES[m].power), 0);
      expect(force(5), `${TYPE_FR[t]}`).toBeLessThan(force(60));
    }
  });

  it("ne laisse aucune attaque sans nom, ni deux au même nom", () => {
    const noms = ids.map((id) => MOVES[id].name);
    for (const nom of noms) expect(nom.length).toBeGreaterThan(0);
    expect(new Set(noms).size, "deux attaques portent le même nom").toBe(noms.length);
  });

  it("garde des chiffres plausibles", () => {
    for (const id of ids) {
      const mv = MOVES[id];
      expect(mv.accuracy, `${mv.name}`).toBeGreaterThan(0);
      expect(mv.accuracy, `${mv.name}`).toBeLessThanOrEqual(100);
      expect(mv.pp, `${mv.name}`).toBeGreaterThan(0);
      if (mv.category === "statut") expect(mv.power, `${mv.name}`).toBe(0);
      else expect(mv.power, `${mv.name}`).toBeGreaterThan(0);
      // Une attaque qui frappe fort se paie : peu de PP, ou peu de précision.
      if (mv.power >= 110) expect(mv.pp, `${mv.name}`).toBeLessThanOrEqual(15);
    }
  });

  it("ne rend jamais un répertoire vide, quel que soit le type ou le niveau", () => {
    for (const t of types) {
      for (const level of [1, 5, 20, 50, 100]) {
        const rep = typedMoveset([t], level);
        expect(rep.length, `${TYPE_FR[t]} N.${level}`).toBeGreaterThanOrEqual(2);
        expect(rep.length).toBeLessThanOrEqual(4);
        expect(new Set(rep).size, `${TYPE_FR[t]} N.${level} : doublon`).toBe(rep.length);
      }
    }
  });
});
