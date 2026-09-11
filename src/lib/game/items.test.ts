import { describe, expect, it } from "vitest";
import { createMon, maxHp, startWild, takeItem, throwBall } from "./battle";
import {
  ITEMS,
  ITEM_ORDER,
  add,
  countOf,
  effectOn,
  emptyBag,
  isPP,
  needsTarget,
  normaliseBag,
  ppEffectOn,
  refillPP,
  spend,
  startingBag,
  type Bag,
  type ItemId,
} from "./items";

const sac = (over: Partial<Bag> = {}): Bag => ({ ...emptyBag(), ...over });

describe("le catalogue d'objets", () => {
  it("range chaque objet du sac dans l'ordre du rayon", () => {
    expect(new Set(ITEM_ORDER).size).toBe(ITEM_ORDER.length);
    expect(ITEM_ORDER.sort()).toEqual(Object.keys(ITEMS).sort());
  });

  it("monte en prix comme en efficacité", () => {
    expect(ITEMS.superball.price).toBeGreaterThan(ITEMS.ball.price);
    expect(ITEMS.hyperball.price).toBeGreaterThan(ITEMS.superball.price);
    expect(ITEMS.superball.bonus!).toBeGreaterThan(ITEMS.ball.bonus!);
    expect(ITEMS.hyperball.bonus!).toBeGreaterThan(ITEMS.superball.bonus!);

    expect(ITEMS.superpotion.heal!).toBeGreaterThan(ITEMS.potion.heal!);
    expect(ITEMS.hyperpotion.heal!).toBeGreaterThan(ITEMS.superpotion.heal!);
  });

  it("distingue ce qui se lance de ce qui se pose", () => {
    expect(needsTarget("ball")).toBe(false);
    expect(needsTarget("hyperball")).toBe(false);
    expect(needsTarget("potion")).toBe(true);
    expect(needsTarget("rappel")).toBe(true);
  });

  it("compte, dépense et ajoute sans jamais passer sous zéro", () => {
    let bag = sac({ potion: 1 });
    bag = spend(bag, "potion");
    expect(countOf(bag, "potion")).toBe(0);
    bag = spend(bag, "potion");
    expect(countOf(bag, "potion")).toBe(0);
    bag = add(bag, "potion", 3);
    expect(countOf(bag, "potion")).toBe(3);
  });
});

describe("la relecture d'un vieux sac", () => {
  it("reprend les deux compteurs d'avant les Super Ball", () => {
    const bag = normaliseBag(undefined, 7, 4);
    expect(bag.ball).toBe(7);
    expect(bag.potion).toBe(4);
    expect(bag.superball).toBe(0);
    expect(bag.rappel).toBe(0);
  });

  it("complète un sac partiel sans rien inventer", () => {
    const bag = normaliseBag({ hyperball: 2 }, 99, 99);
    expect(bag.hyperball).toBe(2);
    // Le sac existe : les anciens compteurs ne s'y ajoutent pas une seconde fois.
    expect(bag.ball).toBe(0);
    for (const id of ITEM_ORDER) expect(Number.isInteger(bag[id])).toBe(true);
  });

  it("refuse les quantités absurdes", () => {
    const bag = normaliseBag({ potion: -5, ball: 2.7 });
    expect(bag.potion).toBe(0);
    expect(bag.ball).toBe(2);
  });

  it("donne au débutant de quoi tenir jusqu'à la boutique", () => {
    const bag = startingBag();
    expect(bag.ball).toBeGreaterThan(0);
    expect(bag.potion).toBeGreaterThan(0);
    expect(bag.hyperball).toBe(0);
  });
});

describe("l'effet d'un objet", () => {
  const blesse = (hp: number) => {
    const mon = createMon(495, 40, false);
    mon.hp = hp;
    return mon;
  };

  it("plafonne un soin aux PV manquants", () => {
    // Le même Pokémon d'un bout à l'autre : les IV sont tirés au sort.
    const mon = createMon(495, 40, false);
    mon.hp = maxHp(mon) - 5;
    expect(effectOn("hyperpotion", mon).healed).toBe(5);
  });

  it("refuse un soin sur un Pokémon intact ou au tapis", () => {
    const plein = createMon(495, 40, false);
    expect(effectOn("potion", plein).refus).toContain("tous ses PV");

    const ko = blesse(0);
    expect(effectOn("potion", ko).refus).toContain("Rappel");
  });

  it("ne ranime que ce qui est tombé, à la moitié des PV", () => {
    const ko = blesse(0);
    expect(effectOn("rappel", ko).healed).toBe(Math.floor(maxHp(ko) / 2));

    const debout = blesse(3);
    expect(effectOn("rappel", debout).refus).toContain("debout");
  });

  it("ne se pose pas sur du vide", () => {
    expect(effectOn("potion", undefined).refus).toBeTruthy();
  });
});

describe("les objets en combat", () => {
  const duel = (bag: Bag, hp = 5) => {
    const mine = createMon(495, 40, false);
    mine.hp = hp;
    return startWild([mine], createMon(504, 5, false), bag);
  };

  it("consomme la Ball lancée, et pas une autre", () => {
    const state = duel(sac({ ball: 3, hyperball: 2 }));
    const apres = throwBall(state, "hyperball").state;
    expect(apres.bag.hyperball).toBe(1);
    expect(apres.bag.ball).toBe(3);
  });

  it("annonce la Ball par son nom", () => {
    const { messages } = throwBall(duel(sac({ superball: 1 })), "superball");
    expect(messages.some((m) => m.includes("Super Ball"))).toBe(true);
  });

  it("refuse une Ball que l'on n'a pas", () => {
    const { state, messages } = throwBall(duel(sac({ ball: 1 })), "hyperball");
    expect(state.bag.ball).toBe(1);
    expect(messages.some((m) => m.includes("Hyper Ball"))).toBe(true);
  });

  it("soigne le Pokémon visé, pas forcément celui qui combat", () => {
    const mine = createMon(495, 40, false);
    mine.hp = 30;
    const remplacant = createMon(498, 40, false);
    remplacant.hp = 1;
    const state = startWild([mine, remplacant], createMon(504, 5, false), sac({ potion: 2 }));
    const apres = takeItem(state, "potion", 1).state;
    expect(apres.party[1].hp).toBe(1 + ITEMS.potion.heal!);
    // Poser un objet coûte le tour : celui qui combat encaisse la riposte,
    // mais il ne doit surtout pas avoir profité du soin.
    expect(apres.party[0].hp).toBeLessThanOrEqual(30);
    expect(apres.bag.potion).toBe(1);
  });

  it("ranime un Pokémon au tapis et lève l'obligation de changer", () => {
    const mine = createMon(495, 40, false);
    const second = createMon(498, 40, false);
    second.hp = 0;
    const state = startWild([mine, second], createMon(504, 5, false), sac({ rappel: 1 }));
    state.mustSwitch = true;
    const apres = takeItem(state, "rappel", 1).state;
    expect(apres.party[1].hp).toBeGreaterThan(0);
    expect(apres.mustSwitch).toBe(false);
  });

  it("ne consomme rien quand l'objet est sans effet", () => {
    const state = duel(sac({ potion: 2 }), 999);
    const { state: apres, messages } = takeItem(state, "potion");
    expect(apres.bag.potion).toBe(2);
    expect(messages.some((m) => m.includes("tous ses PV"))).toBe(true);
  });
});

describe("le bonus de capture", () => {
  it("fait mieux avec une meilleure Ball, à la longue", () => {
    const essais = 4000;
    const prises = (item: ItemId) => {
      let n = 0;
      for (let i = 0; i < essais; i++) {
        const foe = createMon(504, 30, false);
        foe.hp = Math.ceil(maxHp(foe) / 2);
        const state = startWild([createMon(495, 40, false)], foe, sac({ [item]: 1 } as Partial<Bag>));
        if (throwBall(state, item).state.outcome === "capture") n += 1;
      }
      return n;
    };
    const simple = prises("ball");
    const hyper = prises("hyperball");
    expect(hyper, `${hyper} contre ${simple}`).toBeGreaterThan(simple);
  });
});

describe("l'Huile et l'Élixir", () => {
  /** Un Pokémon dont le répertoire est entamé, à volonté. */
  const usagé = (restants: number[]) => {
    const mon = createMon(495, 20, false);
    mon.moves = mon.moves.map((m, i) => ({ ...m, pp: restants[i] ?? m.max }));
    return mon;
  };

  it("se reconnaissent comme objets de PP", () => {
    expect(isPP("huile")).toBe(true);
    expect(isPP("elixir")).toBe(true);
    expect(isPP("potion")).toBe(false);
    expect(isPP("ball")).toBe(false);
  });

  it("se posent sur un Pokémon de l'équipe", () => {
    expect(needsTarget("huile")).toBe(true);
    expect(needsTarget("elixir")).toBe(true);
  });

  it("l'Élixir sert tout le répertoire, l'Huile une seule attaque", () => {
    expect(ITEMS.huile.pp?.toutes).toBeUndefined();
    expect(ITEMS.elixir.pp?.toutes).toBe(true);
    expect(ITEMS.elixir.price).toBeGreaterThan(ITEMS.huile.price);
  });

  it("rendent des PP à l'attaque visée, sans toucher aux autres", () => {
    const mon = usagé([0, 0]);
    const moves = refillPP("huile", mon, 1);
    expect(moves[0].pp).toBe(0);
    expect(moves[1].pp).toBe(Math.min(moves[1].max, ITEMS.huile.pp!.amount));
  });

  it("l'Élixir recharge tout d'un coup", () => {
    const mon = usagé([0, 0, 0]);
    const moves = refillPP("elixir", mon, 0);
    for (const m of moves) expect(m.pp).toBeGreaterThan(0);
  });

  it("ne dépassent jamais le maximum", () => {
    const mon = usagé([]);
    for (const m of refillPP("elixir", mon, 0)) expect(m.pp).toBe(m.max);
  });

  it("refusent une attaque déjà pleine", () => {
    const mon = usagé([]);
    expect(ppEffectOn("huile", mon, 0).refus).toContain("déjà tous ses PP");
    expect(ppEffectOn("elixir", mon).refus).toContain("déjà tous ses PP");
  });

  it("acceptent dès qu'une seule attaque est entamée", () => {
    const mon = usagé([0]);
    expect(ppEffectOn("huile", mon, 0).refus).toBeNull();
    expect(ppEffectOn("elixir", mon).refus).toBeNull();
    // Mais l'Huile visée sur une attaque pleine refuse toujours.
    expect(ppEffectOn("huile", mon, 1).refus).not.toBeNull();
  });

  it("refusent poliment quand il n'y a personne", () => {
    expect(ppEffectOn("huile", undefined).refus).toContain("Aucun Pokémon");
    expect(ppEffectOn("potion", usagé([0])).refus).toContain("ne rend pas de PP");
  });

  it("ne rendent pas de PV : `effectOn` relaie le refus", () => {
    const mon = usagé([]);
    mon.hp = 1;
    const { healed, refus } = effectOn("elixir", mon);
    expect(healed).toBe(0);
    expect(refus).toContain("déjà tous ses PP");
  });

  it("laissent le répertoire d'origine intact", () => {
    const mon = usagé([0]);
    refillPP("elixir", mon, 0);
    expect(mon.moves[0].pp).toBe(0);
  });
});
