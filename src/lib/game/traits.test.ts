import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  NATURES,
  abilityName,
  abilityOf,
  abilityRules,
  abilityWorks,
  natureMult,
  natureName,
  type Boostable,
} from "./traits";
import { ABILITY_FR, DEX } from "./dex";
import {
  createMon,
  inflict,
  maxHp,
  playerMove,
  startWild,
  statOf,
  type Mon,
} from "./battle";
import { emptyBag, type Bag } from "./items";

const sac = (over: Partial<Bag> = {}): Bag => ({ ...emptyBag(), ...over });
const solide = (id: number, level = 50) => createMon(id, level, false);
const STATS: Boostable[] = ["atk", "def", "spa", "spd", "spe"];

describe("les natures", () => {
  it("sont vingt-cinq, toutes nommées", () => {
    expect(NATURES).toHaveLength(25);
    for (const n of NATURES) expect(n.name.length).toBeGreaterThan(0);
    expect(new Set(NATURES.map((n) => n.name)).size).toBe(25);
  });

  it("relèvent une statistique et en rabaissent une autre, jamais la même", () => {
    for (const n of NATURES) {
      if (!n.up && !n.down) continue;
      expect(n.up, n.name).not.toBeNull();
      expect(n.down, n.name).not.toBeNull();
      expect(n.up, n.name).not.toBe(n.down);
    }
  });

  it("ne touchent qu'à ce qu'elles annoncent", () => {
    NATURES.forEach((n, i) => {
      for (const stat of STATS) {
        const attendu = n.up === stat ? 1.1 : n.down === stat ? 0.9 : 1;
        expect(natureMult(i, stat), `${n.name} sur ${stat}`).toBeCloseTo(attendu);
      }
    });
  });

  it("laissent les natures neutres tout à l'identique", () => {
    const neutres = NATURES.map((n, i) => (n.up ? -1 : i)).filter((i) => i >= 0);
    expect(neutres.length).toBeGreaterThan(0);
    for (const i of neutres) {
      for (const stat of STATS) expect(natureMult(i, stat)).toBe(1);
    }
  });

  it("se voient sur la statistique finale, jamais sur les PV", () => {
    const base = solide(495, 50);
    const rigide = { ...base, nature: NATURES.findIndex((n) => n.name === "Rigide") };
    const modeste = { ...base, nature: NATURES.findIndex((n) => n.name === "Modeste") };
    expect(statOf(rigide, "atk")).toBeGreaterThan(statOf(modeste, "atk"));
    expect(statOf(modeste, "spa")).toBeGreaterThan(statOf(rigide, "spa"));
    // Les PV échappent aux natures, comme dans les jeux.
    expect(maxHp(rigide)).toBe(maxHp(modeste));
  });

  it("retombent sur la neutre pour un rang inconnu", () => {
    expect(natureMult(999, "atk")).toBe(1);
    expect(natureName(999)).toBe(NATURES[0].name);
  });
});

describe("les talents relevés au Pokédex", () => {
  it("existent pour presque toutes les espèces, et sont traduits", () => {
    const ids = Object.keys(DEX).map(Number);
    const portes = ids.filter((id) => abilityOf(id));
    expect(portes.length).toBeGreaterThan(ids.length - 5);
    for (const id of portes) {
      expect(ABILITY_FR[abilityOf(id)!], `${id} sans traduction`).toBeDefined();
      expect(abilityName(id)).not.toBe("Aucun");
    }
  });

  it("annoncent honnêtement lesquels agissent", () => {
    // Bulbizarre a Engrais, qui agit ; son talent doit être reconnu comme tel.
    expect(abilityOf(1)).toBe("overgrow");
    expect(abilityWorks(1)).toBe(true);
    // Un talent hors de la table est nommé mais sans effet.
    const inerte = Object.keys(DEX)
      .map(Number)
      .find((id) => abilityOf(id) && !ABILITIES[abilityOf(id)!]);
    expect(inerte, "aucun talent inerte : la table couvre tout ?").toBeDefined();
    expect(abilityWorks(inerte!)).toBe(false);
    expect(abilityName(inerte!).length).toBeGreaterThan(0);
  });

  it("ne rendent aucune règle pour une espèce sans talent connu", () => {
    expect(abilityRules(999999)).toEqual({});
    expect(abilityName(999999)).toBe("Aucun");
  });
});

describe("les talents en combat", () => {
  const duel = (mine: Mon, foe: Mon) => playerMove(startWild([mine], foe, sac()), 0);

  it("empêchent l'altération qu'ils annoncent", () => {
    // Ronflex a Vaccin : rien ne l'empoisonne.
    const ronflex = solide(143);
    expect(abilityOf(143)).toBe("immunity");
    expect(inflict(ronflex, "poison", true, [])).toBe(false);
    // Mais il brûle très bien.
    expect(inflict(ronflex, "brulure", true, [])).toBe(true);
  });

  it("rendent insensible à un type entier", () => {
    // Tartard n'a pas Lévitation ; Fantominus si.
    expect(abilityRules(92).immune).toBe("ground");
    const fantominus = solide(92);
    fantominus.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
    const attaquant = solide(495, 50);
    attaquant.moves = [{ id: "tunnel", pp: 30, max: 30 }];
    const { state, messages } = duel(attaquant, fantominus);
    expect(state.foe.hp).toBe(maxHp(fantominus));
    expect(messages.some((m) => m.includes("affecte pas"))).toBe(true);
  });

  it("font frapper plus fort le dos au mur", () => {
    const degats = (pv: number) => {
      let total = 0;
      for (let i = 0; i < 250; i++) {
        // Herbizarre a Engrais : sous un tiers, ses attaques Plante enflent.
        const mine = solide(2, 50);
        mine.moves = [{ id: "lame-feuille", pp: 30, max: 30 }];
        mine.hp = Math.max(1, Math.floor(maxHp(mine) * pv));
        const foe = solide(143, 50);
        foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
        total += maxHp(foe) - duel(mine, foe).state.foe.hp;
      }
      return total;
    };
    expect(abilityOf(2)).toBe("overgrow");
    expect(degats(0.2)).toBeGreaterThan(degats(1));
  });

  it("ripostent à qui frappe au corps à corps", () => {
    // Pikachu a Statik : le frapper physiquement peut paralyser.
    expect(abilityRules(25).contact?.status).toBe("paralysie");
    let paralyse = false;
    for (let i = 0; i < 120 && !paralyse; i++) {
      const mine = solide(495, 50);
      mine.moves = [{ id: "plaquage", pp: 30, max: 30 }];
      const foe = solide(25, 40);
      foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
      const { state } = duel(mine, foe);
      if (state.party[0].status === "paralysie") paralyse = true;
    }
    expect(paralyse, "Statik n'a jamais riposté en cent vingt coups").toBe(true);
  });

  it("laissent survivre à un coup fatal depuis le maximum", () => {
    // Pomdepik a Fermeté — Racaillou, lui, porte Tête de Roc.
    expect(abilityRules(204).sturdy).toBe(true);
    // Une attaque qui ne rate jamais : Hydrocanon manque une fois sur cinq
    // et laisserait la cible intacte, ce qui n'a rien à voir avec Fermeté.
    const mine = solide(497, 80);
    mine.moves = [{ id: "plaquage", pp: 30, max: 30 }];
    const foe = solide(204, 5);
    foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
    const { state, messages } = duel(mine, foe);
    expect(state.foe.hp).toBe(1);
    expect(messages.some((m) => m.includes("tient bon"))).toBe(true);
  });

  it("font de l'altération une force pour qui a Cran", () => {
    const degats = (altere: boolean) => {
      let total = 0;
      for (let i = 0; i < 250; i++) {
        // Machoc a Cran : brûlé, il frappe plus fort au lieu de faiblir.
        const mine = solide(66, 50);
        mine.moves = [{ id: "balayage", pp: 30, max: 30 }];
        if (altere) mine.status = "brulure";
        const foe = solide(143, 50);
        foe.moves = [{ id: "mimi-queue", pp: 30, max: 30 }];
        total += maxHp(foe) - duel(mine, foe).state.foe.hp;
      }
      return total;
    };
    expect(abilityOf(66)).toBe("guts");
    expect(degats(true)).toBeGreaterThan(degats(false));
  });
});
