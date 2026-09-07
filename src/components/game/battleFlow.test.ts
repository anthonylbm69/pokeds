import { describe, expect, it } from "vitest";
import {
  battleAction,
  battleScreen,
  efficaciteContre,
  firstReady,
  itemHint,
  type BattleUi,
} from "./battleFlow";
import { createMon, maxHp, startTrainer, startWild, type Mon } from "@/lib/game/battle";
import { emptyBag, type Bag } from "@/lib/game/items";
import type { Choice } from "./TouchPanel";

const sac = (over: Partial<Bag> = {}): Bag => ({ ...emptyBag(), ...over });
const solide = (id: number, level = 40) => createMon(id, level, false);
const monLine = (m: Mon) => ({ label: m.name, sub: `N.${m.level}` });

const ui = (over: Partial<BattleUi> = {}): BattleUi => ({
  state: startWild([solide(495)], solide(504, 5), sac({ ball: 3, hyperball: 1, potion: 2 })),
  queue: [],
  view: "menu",
  throwing: false,
  showTrainer: false,
  origin: { kind: "sauvage" },
  ...over,
});

const bouton = (id: string): Choice => ({ id, label: id });
const ids = (u: BattleUi) => battleScreen(u, monLine).list.map((c) => c.id);

describe("les écrans de combat", () => {
  it("ne proposent rien pendant le défilement du texte", () => {
    expect(battleScreen(ui({ view: "message" }), monLine).list).toEqual([]);
  });

  it("nomment l'adversaire quand c'est un dresseur", () => {
    const state = startTrainer(
      [solide(495)],
      [solide(500)],
      { name: "Steven", title: "Dresseur", reward: 100 },
      sac(),
    );
    expect(battleScreen(ui({ state }), monLine).title).toContain("Steven");
    expect(battleScreen(ui(), monLine).title).toContain("sauvage");
  });

  it("interdisent la fuite face à un dresseur, pas face à un sauvage", () => {
    const fuite = (u: BattleUi) =>
      battleScreen(u, monLine).list.find((c) => c.id === "run")?.disabled;
    expect(fuite(ui())).toBe(false);

    const state = startTrainer(
      [solide(495)],
      [solide(500)],
      { name: "Steven", title: "Dresseur", reward: 100 },
      sac(),
    );
    expect(fuite(ui({ state }))).toBe(true);
  });

  it("ne montrent au sac que ce que l'on porte", () => {
    const liste = ids(ui({ view: "bag" }));
    expect(liste).toContain("ball");
    expect(liste).toContain("potion");
    expect(liste).not.toContain("superpotion");
    expect(liste).toContain("back");
  });

  it("grisent les Balls face à un dresseur, en disant pourquoi", () => {
    const state = startTrainer(
      [solide(495)],
      [solide(500)],
      { name: "Steven", title: "Dresseur", reward: 100 },
      sac({ ball: 2, potion: 1 }),
    );
    const liste = battleScreen(ui({ state, view: "bag" }), monLine).list;
    const ball = liste.find((c) => c.id === "ball");
    expect(ball?.disabled).toBe(true);
    expect(ball?.sub).toContain("Pokémon d'un autre");
    expect(liste.find((c) => c.id === "potion")?.disabled).toBe(false);
  });

  it("grisent une attaque sans PP", () => {
    const mine = solide(495);
    mine.moves = [{ id: "charge", pp: 0, max: 30 }];
    const u = ui({ state: startWild([mine], solide(504, 5), sac()), view: "moves" });
    expect(battleScreen(u, monLine).list[0].disabled).toBe(true);
  });

  it("empêchent de reculer quand il faut choisir un remplaçant", () => {
    const state = startWild([solide(495), solide(500)], solide(504, 5), sac());
    state.mustSwitch = true;
    const liste = battleScreen(ui({ state, view: "party" }), monLine).list;
    expect(liste.find((c) => c.id === "back")?.disabled).toBe(true);
  });

  it("empêchent de renvoyer celui qui combat déjà, ou un Pokémon au tapis", () => {
    const second = solide(500);
    second.hp = 0;
    const state = startWild([solide(495), second], solide(504, 5), sac());
    const liste = battleScreen(ui({ state, view: "party" }), monLine).list;
    expect(liste[0].disabled).toBe(true);
    expect(liste[1].disabled).toBe(true);
  });
});

describe("le choix du joueur", () => {
  it("ouvre l'écran correspondant depuis le menu", () => {
    expect(battleAction(ui(), bouton("fight"), 0)).toMatchObject({ do: "vue", view: "moves" });
    expect(battleAction(ui(), bouton("bag"), 0)).toMatchObject({ do: "vue", view: "bag" });
    expect(battleAction(ui(), bouton("party"), 0)).toMatchObject({ do: "vue", view: "party" });
  });

  it("place le curseur sur un remplaçant en forme", () => {
    const premier = solide(495);
    const blesse = solide(500);
    blesse.hp = 0;
    const valide = solide(503);
    const state = startWild([premier, blesse, valide], solide(504, 5), sac());
    const action = battleAction(ui({ state }), bouton("party"), 0);
    expect(action).toMatchObject({ do: "vue", view: "party", cursor: 2 });
  });

  it("renvoie au menu depuis n'importe quel sous-écran", () => {
    for (const view of ["moves", "bag", "party"] as const) {
      expect(battleAction(ui({ view }), bouton("back"), 0)).toMatchObject({
        do: "vue",
        view: "menu",
      });
    }
    // Depuis la cible, on remonte au sac plutôt qu'au menu.
    expect(battleAction(ui({ view: "bagCible" }), bouton("back"), 0)).toMatchObject({
      do: "vue",
      view: "bag",
    });
  });

  it("lance une Ball tout de suite, mais demande la cible d'un soin", () => {
    const lancer = battleAction(ui({ view: "bag" }), bouton("hyperball"), 0);
    expect(lancer).toMatchObject({ do: "tour", throwing: true });

    const soin = battleAction(ui({ view: "bag" }), bouton("potion"), 0);
    expect(soin).toMatchObject({ do: "vue", view: "bagCible", item: "potion" });
  });

  it("emploie l'objet sur le Pokémon désigné", () => {
    const mine = solide(495);
    mine.hp = 1;
    const state = startWild([mine], solide(504, 5), sac({ potion: 2 }));
    const action = battleAction(ui({ state, view: "bagCible", item: "potion" }), bouton("cible:0"), 0);
    expect(action.do).toBe("tour");
    if (action.do !== "tour") return;
    expect(action.turn.state.party[0].hp).toBeGreaterThan(1);
    expect(action.turn.state.bag.potion).toBe(1);
  });

  it("joue l'attaque du rang choisi", () => {
    const mine = solide(495, 50);
    mine.moves = [
      { id: "mimi-queue", pp: 30, max: 30 },
      { id: "plaquage", pp: 30, max: 30 },
    ];
    const state = startWild([mine], solide(143, 50), sac());
    const action = battleAction(ui({ state, view: "moves" }), bouton("plaquage"), 1);
    expect(action.do).toBe("tour");
    if (action.do !== "tour") return;
    // C'est bien Plaquage qui a servi : ses PP ont baissé, pas ceux de l'autre.
    expect(action.turn.state.party[0].moves[1].pp).toBe(29);
    expect(action.turn.state.party[0].moves[0].pp).toBe(30);
  });
});

describe("les notes affichées", () => {
  it("annoncent l'efficacité, sans rien dire des attaques de statut", () => {
    // Ratentif est de type Normal : le Combat lui fait mal, le Spectre non.
    const cible = solide(504, 20);
    expect(efficaciteContre("balayage", cible)).toContain("efficace");
    expect(efficaciteContre("griffe-ombre", cible)).toContain("sans effet");
    expect(efficaciteContre("mimi-queue", cible)).toBe("");
  });

  it("résument ce que fait chaque objet", () => {
    expect(itemHint("hyperball")).toContain("×2");
    expect(itemHint("superpotion")).toContain("50");
    expect(itemHint("rappel")).toContain("ranime");
    expect(itemHint("totalsoin")).toContain("altération");
    // Une Poké Ball n'a rien de particulier à dire.
    expect(itemHint("ball")).toBe("");
  });
});

describe("le premier remplaçant", () => {
  it("saute celui qui combat et ceux qui sont au tapis", () => {
    const actif = solide(495);
    const mort = solide(500);
    mort.hp = 0;
    const valide = solide(503);
    const state = startWild([actif, mort, valide], solide(504, 5), sac());
    expect(firstReady(state)).toBe(2);
  });

  it("retombe sur zéro quand personne ne peut entrer", () => {
    const state = startWild([solide(495)], solide(504, 5), sac());
    expect(firstReady(state)).toBe(0);
  });

  it("laisse les PV intacts : ce n'est qu'un curseur", () => {
    const state = startWild([solide(495), solide(500)], solide(504, 5), sac());
    const avant = state.party.map((m) => m.hp);
    firstReady(state);
    expect(state.party.map((m) => m.hp)).toEqual(avant);
    expect(state.party[0].hp).toBe(maxHp(state.party[0]));
  });
});
