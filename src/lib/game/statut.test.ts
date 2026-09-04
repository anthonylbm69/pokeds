import { describe, expect, it } from "vitest";
import {
  STATUS_FR,
  STATUS_TAG,
  createMon,
  foePlan,
  healMon,
  inflict,
  isKo,
  maxHp,
  playerMove,
  startTrainer,
  startWild,
  statusBonus,
  takeItem,
  throwBall,
  type Mon,
} from "./battle";
import { MOVES } from "./data";
import { emptyBag, type Bag } from "./items";

const sac = (over: Partial<Bag> = {}): Bag => ({ ...emptyBag(), ...over });
const solide = (id: number, level = 40) => createMon(id, level, false);

describe("les altérations", () => {
  it("ont toutes un libellé et une étiquette", () => {
    for (const st of Object.keys(STATUS_FR) as (keyof typeof STATUS_FR)[]) {
      expect(STATUS_FR[st].length).toBeGreaterThan(0);
      expect(STATUS_TAG[st]).toMatch(/^.{3}$/);
    }
  });

  it("ne se cumulent pas : la première tient", () => {
    const mon = solide(495);
    const msg: string[] = [];
    expect(inflict(mon, "poison", true, msg)).toBe(true);
    expect(inflict(mon, "brulure", true, msg)).toBe(false);
    expect(mon.status).toBe("poison");
  });

  it("épargnent les types qui y sont insensibles", () => {
    const msg: string[] = [];
    // Gruikui est de type Feu : il ne brûle pas.
    expect(inflict(solide(498), "brulure", true, msg)).toBe(false);
    // Vipélierre, lui, n'a aucune protection.
    expect(inflict(solide(495), "brulure", true, msg)).toBe(true);
  });

  it("donnent au sommeil un compte de tours", () => {
    const mon = solide(495);
    inflict(mon, "sommeil", true, []);
    expect(mon.sleep).toBeGreaterThan(0);
    expect(mon.sleep).toBeLessThanOrEqual(3);
  });

  it("s'effacent au Centre Pokémon", () => {
    const mon = solide(495);
    inflict(mon, "paralysie", true, []);
    mon.hp = 1;
    const soigne = healMon(mon);
    expect(soigne.status).toBeNull();
    expect(soigne.sleep).toBe(0);
    expect(soigne.hp).toBe(maxHp(soigne));
  });
});

describe("le poison et la brûlure", () => {
  // Personne ne doit tomber pendant le tour : les résidus n'arrivent qu'à la
  // fin d'un tour que les deux camps ont fini debout.
  const duel = (statut: "poison" | "brulure") => {
    const mine = solide(495, 40);
    mine.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
    inflict(mine, statut, true, []);
    const avant = mine.hp;
    const foe = solide(143, 60);
    foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
    return { avant, ...playerMove(startWild([mine], foe, sac()), 0) };
  };

  it("rongent des PV à la fin du tour", () => {
    for (const statut of ["poison", "brulure"] as const) {
      const { avant, state } = duel(statut);
      expect(state.party[0].hp, statut).toBeLessThan(avant);
    }
  });

  it("annoncent leur prélèvement", () => {
    expect(duel("poison").messages.some((m) => m.includes("poison"))).toBe(true);
    expect(duel("brulure").messages.some((m) => m.includes("brûlure"))).toBe(true);
  });

  it("amputent l'attaque physique quand c'est une brûlure", () => {
    // Deux séries identiques, à ceci près que l'attaquant est brûlé.
    const degats = (brule: boolean) => {
      let total = 0;
      for (let i = 0; i < 300; i++) {
        const mine = solide(495, 50);
        mine.moves = [{ id: "plaquage", pp: 30, max: 30 }];
        if (brule) mine.status = "brulure";
        const foe = solide(143, 50);
        foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
        const { state } = playerMove(startWild([mine], foe, sac()), 0);
        total += maxHp(foe) - state.foe.hp;
      }
      return total;
    };
    expect(degats(true)).toBeLessThan(degats(false));
  });
});

describe("le sommeil, le gel et la paralysie", () => {
  it("empêchent d'agir tant qu'ils durent", () => {
    const mine = solide(495, 50);
    mine.moves = [{ id: "plaquage", pp: 30, max: 30 }];
    mine.status = "sommeil";
    mine.sleep = 3;
    const foe = solide(143, 50);
    foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
    const { state, messages } = playerMove(startWild([mine], foe, sac()), 0);
    expect(state.foe.hp).toBe(maxHp(foe));
    expect(messages.some((m) => m.includes("dort"))).toBe(true);
  });

  it("laissent repartir une fois le compte épuisé", () => {
    const mon = solide(495, 50);
    mon.moves = [{ id: "plaquage", pp: 30, max: 30 }];
    mon.status = "sommeil";
    mon.sleep = 0;
    const foe = solide(143, 50);
    foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
    const { state, messages } = playerMove(startWild([mon], foe, sac()), 0);
    expect(messages.some((m) => m.includes("réveille"))).toBe(true);
    expect(state.party[0].status).toBeNull();
  });

  it("ralentissent le paralysé au point de lui faire perdre l'initiative", () => {
    // Majaspic est plus rapide que Roitiflam ; paralysé, il ne l'est plus.
    const initiativeAdverse = (paralyse: boolean) => {
      let n = 0;
      for (let i = 0; i < 200; i++) {
        const mine = solide(497, 50);
        mine.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
        if (paralyse) mine.status = "paralysie";
        const foe = solide(500, 50);
        foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
        const { messages } = playerMove(startWild([mine], foe, sac()), 0);
        if (messages[0]?.includes("ennemi")) n += 1;
      }
      return n;
    };
    expect(initiativeAdverse(true)).toBeGreaterThan(initiativeAdverse(false));
  });
});

describe("l'altération et la capture", () => {
  it("rend un Pokémon endormi bien plus facile à prendre", () => {
    expect(statusBonus("sommeil")).toBeGreaterThan(statusBonus("poison"));
    expect(statusBonus("poison")).toBeGreaterThan(statusBonus(null));
  });

  it("se voit sur le nombre de captures", () => {
    const prises = (statut: "sommeil" | null) => {
      let n = 0;
      for (let i = 0; i < 3000; i++) {
        const foe = solide(504, 30);
        foe.hp = Math.ceil(maxHp(foe) / 2);
        if (statut) foe.status = statut;
        const state = startWild([solide(495)], foe, sac({ ball: 1 }));
        if (throwBall(state, "ball").state.outcome === "capture") n += 1;
      }
      return n;
    };
    const endormi = prises("sommeil");
    const eveille = prises(null);
    expect(endormi, `${endormi} contre ${eveille}`).toBeGreaterThan(eveille);
  });
});

describe("le Total Soin", () => {
  it("efface l'altération sans rendre de PV", () => {
    const mine = solide(495, 40);
    mine.hp = 20;
    inflict(mine, "poison", true, []);
    const state = startWild([mine], solide(504, 5), sac({ totalsoin: 1 }));
    const apres = takeItem(state, "totalsoin", 0).state;
    expect(apres.party[0].status).toBeNull();
    expect(apres.bag.totalsoin).toBe(0);
  });

  it("ne se gaspille pas sur un Pokémon sain", () => {
    const state = startWild([solide(495, 40)], solide(504, 5), sac({ totalsoin: 1 }));
    const { state: apres, messages } = takeItem(state, "totalsoin", 0);
    expect(apres.bag.totalsoin).toBe(1);
    expect(messages.some((m) => m.includes("se porte"))).toBe(true);
  });
});

describe("le dresseur adverse", () => {
  const duel = (mine: Mon[], team: Mon[], potions = 2) => {
    const state = startTrainer(mine, team, { name: "Test", title: "Dresseur", reward: 100 }, sac());
    state.foePotions = potions;
    return state;
  };

  it("se soigne quand il est bas, et pas avant", () => {
    const state = duel([solide(495)], [solide(500), solide(503)]);
    expect(foePlan(state).do).toBe("attaque");
    state.foe.hp = Math.floor(maxHp(state.foe) / 4);
    expect(foePlan(state).do).toBe("soin");
  });

  it("ne se soigne pas s'il n'a plus de Potion", () => {
    const state = duel([solide(495)], [solide(500), solide(503)], 0);
    state.foe.hp = Math.floor(maxHp(state.foe) / 4);
    expect(foePlan(state).do).not.toBe("soin");
  });

  it("passe la main quand son Pokémon n'a rien à opposer", () => {
    // Un Roitiflam armé de Feu face à un Clamiral, avec un Eau sur le banc.
    const foe = solide(500, 40);
    foe.moves = [{ id: "flammeche", pp: 30, max: 30 }];
    const banc = solide(503, 40);
    banc.moves = [{ id: "hydrocanon", pp: 30, max: 30 }];
    expect(foePlan(duel([solide(503)], [foe, banc], 0)).do).toBe("change");
  });

  it("ne change pas quand il tient la corde", () => {
    const foe = solide(503, 40);
    foe.moves = [{ id: "hydrocanon", pp: 30, max: 30 }];
    const banc = solide(500, 40);
    banc.moves = [{ id: "flammeche", pp: 30, max: 30 }];
    expect(foePlan(duel([solide(500)], [foe, banc], 0)).do).toBe("attaque");
  });

  it("n'a ni Potion ni banc de touche à l'état sauvage", () => {
    const state = startWild([solide(495)], solide(504, 5), sac());
    state.foe.hp = 1;
    expect(foePlan(state).do).toBe("attaque");
    expect(state.foePotions).toBe(0);
  });

  it("ne perd pas le Pokémon qu'il a rappelé", () => {
    const foe = solide(500, 40);
    foe.moves = [{ id: "flammeche", pp: 30, max: 30 }];
    const banc = solide(503, 40);
    banc.moves = [{ id: "hydrocanon", pp: 30, max: 30 }];
    const mine = solide(503, 40);
    mine.moves = [{ id: "hydrocanon", pp: 30, max: 30 }];
    const apres = playerMove(duel([mine], [foe, banc], 0), 0).state;
    const noms = [apres.foe, ...apres.foeTeam].map((m) => m.name).sort();
    expect(noms).toEqual([foe.name, banc.name].sort());
  });
});

describe("le partage d'expérience", () => {
  it("fait aussi progresser ceux qui n'ont pas combattu", () => {
    const combattant = solide(497, 50);
    combattant.moves = [{ id: "lame-feuille", pp: 30, max: 30 }];
    const banc = solide(500, 20);
    const avantBanc = banc.exp;
    const avantCombattant = combattant.exp;
    const foe = solide(504, 5);
    foe.hp = 1;
    const { state } = playerMove(startWild([combattant, banc], foe, sac()), 0);
    expect(state.party[1].exp).toBeGreaterThan(avantBanc);
    // Celui qui se bat en touche davantage.
    expect(state.party[0].exp - avantCombattant).toBeGreaterThan(
      state.party[1].exp - avantBanc,
    );
  });

  it("saute ceux qui sont au tapis", () => {
    const combattant = solide(497, 50);
    combattant.moves = [{ id: "lame-feuille", pp: 30, max: 30 }];
    const mort = solide(500, 20);
    mort.hp = 0;
    const avant = mort.exp;
    const foe = solide(504, 5);
    foe.hp = 1;
    const { state } = playerMove(startWild([combattant, mort], foe, sac()), 0);
    expect(state.party[1].exp).toBe(avant);
    expect(isKo(state.party[1])).toBe(true);
  });
});

describe("les attaques d'altération", () => {
  it("existent pour chaque mal, et posent bien ce qu'elles annoncent", () => {
    const poseurs = Object.values(MOVES).filter((m) => m.inflicts && m.category === "statut");
    const maux = new Set(poseurs.map((m) => m.inflicts!.status));
    for (const attendu of ["poison", "brulure", "paralysie", "sommeil"] as const) {
      expect(maux.has(attendu), `aucune attaque ne rend ${attendu}`).toBe(true);
    }
    // Une attaque de statut pose à coup sûr ; un effet secondaire, non.
    for (const m of poseurs) expect(m.inflicts!.chance).toBe(1);
  });

  it("gardent les effets secondaires rares", () => {
    const secondaires = Object.values(MOVES).filter(
      (m) => m.inflicts && m.category !== "statut",
    );
    expect(secondaires.length).toBeGreaterThan(0);
    for (const m of secondaires) {
      expect(m.inflicts!.chance).toBeGreaterThan(0);
      expect(m.inflicts!.chance).toBeLessThanOrEqual(0.3);
    }
  });
});
