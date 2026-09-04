import { describe, expect, it } from "vitest";
import {
  MOVES,
  computeStat,
  effectiveness,
  expForLevel,
  expGain,
  SPECIES,
  species,
} from "./data";
import {
  activeMon,
  createMon,
  isKo,
  maxHp,
  playerMove,
  startTrainer,
  startWild,
  statOf,
  switchTo,
  takePotion,
  throwBall,
  tryRun,
  type Mon,
} from "./battle";

const bag = { balls: 10, potions: 5 };

/** Combat mené jusqu'au bout en tapant toujours la même attaque. */
function runBattle(mine: Mon, foe: Mon, moveIndex = 0) {
  let state = startWild([mine], foe, bag);
  const log: string[] = [];
  let turns = 0;
  while (state.outcome === "en-cours" && turns < 60) {
    const index = Math.min(moveIndex, activeMon(state).moves.length - 1);
    const turn = playerMove(state, index);
    state = turn.state;
    log.push(...turn.messages);
    turns += 1;
  }
  return { state, log, turns };
}

describe("table des types", () => {
  it("applique les faiblesses et les résistances", () => {
    expect(effectiveness("water", ["fire"])).toBe(2);
    expect(effectiveness("fire", ["water"])).toBe(0.5);
    expect(effectiveness("normal", ["normal"])).toBe(1);
  });

  it("cumule les deux types du défenseur", () => {
    // Poichigeon est Normal / Vol : Électrik n'est fort que sur Vol.
    expect(effectiveness("electric", ["normal", "flying"])).toBe(2);
    // Roche frappe Feu et Vol : quatre fois plus efficace.
    expect(effectiveness("rock", ["fire", "flying"])).toBe(4);
  });

  it("annule les immunités", () => {
    expect(effectiveness("normal", ["ghost"])).toBe(0);
    expect(effectiveness("electric", ["ground"])).toBe(0);
  });
});

describe("statistiques", () => {
  it("suit la formule des jeux", () => {
    // PV = ((2 × base + IV) × niveau / 100) + niveau + 10
    expect(computeStat(45, 15, 5, true)).toBe(20);
    // Autres stats = ((2 × base + IV) × niveau / 100) + 5
    expect(computeStat(45, 15, 5, false)).toBe(10);
  });

  it("donne un Vipélierre niveau 5 cohérent", () => {
    const mon = createMon(495, 5);
    expect(mon.level).toBe(5);
    expect(mon.hp).toBe(maxHp(mon));
    expect(maxHp(mon)).toBeGreaterThanOrEqual(19);
    expect(maxHp(mon)).toBeLessThanOrEqual(21);
  });

  it("respecte le profil rapide de Vipélierre", () => {
    // Au niveau 5 les IV tirés au sort peuvent égaliser Vitesse et Attaque :
    // le profil d'espèce ne se lit qu'à IV identiques, et de préférence haut.
    expect(species(495).base.spe).toBeGreaterThan(species(495).base.atk);

    const mon = createMon(495, 50);
    mon.ivs = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
    expect(statOf(mon, "spe")).toBeGreaterThan(statOf(mon, "atk"));
  });

  it("n'apprend que les attaques du niveau atteint", () => {
    const jeune = createMon(495, 3);
    const grand = createMon(495, 12);
    expect(jeune.moves.map((m) => m.id)).toEqual(["charge", "groz-yeux"]);
    expect(grand.moves.map((m) => m.id)).toContain("tranch-herbe");
    expect(grand.moves.length).toBeLessThanOrEqual(4);
  });
});

// Combats et captures tirent au sort. Les bornes ci-dessous sont posées à
// plusieurs écarts-types du résultat attendu : assez serrées pour repérer une
// formule cassée, assez larges pour ne jamais clignoter.
describe("déroulement d'un combat", () => {
  it("un starter niveau 5 bat presque toujours un Ratentif sauvage", () => {
    let wins = 0;
    for (let i = 0; i < 200; i++) {
      const mine = createMon(495, 5);
      const foe = createMon(504, 2 + Math.floor(Math.random() * 3));
      const index = mine.moves.findIndex((m) => m.id === "fouet-lianes");
      const { state } = runBattle(mine, foe, Math.max(0, index));
      if (state.outcome === "victoire") wins += 1;
    }
    expect(wins).toBeGreaterThan(180);
  });

  it("consomme les PP de l'attaque utilisée", () => {
    const mine = createMon(495, 5);
    const foe = createMon(504, 3);
    const before = mine.moves[0].pp;
    const { state } = playerMove(startWild([mine], foe, bag), 0);
    expect(state.party[0].moves[0].pp).toBe(before - 1);
  });

  it("accorde de l'expérience à la victoire", () => {
    const mine = createMon(495, 5);
    const foe = createMon(504, 3);
    const expected = expGain(species(504).baseExp, 3);
    const { state, log } = runBattle(mine, foe);
    expect(state.outcome).toBe("victoire");
    expect(state.party[0].exp).toBeGreaterThanOrEqual(expForLevel(5) + expected);
    expect(log.some((line) => line.includes("points d'exp"))).toBe(true);
  });

  it("déclare la défaite quand toute l'équipe est K.O.", () => {
    const mine = createMon(495, 2);
    const foe = createMon(504, 25);
    const { state } = runBattle(mine, foe);
    expect(state.outcome).toBe("defaite");
    expect(state.party.every(isKo)).toBe(true);
  });

  it("les baisses de statistiques s'appliquent à l'adversaire", () => {
    const mine = createMon(495, 5);
    mine.moves = [{ id: "groz-yeux", pp: 30, max: 30 }];
    const foe = createMon(504, 3);
    const { state } = playerMove(startWild([mine], foe, bag), 0);
    expect(state.foeStages.def).toBeLessThan(0);
  });
});

describe("les chromatiques", () => {
  it("sortent à peu près une fois sur dix", () => {
    const tirages = 20000;
    let brillants = 0;
    for (let i = 0; i < tirages; i++) {
      if (createMon(504, 5).shiny) brillants += 1;
    }
    // Espérance : 2000, écart-type ≈ 42. Six écarts-types de marge, pour que
    // le hasard ne fasse jamais rougir la suite.
    expect(brillants).toBeGreaterThan(1750);
    expect(brillants).toBeLessThan(2250);
  });

  it("se laissent imposer, dans un sens comme dans l'autre", () => {
    expect(createMon(504, 5, true).shiny).toBe(true);
    expect(createMon(504, 5, false).shiny).toBe(false);
  });

  it("gardent leur livrée après une évolution", () => {
    const mine = createMon(504, 19, true);
    mine.exp = expForLevel(20) - 1;
    const foe = createMon(506, 30);
    foe.moves = [{ id: "groz-yeux", pp: 30, max: 30 }];
    const { state } = runBattle(mine, foe);
    expect(state.party[0].id).toBe(505);
    expect(state.party[0].shiny, "la livrée s'est perdue en évoluant").toBe(true);
  });

  it("gardent leur livrée une fois capturés", () => {
    const foe = createMon(504, 3, true);
    foe.hp = 1;
    const state = startWild([createMon(495, 5, false)], foe, bag);
    const after = throwBall(state).state;
    if (after.outcome === "capture") {
      expect(after.caught?.shiny).toBe(true);
    }
  });

  it("ne changent rien aux statistiques", () => {
    const normal = createMon(504, 20, false);
    const brillant = { ...createMon(504, 20, true), ivs: normal.ivs };
    expect(maxHp(brillant)).toBe(maxHp(normal));
    expect(statOf(brillant, "atk")).toBe(statOf(normal, "atk"));
  });
});

describe("évolutions", () => {
  it("chaque espèce évolutive pointe vers une espèce connue", () => {
    for (const form of Object.values(SPECIES)) {
      if (!form.evolvesInto) continue;
      expect(form.evolvesAt, `${form.name} sans niveau d'évolution`).toBeTypeOf("number");
      expect(SPECIES[form.evolvesInto], `${form.name} → ${form.evolvesInto}`).toBeDefined();
    }
  });

  it("transforme le Pokémon au niveau prévu", () => {
    // Ratentif évolue au niveau 20 : on le place à un point du passage.
    const mine = createMon(504, 19);
    mine.exp = expForLevel(20) - 1;
    const foe = createMon(506, 30);
    foe.moves = [{ id: "groz-yeux", pp: 30, max: 30 }]; // inoffensif
    const { state, log } = runBattle(mine, foe);

    expect(state.party[0].level).toBeGreaterThanOrEqual(20);
    expect(state.party[0].id).toBe(505);
    expect(state.party[0].name).toBe("Miradar");
    expect(log.some((line) => line.includes("a évolué en Miradar"))).toBe(true);
  });

  it("garde des PV cohérents après l'évolution", () => {
    const mine = createMon(504, 19);
    mine.exp = expForLevel(20) - 1;
    const foe = createMon(506, 30);
    foe.moves = [{ id: "groz-yeux", pp: 30, max: 30 }];
    const { state } = runBattle(mine, foe);
    const evolved = state.party[0];
    expect(evolved.hp).toBeGreaterThan(0);
    expect(evolved.hp).toBeLessThanOrEqual(maxHp(evolved));
  });
});

describe("capture", () => {
  it("attrape presque toujours un Pokémon affaibli au taux maximal", () => {
    let caught = 0;
    for (let i = 0; i < 200; i++) {
      const foe = createMon(504, 3);
      foe.hp = 1;
      const state = startWild([createMon(495, 5)], foe, bag);
      if (throwBall(state).state.outcome === "capture") caught += 1;
    }
    expect(caught).toBeGreaterThan(180);
  });

  it("résiste bien mieux à pleine santé", () => {
    let caught = 0;
    for (let i = 0; i < 200; i++) {
      const foe = createMon(504, 3);
      const state = startWild([createMon(495, 5)], foe, bag);
      if (throwBall(state).state.outcome === "capture") caught += 1;
    }
    expect(caught).toBeGreaterThan(20);
    expect(caught).toBeLessThan(140);
  });

  it("consomme une Ball et refuse le vol chez un Dresseur", () => {
    const wild = startWild([createMon(495, 5)], createMon(504, 3), bag);
    expect(throwBall(wild).state.balls).toBe(bag.balls - 1);

    const duel = startTrainer(
      [createMon(495, 5)],
      [createMon(504, 3)],
      { name: "Timmy", title: "Gamin", reward: 200 },
      bag,
    );
    const tried = throwBall(duel);
    expect(tried.state.balls).toBe(bag.balls);
    expect(tried.messages.join(" ")).toContain("On ne vole pas");
  });
});

describe("sac et changement", () => {
  it("la Potion rend des PV sans dépasser le maximum", () => {
    const mine = createMon(495, 5);
    mine.hp = 1;
    const state = startWild([mine], createMon(504, 3), bag);
    const after = takePotion(state).state;
    expect(after.potions).toBe(bag.potions - 1);
    expect(after.party[0].hp).toBeGreaterThan(1);
    expect(after.party[0].hp).toBeLessThanOrEqual(maxHp(after.party[0]));
  });

  it("envoyer un autre Pokémon remet les crans à zéro", () => {
    const state = startWild(
      [createMon(495, 5), createMon(506, 5)],
      createMon(504, 3),
      bag,
    );
    state.playerStages.atk = -2;
    const after = switchTo(state, 1).state;
    expect(after.active).toBe(1);
    expect(after.playerStages.atk).toBe(0);
  });

  it("on ne fuit pas un combat de Dresseurs", () => {
    const duel = startTrainer(
      [createMon(495, 5)],
      [createMon(504, 3)],
      { name: "Timmy", title: "Gamin", reward: 200 },
      bag,
    );
    expect(tryRun(duel).state.outcome).toBe("en-cours");
  });

  it("enchaîne sur le Pokémon suivant du Dresseur", () => {
    const duel = startTrainer(
      [createMon(495, 40)],
      [createMon(504, 2), createMon(506, 2)],
      { name: "Léa", title: "Exploratrice", reward: 320 },
      bag,
    );
    const index = duel.party[0].moves.findIndex((m) => MOVES[m.id].power > 0);
    const after = playerMove(duel, Math.max(0, index)).state;
    expect(after.outcome).toBe("en-cours");
    expect(after.foe.id).toBe(506);
    expect(after.foeTeam).toHaveLength(0);
  });
});
