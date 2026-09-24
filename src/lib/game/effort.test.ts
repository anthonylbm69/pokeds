import { describe, expect, it } from "vitest";
import { DEX, EFFORT } from "./dex";
import {
  EV_MAX_STAT,
  EV_MAX_TOTAL,
  STAT_FR,
  addEvs,
  computeStat,
  effortOf,
  evTotal,
  noEvs,
  type Evs,
  type StatKey,
} from "./data";
import { createMon, maxHp, playerMove, startWild, statOf } from "./battle";
import {
  ITEMS,
  SHOP_STOCK,
  VITAMINES,
  VITAMINE_EV,
  emptyBag,
  isVitamine,
  type Bag,
  type ItemId,
} from "./items";
import {
  applyVitamine,
  giveStarter,
  newGame,
  reviveGame,
  vitamineEffectOn,
  type GameState,
} from "./state";

const CLEFS = Object.keys(STAT_FR) as StatKey[];

describe("ce que rapporte chaque espèce", () => {
  it("couvre tout le Pokédex", () => {
    for (const id of Object.keys(DEX).map(Number)) {
      expect(EFFORT[id], `${id} sans effort`).toBeDefined();
      expect(EFFORT[id]).toHaveLength(6);
    }
  });

  it("reste dans les clous : un à trois points, jamais plus", () => {
    for (const [id, valeurs] of Object.entries(EFFORT)) {
      const somme = valeurs.reduce((a, b) => a + b, 0);
      expect(somme, `${id} rapporte ${somme}`).toBeGreaterThan(0);
      expect(somme, `${id} rapporte ${somme}`).toBeLessThanOrEqual(3);
      for (const v of valeurs) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("se lit statistique par statistique", () => {
    const rendement = effortOf(1);
    expect(CLEFS.every((k) => typeof rendement[k] === "number")).toBe(true);
    expect(evTotal(rendement)).toBe(EFFORT[1].reduce((a, b) => a + b, 0));
  });

  it("rend zéro partout pour une espèce inconnue", () => {
    expect(evTotal(effortOf(99999))).toBe(0);
  });
});

describe("l'accumulation", () => {
  it("part de zéro", () => {
    expect(evTotal(noEvs())).toBe(0);
    expect(evTotal(undefined)).toBe(0);
  });

  it("ajoute ce qu'on lui donne", () => {
    const evs = addEvs(noEvs(), { atk: 3, spe: 1 });
    expect(evs.atk).toBe(3);
    expect(evs.spe).toBe(1);
    expect(evTotal(evs)).toBe(4);
  });

  it("s'arrête à deux cent cinquante-deux dans une seule statistique", () => {
    let evs: Evs = noEvs();
    for (let i = 0; i < 200; i++) evs = addEvs(evs, { atk: 3 });
    expect(evs.atk).toBe(EV_MAX_STAT);
  });

  it("s'arrête à cinq cent dix en tout", () => {
    let evs: Evs = noEvs();
    for (const clef of CLEFS) {
      for (let i = 0; i < 120; i++) evs = addEvs(evs, { [clef]: 3 });
    }
    expect(evTotal(evs)).toBe(EV_MAX_TOTAL);
  });

  it("ne perd rien en route tant qu'il reste de la place", () => {
    let evs: Evs = noEvs();
    for (let i = 0; i < 50; i++) evs = addEvs(evs, { def: 2 });
    expect(evs.def).toBe(100);
  });

  it("laisse le tableau d'origine intact", () => {
    const avant = noEvs();
    addEvs(avant, { atk: 10 });
    expect(avant.atk).toBe(0);
  });

  it("complète un tableau incomplet venu d'ailleurs", () => {
    const evs = addEvs({ atk: 4 } as Evs, { def: 2 });
    expect(evs.atk).toBe(4);
    expect(evs.def).toBe(2);
    expect(evs.hp).toBe(0);
  });
});

describe("la formule", () => {
  it("ne change rien quand l'effort est nul", () => {
    // Les valeurs d'avant les EV, inchangées : une vieille partie ne bouge pas.
    expect(computeStat(45, 15, 5, true)).toBe(20);
    expect(computeStat(45, 15, 5, false)).toBe(10);
    expect(computeStat(45, 15, 5, true, 0)).toBe(20);
  });

  it("compte quatre points d'effort pour un point de statistique au niveau cent", () => {
    const sans = computeStat(100, 31, 100, false, 0);
    expect(computeStat(100, 31, 100, false, 4)).toBe(sans + 1);
    expect(computeStat(100, 31, 100, false, 252)).toBe(sans + 63);
  });

  it("ignore les miettes : trois points ne valent rien", () => {
    const sans = computeStat(100, 31, 100, false, 0);
    expect(computeStat(100, 31, 100, false, 3)).toBe(sans);
  });

  it("pèse moins à bas niveau", () => {
    const gain = (level: number) =>
      computeStat(100, 31, level, false, 252) - computeStat(100, 31, level, false, 0);
    expect(gain(100)).toBeGreaterThan(gain(50));
    expect(gain(50)).toBeGreaterThan(gain(10));
  });

  it("se répercute sur les statistiques d'un Pokémon", () => {
    const brut = createMon(495, 100, false);
    const entraine = { ...brut, evs: addEvs(noEvs(), { atk: 252, hp: 252 }) };
    expect(statOf(entraine, "atk")).toBeGreaterThan(statOf(brut, "atk"));
    expect(maxHp(entraine)).toBeGreaterThan(maxHp(brut));
    // Ce qui n'a pas été travaillé ne bouge pas.
    expect(statOf(entraine, "spe")).toBe(statOf(brut, "spe"));
  });

  it("supporte un Pokémon sans tableau d'effort", () => {
    const vieux = createMon(495, 50, false) as unknown as Record<string, unknown>;
    delete vieux.evs;
    expect(() => maxHp(vieux as never)).not.toThrow();
    expect(maxHp(vieux as never)).toBeGreaterThan(0);
  });
});

describe("l'effort gagné en combat", () => {
  it("revient à celui qui s'est battu", () => {
    const mine = createMon(495, 50, false);
    const foe = createMon(504, 5, false);
    foe.hp = 1;
    let etat = startWild([mine], foe, emptyBag());
    for (let i = 0; i < 20 && etat.foe.hp > 0; i++) {
      etat = playerMove(etat, 0).state;
    }
    expect(etat.foe.hp, "l'adversaire tient encore").toBe(0);
    expect(evTotal(etat.party[0].evs)).toBe(evTotal(effortOf(504)));
  });

  it("ne se partage pas avec le reste de l'équipe", () => {
    const mine = createMon(495, 50, false);
    const banc = createMon(498, 50, false);
    const foe = createMon(504, 5, false);
    foe.hp = 1;
    let etat = startWild([mine, banc], foe, emptyBag());
    for (let i = 0; i < 20 && etat.foe.hp > 0; i++) {
      etat = playerMove(etat, 0).state;
    }
    expect(evTotal(etat.party[0].evs)).toBeGreaterThan(0);
    expect(evTotal(etat.party[1].evs), "le banc s'est entraîné tout seul").toBe(0);
  });

  it("rapporte ce que l'espèce vaincue vaut, et rien d'autre", () => {
    const mine = createMon(495, 60, false);
    const foe = createMon(504, 5, false);
    foe.hp = 1;
    let etat = startWild([mine], foe, emptyBag());
    for (let i = 0; i < 20 && etat.foe.hp > 0; i++) {
      etat = playerMove(etat, 0).state;
    }
    const attendu = effortOf(504);
    for (const clef of CLEFS) {
      expect(etat.party[0].evs[clef], `${clef}`).toBe(attendu[clef]);
    }
  });
});

describe("les vitamines", () => {
  const partie = (item: ItemId, combien = 1): GameState => {
    const base = giveStarter(newGame("Anthony"), 495);
    return { ...base, bag: { ...base.bag, [item]: combien } as Bag };
  };

  it("existent pour chaque statistique, sans doublon", () => {
    const stats = Object.values(VITAMINES).map((v) => v.stat);
    expect(new Set(stats).size).toBe(stats.length);
    expect([...stats].sort()).toEqual([...CLEFS].sort());
  });

  it("se vendent toutes au rayon", () => {
    for (const id of Object.keys(VITAMINES) as ItemId[]) {
      expect(isVitamine(id), `${id}`).toBe(true);
      expect(SHOP_STOCK, `${id}`).toContain(id);
      expect(ITEMS[id].price).toBeGreaterThan(0);
    }
    expect(isVitamine("potion")).toBe(false);
  });

  it("poussent la bonne statistique et se consomment", () => {
    const avant = partie("proteine");
    const { state, message } = applyVitamine(avant, "proteine", 0);
    expect(state.party[0].evs.atk).toBe(VITAMINE_EV);
    expect(state.bag.proteine).toBe(0);
    expect(message).toContain(STAT_FR.atk);
  });

  it("respectent le plafond d'une statistique", () => {
    const base = partie("proteine", 5);
    const jeu: GameState = {
      ...base,
      party: [{ ...base.party[0], evs: addEvs(noEvs(), { atk: EV_MAX_STAT }) }],
    };
    const { state, message } = applyVitamine(jeu, "proteine", 0);
    expect(state).toBe(jeu);
    expect(message).toContain("ne progressera plus");
  });

  it("respectent le plafond total", () => {
    const base = partie("proteine", 5);
    const plein = addEvs(noEvs(), { hp: 252, def: 252, spe: 6 });
    const jeu: GameState = { ...base, party: [{ ...base.party[0], evs: plein }] };
    expect(evTotal(plein)).toBe(EV_MAX_TOTAL);
    const { state, message } = applyVitamine(jeu, "proteine", 0);
    expect(state).toBe(jeu);
    expect(message).toContain("fini sa croissance");
  });

  it("refusent sans rien dépenser quand le sac est vide", () => {
    const avant = partie("fer", 0);
    const { state, message } = applyVitamine(avant, "fer", 0);
    expect(state).toBe(avant);
    expect(message).toContain("Vous n'avez plus");
  });

  it("se disent en clair avant d'être bues", () => {
    const mon = createMon(495, 20, false);
    expect(vitamineEffectOn("carbone", mon)).toEqual({ stat: "spe", refus: null });
    expect(vitamineEffectOn("potion", mon).refus).toContain("pas une vitamine");
    expect(vitamineEffectOn("carbone", undefined).refus).toContain("Aucun Pokémon");
  });
});

describe("l'effort dans la sauvegarde", () => {
  it("repart à zéro pour une partie d'avant", () => {
    const brut = JSON.parse(
      JSON.stringify(giveStarter(newGame("Anthony"), 495)),
    ) as Record<string, unknown>;
    const party = brut.party as Record<string, unknown>[];
    delete party[0].evs;
    expect(evTotal(reviveGame(brut)!.party[0].evs)).toBe(0);
  });

  it("garde celui d'une partie récente", () => {
    const jeu = giveStarter(newGame("Anthony"), 495);
    jeu.party[0].evs = addEvs(noEvs(), { atk: 44, spe: 12 });
    const relu = reviveGame(JSON.parse(JSON.stringify(jeu)))!;
    expect(relu.party[0].evs.atk).toBe(44);
    expect(relu.party[0].evs.spe).toBe(12);
  });

  it("complète un tableau d'effort tronqué", () => {
    const jeu = giveStarter(newGame("Anthony"), 495);
    const brut = JSON.parse(JSON.stringify(jeu)) as Record<string, unknown>;
    (brut.party as Record<string, unknown>[])[0].evs = { atk: 8 };
    const relu = reviveGame(brut)!;
    expect(relu.party[0].evs.atk).toBe(8);
    expect(relu.party[0].evs.hp).toBe(0);
  });
});
