import { describe, expect, it } from "vitest";
import { EVOLUTIONS } from "./dex";
import { MOVES, species } from "./data";
import { createMon, maxHp, type Mon } from "./battle";
import {
  DAYCARE_MAX,
  EGG_STEPS,
  HATCH_STEPS,
  baseForm,
  canBreed,
  eggHint,
  eggSpecies,
  emptyDaycare,
  hatch,
  makeEgg,
  walkDaycare,
  walkEggs,
  type Daycare,
  type Egg,
} from "./elevage";

/** Un pensionnaire prêt à l'emploi, avec un répertoire choisi. */
const parent = (id: number, level = 20, moves?: string[]): Mon => {
  const mon = createMon(id, level, undefined);
  if (moves) {
    mon.moves = moves.map((m) => ({
      id: m as Mon["moves"][number]["id"],
      pp: MOVES[m as Mon["moves"][number]["id"]].pp,
      max: MOVES[m as Mon["moves"][number]["id"]].pp,
    }));
  }
  return mon;
};

const pension = (mons: Mon[], over: Partial<Daycare> = {}): Daycare => ({
  ...emptyDaycare(),
  mons,
  ...over,
});

describe("la forme de base", () => {
  it("remonte une chaîne d'évolution jusqu'à son départ", () => {
    // Une chaîne réelle du dex : on prend une espèce qui a un parent connu.
    const [depuis, [, vers]] = Object.entries(EVOLUTIONS)[0];
    expect(baseForm(vers)).toBe(baseForm(Number(depuis)));
  });

  it("laisse tranquille une espèce sans parent", () => {
    // Le premier du dex n'évolue de personne.
    expect(baseForm(1)).toBe(1);
  });

  it("ne renvoie jamais une espèce inconnue", () => {
    for (const id of [1, 25, 133, 448, 495, 649]) {
      expect(species(baseForm(id))).toBeDefined();
    }
  });

  it("s'arrête même si les données bouclaient", () => {
    // La borne interne suffit : l'appel rend la main sur n'importe quel dex.
    expect(() => baseForm(649)).not.toThrow();
  });
});

describe("le couple de la Pension", () => {
  it("refuse un pensionnaire seul", () => {
    expect(canBreed([])).toBe(false);
    expect(canBreed([parent(495)])).toBe(false);
  });

  it("accepte deux créatures distinctes", () => {
    expect(canBreed([parent(495), parent(498)])).toBe(true);
  });

  it("accepte aussi deux fois la même espèce", () => {
    const a = parent(495);
    const b = parent(495);
    expect(a.uid).not.toBe(b.uid);
    expect(canBreed([a, b])).toBe(true);
  });

  it("refuse le même Pokémon dédoublé", () => {
    const a = parent(495);
    expect(canBreed([a, { ...a }])).toBe(false);
  });

  it("ne garde que deux pensionnaires", () => {
    expect(DAYCARE_MAX).toBe(2);
  });
});

describe("l'œuf préparé", () => {
  it("n'existe pas sans couple", () => {
    expect(makeEgg([parent(495)])).toBeNull();
  });

  it("prend l'espèce du premier parent, ramenée à sa forme de base", () => {
    const [depuis, [, evolue]] = Object.entries(EVOLUTIONS)[0];
    const oeuf = makeEgg([parent(evolue, 40), parent(495)])!;
    expect(oeuf.id).toBe(baseForm(Number(depuis)));
  });

  it("hérite de la nature du premier parent sur un tirage bas", () => {
    const a = parent(495);
    const b = parent(498);
    a.nature = 3;
    b.nature = 17;
    expect(makeEgg([a, b], 0.1)!.nature).toBe(3);
    expect(makeEgg([a, b], 0.9)!.nature).toBe(17);
  });

  it("ne transmet que les attaques communes aux deux parents", () => {
    const a = parent(495, 20, ["charge", "vive-attaque", "morsure"]);
    const b = parent(498, 20, ["charge", "morsure", "flammeche"]);
    expect(makeEgg([a, b])!.moves).toEqual(["charge", "morsure"]);
  });

  it("ne transmet rien quand les parents n'ont rien en commun", () => {
    const a = parent(495, 20, ["vive-attaque"]);
    const b = parent(498, 20, ["flammeche"]);
    expect(makeEgg([a, b])!.moves).toEqual([]);
  });

  it("part avec le compteur d'éclosion au complet", () => {
    expect(makeEgg([parent(495), parent(498)])!.steps).toBe(HATCH_STEPS);
  });
});

describe("la marche", () => {
  it("laisse la Pension tranquille tant qu'il n'y a pas de couple", () => {
    const seul = pension([parent(495)]);
    expect(walkDaycare(seul)).toBe(seul);
  });

  it("compte les pas d'un couple", () => {
    const care = walkDaycare(pension([parent(495), parent(498)]));
    expect(care.steps).toBe(1);
    expect(care.ready).toBeNull();
  });

  it("pose un œuf une fois le compte atteint", () => {
    let care = pension([parent(495), parent(498)], { steps: EGG_STEPS - 1 });
    care = walkDaycare(care);
    expect(care.ready).not.toBeNull();
    expect(care.steps).toBe(0);
  });

  it("ne prépare pas un second œuf tant que le premier est là", () => {
    const care = pension([parent(495), parent(498)], {
      steps: EGG_STEPS - 1,
      ready: makeEgg([parent(495), parent(498)]),
    });
    expect(walkDaycare(care)).toBe(care);
  });

  it("rapproche chaque œuf porté de son éclosion", () => {
    const oeufs: Egg[] = [
      { id: 495, nature: 0, moves: [], steps: 5 },
      { id: 498, nature: 0, moves: [], steps: 1 },
    ];
    const apres = walkEggs(oeufs);
    expect(apres.map((e) => e.steps)).toEqual([4, 0]);
  });

  it("ne descend jamais sous zéro", () => {
    expect(walkEggs([{ id: 495, nature: 0, moves: [], steps: 0 }])[0].steps).toBe(0);
  });

  it("ne modifie pas les œufs d'origine", () => {
    const oeufs: Egg[] = [{ id: 495, nature: 0, moves: [], steps: 5 }];
    walkEggs(oeufs);
    expect(oeufs[0].steps).toBe(5);
  });
});

describe("l'éclosion", () => {
  const oeuf = (over: Partial<Egg> = {}): Egg => ({
    id: 495,
    nature: 7,
    moves: [],
    steps: 0,
    ...over,
  });

  it("rend un Pokémon de niveau un", () => {
    expect(hatch(oeuf()).level).toBe(1);
  });

  it("garde l'espèce et la nature de l'œuf", () => {
    const petit = hatch(oeuf({ id: 498, nature: 12 }));
    expect(petit.id).toBe(498);
    expect(petit.nature).toBe(12);
  });

  it("place les attaques héritées devant celles du niveau un", () => {
    const petit = hatch(oeuf({ moves: ["morsure"] }));
    expect(petit.moves[0].id).toBe("morsure");
    expect(petit.moves[0].pp).toBe(MOVES.morsure.pp);
  });

  it("ne dépasse jamais quatre attaques", () => {
    const petit = hatch(
      oeuf({ moves: ["morsure", "vive-attaque", "flammeche", "charge"] }),
    );
    expect(petit.moves.length).toBeLessThanOrEqual(4);
  });

  it("ne double pas une attaque déjà connue au niveau un", () => {
    const nu = hatch(oeuf());
    const deja = nu.moves[0].id;
    const petit = hatch(oeuf({ moves: [deja] }));
    const compte = petit.moves.filter((m) => m.id === deja).length;
    expect(compte).toBe(1);
  });

  it("arrive en pleine forme", () => {
    const petit = hatch(oeuf());
    expect(petit.hp).toBe(maxHp(petit));
    expect(petit.hp).toBeGreaterThan(0);
    expect(petit.status).toBeFalsy();
  });
});

describe("ce que l'on dit de l'œuf", () => {
  const oeuf = (steps: number): Egg => ({ id: 495, nature: 0, moves: [], steps });

  it("va du calme à l'agitation", () => {
    expect(eggHint(oeuf(HATCH_STEPS))).toBe("rien ne bouge encore");
    expect(eggHint(oeuf(Math.floor(HATCH_STEPS / 2) - 1))).toBe("il bouge un peu");
    expect(eggHint(oeuf(Math.floor(HATCH_STEPS / 4) - 1))).toBe("il remue beaucoup");
    expect(eggHint(oeuf(0))).toBe("il bouge !");
  });

  it("garde l'espèce pour lui, mais sait la nommer", () => {
    expect(eggSpecies(oeuf(10))).toBe(species(495).name);
  });
});
