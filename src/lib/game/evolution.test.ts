import { describe, expect, it } from "vitest";
import { EVOLUTIONS } from "./dex";
import {
  BONHEUR_DEPART,
  BONHEUR_KO,
  BONHEUR_MAX,
  BONHEUR_NIVEAU,
  BONHEUR_SOIN,
  SPECIES,
  evolutionByStone,
  evolutionOnLevel,
  evolutionsOf,
  expForLevel,
  species,
} from "./data";
import {
  createMon,
  evolve,
  healMon,
  maxHp,
  playerMove,
  startWild,
  type Mon,
} from "./battle";
import { ITEMS, STONES, emptyBag, isStone, type Bag, type ItemId } from "./items";
import {
  applyStone,
  giveStarter,
  newGame,
  reviveGame,
  stoneEffectOn,
  type GameState,
} from "./state";

/** Évoli : la lignée qui bifurque le plus, et le meilleur banc d'essai. */
const EVOLI = 133;
const AQUALI = 134;
const MENTALI = 196;
const NOCTALI = 197;

describe("les branches du Pokédex", () => {
  it("rendent à Évoli ses sept formes", () => {
    const branches = evolutionsOf(EVOLI);
    expect(branches).toHaveLength(7);
    const cibles = branches.map((b) => b.into);
    for (const id of [AQUALI, 135, 136, MENTALI, NOCTALI, 470, 471]) {
      expect(cibles, `${id} manquant`).toContain(id);
    }
  });

  it("ne laissent jamais Évoli changer tout seul", () => {
    // Aucune branche d'Évoli ne tient à un simple niveau : sinon elle
    // partirait d'elle-même avant toute pierre.
    for (const branche of evolutionsOf(EVOLI)) {
      expect(branche.level, JSON.stringify(branche)).toBeUndefined();
    }
  });

  it("distinguent Mentali le jour de Noctali la nuit", () => {
    const jour = evolutionsOf(EVOLI).find((b) => b.into === MENTALI);
    const nuit = evolutionsOf(EVOLI).find((b) => b.into === NOCTALI);
    expect(jour?.moment).toBe("jour");
    expect(nuit?.moment).toBe("nuit");
    expect(jour?.bonheur).toBeGreaterThan(0);
  });

  it("ne nomment que des pierres que la boutique tient", () => {
    for (const branches of Object.values(EVOLUTIONS)) {
      for (const { stone } of branches) {
        if (!stone) continue;
        expect(STONES, `${stone} inconnue au rayon`).toContain(stone);
        expect(isStone(stone as ItemId)).toBe(true);
      }
    }
  });

  it("emploient chaque pierre du rayon au moins une fois", () => {
    const employees = new Set(
      Object.values(EVOLUTIONS).flatMap((b) => b.map((x) => x.stone)),
    );
    for (const pierre of STONES) {
      expect(employees, `${pierre} ne sert à rien`).toContain(pierre);
    }
  });

  it("rendent la liste vide pour une espèce qui ne change plus", () => {
    // Mentali est une fin de lignée.
    expect(evolutionsOf(MENTALI)).toEqual([]);
  });
});

describe("ce qu'une montée de niveau déclenche", () => {
  it("fait passer au niveau prévu, et pas avant", () => {
    // Vipélierre évolue à 17.
    expect(evolutionOnLevel(495, 16, BONHEUR_DEPART, "jour")).toBeNull();
    expect(evolutionOnLevel(495, 17, BONHEUR_DEPART, "jour")?.into).toBe(496);
  });

  it("ignore les branches qui tiennent à une pierre", () => {
    // Évoli au niveau cent, bonheur au plancher : rien ne bouge.
    expect(evolutionOnLevel(EVOLI, 100, 0, "jour")).toBeNull();
  });

  it("attend le bonheur exigé", () => {
    expect(evolutionOnLevel(EVOLI, 30, 10, "jour")).toBeNull();
    expect(evolutionOnLevel(EVOLI, 30, BONHEUR_MAX, "jour")?.into).toBe(MENTALI);
  });

  it("donne Mentali le jour et Noctali la nuit", () => {
    expect(evolutionOnLevel(EVOLI, 30, BONHEUR_MAX, "jour")?.into).toBe(MENTALI);
    expect(evolutionOnLevel(EVOLI, 30, BONHEUR_MAX, "nuit")?.into).toBe(NOCTALI);
  });

  it("compte le crépuscule comme la nuit", () => {
    // Les jeux d'origine ne connaissent que le jour et la nuit.
    expect(evolutionOnLevel(EVOLI, 30, BONHEUR_MAX, "soir")?.into).toBe(NOCTALI);
  });
});

describe("ce qu'une pierre ouvre", () => {
  it("trouve la forme qu'elle vise", () => {
    expect(evolutionByStone(EVOLI, "pierre-eau")?.into).toBe(AQUALI);
    expect(evolutionByStone(EVOLI, "pierre-feu")?.into).toBe(136);
  });

  it("ne rend rien pour une pierre étrangère à la lignée", () => {
    expect(evolutionByStone(EVOLI, "pierre-aurore")).toBeNull();
    expect(evolutionByStone(495, "pierre-eau")).toBeNull();
  });

  it("se dit en clair avant d'être employée", () => {
    const evoli = createMon(EVOLI, 25, false);
    expect(stoneEffectOn("pierre-eau", evoli)).toEqual({ into: AQUALI, refus: null });

    const rate = stoneEffectOn("pierre-aurore", evoli);
    expect(rate.into).toBeNull();
    expect(rate.refus).toContain("aucun effet");
  });

  it("refuse poliment ce qui n'est pas une pierre", () => {
    const evoli = createMon(EVOLI, 25, false);
    expect(stoneEffectOn("potion", evoli).refus).toContain("pas une pierre");
    expect(stoneEffectOn("pierre-eau", undefined).refus).toContain("Aucun Pokémon");
  });
});

describe("le passage à la forme suivante", () => {
  it("change d'espèce et de nom", () => {
    const mon = createMon(EVOLI, 25, false);
    const dits = evolve(mon, AQUALI);
    expect(mon.id).toBe(AQUALI);
    expect(mon.name).toBe(species(AQUALI).name);
    expect(dits.join(" ")).toContain(species(AQUALI).name);
  });

  it("garde le surnom qu'on lui avait donné", () => {
    const mon = createMon(EVOLI, 25, false);
    mon.name = "Bouboule";
    evolve(mon, AQUALI);
    expect(mon.name).toBe("Bouboule");
    expect(mon.id).toBe(AQUALI);
  });

  it("laisse les PV gagnés au passage", () => {
    const mon = createMon(EVOLI, 25, false);
    const avant = maxHp(mon);
    mon.hp = avant;
    evolve(mon, AQUALI);
    // La forme évoluée est plus robuste : les PV suivent, sans dépasser.
    expect(maxHp(mon)).toBeGreaterThan(avant);
    expect(mon.hp).toBe(maxHp(mon));
  });

  it("n'invente pas de PV à un Pokémon blessé", () => {
    const mon = createMon(EVOLI, 25, false);
    const avant = maxHp(mon);
    mon.hp = 3;
    evolve(mon, AQUALI);
    expect(mon.hp).toBe(3 + (maxHp(mon) - avant));
    expect(mon.hp).toBeLessThan(maxHp(mon));
  });
});

describe("la pierre employée depuis le sac", () => {
  const partie = (pierre: ItemId, combien = 1): GameState => {
    const base = giveStarter(newGame("Anthony"), 495);
    return {
      ...base,
      bag: { ...base.bag, [pierre]: combien } as Bag,
      party: [createMon(EVOLI, 25, false)],
    };
  };

  it("fait changer de forme et se consomme", () => {
    const avant = partie("pierre-eau");
    const { state, messages } = applyStone(avant, "pierre-eau", 0);
    expect(state.party[0].id).toBe(AQUALI);
    expect(state.bag["pierre-eau"]).toBe(0);
    expect(messages.join(" ")).toContain("évolue");
  });

  it("inscrit la nouvelle forme au Pokédex", () => {
    const { state } = applyStone(partie("pierre-foudre"), "pierre-foudre", 0);
    expect(state.seen).toContain(135);
    expect(state.caught).toContain(135);
  });

  it("ne touche à rien quand la pierre n'a pas d'effet", () => {
    const avant = partie("pierre-aurore");
    const { state, messages } = applyStone(avant, "pierre-aurore", 0);
    expect(state).toBe(avant);
    expect(state.bag["pierre-aurore"]).toBe(1);
    expect(messages[0]).toContain("aucun effet");
  });

  it("refuse sans rien dépenser quand le sac est vide", () => {
    const avant = partie("pierre-eau", 0);
    const { state, messages } = applyStone(avant, "pierre-eau", 0);
    expect(state).toBe(avant);
    expect(messages[0]).toContain("Vous n'avez plus");
  });

  it("ne modifie pas le Pokémon d'origine", () => {
    const avant = partie("pierre-eau");
    const original = avant.party[0];
    applyStone(avant, "pierre-eau", 0);
    expect(original.id).toBe(EVOLI);
  });

  it("se vend au rayon, comme tout le reste", () => {
    for (const pierre of STONES) {
      expect(ITEMS[pierre].price).toBeGreaterThan(0);
      expect(ITEMS[pierre].name).toContain("Pierre");
    }
  });
});

describe("le bonheur", () => {
  it("part à mi-chemin", () => {
    expect(createMon(495, 5, false).bonheur).toBe(BONHEUR_DEPART);
    expect(BONHEUR_DEPART).toBeGreaterThan(0);
    expect(BONHEUR_DEPART).toBeLessThan(BONHEUR_MAX);
  });

  it("monte au passage du Centre, sans dépasser le maximum", () => {
    const mon = createMon(495, 5, false);
    expect(healMon(mon).bonheur).toBe(BONHEUR_DEPART + BONHEUR_SOIN);

    const comble = { ...mon, bonheur: BONHEUR_MAX };
    expect(healMon(comble).bonheur).toBe(BONHEUR_MAX);
  });

  it("monte en gagnant un niveau", () => {
    const mine = createMon(504, 5, false);
    // À un point du niveau suivant : le moindre adversaire le fera passer.
    mine.exp = expForLevel(6) - 1;
    mine.bonheur = 40;
    const foe = createMon(506, 3, false);
    foe.hp = 1;
    // Une capture ne rapporte rien ici, comme en Génération V : il faut
    // abattre l'adversaire pour toucher l'expérience.
    const { state: apres } = playerMove(startWild([mine], foe, emptyBag()), 0);
    const monte = apres.party[0];
    expect(monte.level, "le niveau aurait dû monter").toBeGreaterThan(5);
    expect(monte.bonheur).toBe(40 + BONHEUR_NIVEAU * (monte.level - 5));
  });

  it("plafonne, même après bien des niveaux", () => {
    const mine = createMon(504, 5, false);
    mine.exp = expForLevel(6) - 1;
    mine.bonheur = BONHEUR_MAX;
    const foe = createMon(506, 3, false);
    foe.hp = 1;
    const { state: apres } = playerMove(startWild([mine], foe, emptyBag()), 0);
    expect(apres.party[0].level).toBeGreaterThan(5);
    expect(apres.party[0].bonheur).toBe(BONHEUR_MAX);
  });

  /**
   * Joue jusqu'à ce que le Pokémon du joueur tombe : un coup peut rater, et
   * un seul tour ne suffit pas toujours.
   */
  const jusquAuKo = (mine: Mon) => {
    mine.hp = 1;
    const foe = createMon(506, 80, false);
    let etat = startWild([mine], foe, emptyBag());
    for (let i = 0; i < 20 && etat.party[0].hp > 0; i++) {
      etat = playerMove(etat, 0).state;
    }
    expect(etat.party[0].hp, "le Pokémon n'est jamais tombé").toBe(0);
    return etat.party[0];
  };

  it("retombe quand la créature tombe pour de bon", () => {
    const mine = createMon(495, 5, false);
    mine.bonheur = 200;
    expect(jusquAuKo(mine).bonheur).toBe(200 - BONHEUR_KO);
  });

  it("ne descend jamais sous zéro", () => {
    const mine = createMon(495, 5, false);
    mine.bonheur = 2;
    expect(jusquAuKo(mine).bonheur).toBe(0);
  });

  it("laisse l'adversaire tranquille : seul le vôtre y perd", () => {
    const mine = createMon(506, 80, false);
    const foe = createMon(495, 5, false);
    foe.bonheur = 200;
    foe.hp = 1;
    let etat = startWild([mine], foe, emptyBag());
    for (let i = 0; i < 20 && etat.foe.hp > 0; i++) {
      etat = playerMove(etat, 0).state;
    }
    expect(etat.foe.hp, "l'adversaire tient encore").toBe(0);
    expect(etat.foe.bonheur).toBe(200);
  });

  it("revient à sa valeur de départ pour une partie d'avant", () => {
    const brut = JSON.parse(
      JSON.stringify(giveStarter(newGame("Anthony"), 495)),
    ) as Record<string, unknown>;
    const party = brut.party as Record<string, unknown>[];
    delete party[0].bonheur;
    expect(reviveGame(brut)!.party[0].bonheur).toBe(BONHEUR_DEPART);
  });

  it("garde celui qu'une partie récente avait", () => {
    const jeu = giveStarter(newGame("Anthony"), 495);
    jeu.party[0].bonheur = 211;
    const relu = reviveGame(JSON.parse(JSON.stringify(jeu)))!;
    expect(relu.party[0].bonheur).toBe(211);
  });
});

describe("les fiches écrites à la main", () => {
  it("emploient toutes la nouvelle forme", () => {
    for (const forme of Object.values(SPECIES)) {
      for (const branche of forme.evolutions ?? []) {
        expect(SPECIES[branche.into] ?? species(branche.into)).toBeDefined();
        expect(branche.level ?? branche.stone ?? branche.bonheur).toBeDefined();
      }
    }
  });
});
