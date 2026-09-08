import { describe, expect, it } from "vitest";
import { MOVES } from "./data";
import {
  WEATHER_FR,
  createMon,
  maxHp,
  playerMove,
  startWild,
  type Mon,
} from "./battle";
import { emptyBag, type Bag } from "./items";

const sac = (over: Partial<Bag> = {}): Bag => ({ ...emptyBag(), ...over });
const solide = (id: number, level = 50) => createMon(id, level, false);
const arme = (id: number, move: string, level = 50) => {
  const m = solide(id, level);
  m.moves = [{ id: move as never, pp: 30, max: 30 }];
  return m;
};
const duel = (mine: Mon, foe: Mon) => playerMove(startWild([mine], foe, sac()), 0);

describe("la météo", () => {
  it("a une phrase pour chaque temps", () => {
    for (const kind of ["pluie", "soleil", "sable"] as const) {
      expect(WEATHER_FR[kind].length).toBeGreaterThan(0);
    }
  });

  it("s'installe pour plusieurs tours et s'annonce", () => {
    const { state, messages } = duel(arme(495, "danse-pluie"), arme(143, "mimi-queue", 60));
    expect(state.weather?.kind).toBe("pluie");
    expect(state.weather!.turns).toBeGreaterThan(0);
    expect(messages.some((m) => m.includes("pluie"))).toBe(true);
  });

  it("finit par se dissiper", () => {
    const state = startWild([arme(495, "mimi-queue")], arme(143, "mimi-queue", 60), sac());
    state.weather = { kind: "pluie", turns: 1 };
    const tour = playerMove(state, 0);
    expect(tour.state.weather).toBeUndefined();
    expect(tour.messages.some((m) => m.includes("redevient normal"))).toBe(true);
  });

  it("nourrit l'Eau et étouffe le Feu quand il pleut", () => {
    const degats = (temps: "pluie" | "soleil" | null, move: string) => {
      let total = 0;
      for (let i = 0; i < 200; i++) {
        const state = startWild([arme(495, move)], arme(143, "mimi-queue", 60), sac());
        if (temps) state.weather = { kind: temps, turns: 5 };
        const foe = state.foe;
        total += maxHp(foe) - playerMove(state, 0).state.foe.hp;
      }
      return total;
    };
    expect(degats("pluie", "hydrocanon")).toBeGreaterThan(degats(null, "hydrocanon"));
    expect(degats("pluie", "lance-flammes")).toBeLessThan(degats(null, "lance-flammes"));
  });

  it("fait l'inverse au soleil", () => {
    const degats = (temps: "soleil" | null, move: string) => {
      let total = 0;
      for (let i = 0; i < 200; i++) {
        const state = startWild([arme(495, move)], arme(143, "mimi-queue", 60), sac());
        if (temps) state.weather = { kind: temps, turns: 5 };
        total += maxHp(state.foe) - playerMove(state, 0).state.foe.hp;
      }
      return total;
    };
    expect(degats("soleil", "lance-flammes")).toBeGreaterThan(degats(null, "lance-flammes"));
    expect(degats("soleil", "hydrocanon")).toBeLessThan(degats(null, "hydrocanon"));
  });

  it("ne touche pas aux types qu'elle ne concerne pas", () => {
    const degats = (temps: "pluie" | null) => {
      let total = 0;
      for (let i = 0; i < 300; i++) {
        const state = startWild([arme(495, "plaquage")], arme(143, "mimi-queue", 60), sac());
        if (temps) state.weather = { kind: temps, turns: 5 };
        total += maxHp(state.foe) - playerMove(state, 0).state.foe.hp;
      }
      return total;
    };
    const avec = degats("pluie");
    const sans = degats(null);
    // Le Normal ignore la pluie : à peu de choses près, le même total.
    expect(Math.abs(avec - sans) / sans).toBeLessThan(0.12);
  });
});

describe("la tempête de sable", () => {
  it("gratte ceux qu'elle n'épargne pas", () => {
    const mine = arme(495, "mimi-queue");
    const state = startWild([mine], arme(143, "mimi-queue", 60), sac());
    state.weather = { kind: "sable", turns: 5 };
    const tour = playerMove(state, 0);
    expect(tour.state.party[0].hp).toBeLessThan(maxHp(mine));
    expect(tour.messages.some((m) => m.includes("sable"))).toBe(true);
  });

  it("épargne la Roche, le Sol et l'Acier", () => {
    // Racaillou est Roche et Sol : le sable ne lui fait rien.
    const mine = arme(74, "mimi-queue", 40);
    const state = startWild([mine], arme(143, "mimi-queue", 60), sac());
    state.weather = { kind: "sable", turns: 5 };
    const tour = playerMove(state, 0);
    expect(tour.state.party[0].hp).toBe(maxHp(mine));
  });
});

describe("les nouvelles attaques", () => {
  it("rendent le contrecoup à qui frappe fort", () => {
    const mine = arme(497, "damocles", 60);
    const avant = mine.hp;
    const { state, messages } = duel(mine, arme(143, "mimi-queue", 70));
    expect(state.party[0].hp).toBeLessThan(avant);
    expect(messages.some((m) => m.includes("contrecoup"))).toBe(true);
    // La déclaration du catalogue et l'effet concordent.
    expect(MOVES.damocles.recoil).toBeGreaterThan(0);
  });

  it("rendent des PV à qui vole l'énergie", () => {
    const mine = arme(497, "vol-vie", 60);
    mine.hp = Math.floor(maxHp(mine) / 2);
    const avant = mine.hp;
    const { state, messages } = duel(mine, arme(143, "mimi-queue", 70));
    expect(state.party[0].hp).toBeGreaterThan(avant);
    expect(messages.some((m) => m.includes("absorbe"))).toBe(true);
  });

  it("ne font pas dépasser le maximum en volant", () => {
    const mine = arme(497, "vol-vie", 60);
    const { state } = duel(mine, arme(143, "mimi-queue", 70));
    expect(state.party[0].hp).toBeLessThanOrEqual(maxHp(mine));
  });

  it("frappent de deux à cinq fois, et le disent", () => {
    const comptes = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const { messages } = duel(arme(497, "furie", 60), arme(143, "mimi-queue", 70));
      const ligne = messages.find((m) => m.includes("Touché"));
      if (ligne) comptes.add(Number(ligne.match(/\d+/)?.[0]));
    }
    expect(comptes.size).toBeGreaterThan(1);
    for (const n of comptes) {
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it("frappent plus fort à plusieurs coups qu'à un seul", () => {
    const total = (move: string) => {
      let somme = 0;
      for (let i = 0; i < 300; i++) {
        const foe = arme(143, "mimi-queue", 80);
        somme += maxHp(foe) - duel(arme(497, move, 60), foe).state.foe.hp;
      }
      return somme;
    };
    // Furie ne vaut que 18 de puissance, mais elle frappe trois fois et demie
    // en moyenne : elle doit dépasser une Charge à 50.
    expect(total("furie")).toBeGreaterThan(total("charge"));
  });
});
