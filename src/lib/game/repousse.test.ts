import { describe, expect, it } from "vitest";
import { STAT_FR, addEvs, evTotal, noEvs, type StatKey } from "./data";
import {
  BAIES,
  BAIE_EV,
  ITEMS,
  ITEM_ORDER,
  REPEL_STEPS,
  SHOP_STOCK,
  VITAMINES,
  VITAMINE_EV,
  emptyBag,
  isBaie,
  isRepousse,
  pocketOf,
  type Bag,
  type ItemId,
} from "./items";
import {
  REPEL_MAX,
  applyBaie,
  applyRepousse,
  applyVitamine,
  baieEffectOn,
  giveStarter,
  newGame,
  reviveGame,
  walkRepel,
  type GameState,
} from "./state";

const CLEFS = Object.keys(STAT_FR) as StatKey[];

const partie = (over: Partial<Bag> = {}): GameState => {
  const base = giveStarter(newGame("Anthony"), 495);
  return { ...base, bag: { ...base.bag, ...over } as Bag };
};

describe("les baies d'entraînement", () => {
  it("répondent une à une aux vitamines", () => {
    const parStat = (table: Record<string, { stat: StatKey }>) =>
      Object.values(table).map((v) => v.stat).sort();
    expect(parStat(BAIES)).toEqual(parStat(VITAMINES));
    expect(parStat(BAIES)).toEqual([...CLEFS].sort());
  });

  it("se vendent, et moins cher qu'une vitamine", () => {
    for (const id of Object.keys(BAIES) as ItemId[]) {
      expect(isBaie(id)).toBe(true);
      expect(SHOP_STOCK).toContain(id);
    }
    const uneBaie = ITEMS[Object.keys(BAIES)[0] as ItemId].price;
    const uneVitamine = ITEMS[Object.keys(VITAMINES)[0] as ItemId].price;
    expect(uneBaie).toBeLessThan(uneVitamine);
  });

  it("rabaissent la statistique qu'elles visent", () => {
    const base = partie({ "baie-tamato": 1 });
    const jeu: GameState = {
      ...base,
      party: [{ ...base.party[0], evs: addEvs(noEvs(), { atk: 40 }) }],
    };
    const { state, message } = applyBaie(jeu, "baie-tamato", 0);
    expect(state.party[0].evs.atk).toBe(40 - BAIE_EV);
    expect(state.bag["baie-tamato"]).toBe(0);
    expect(message).toContain(STAT_FR.atk);
  });

  it("ne descendent jamais sous zéro", () => {
    const base = partie({ "baie-tamato": 1 });
    const jeu: GameState = {
      ...base,
      party: [{ ...base.party[0], evs: addEvs(noEvs(), { atk: 4 }) }],
    };
    expect(applyBaie(jeu, "baie-tamato", 0).state.party[0].evs.atk).toBe(0);
  });

  it("refusent sur un Pokémon qui n'a rien travaillé", () => {
    const jeu = partie({ "baie-qualot": 1 });
    const { state, message } = applyBaie(jeu, "baie-qualot", 0);
    expect(state).toBe(jeu);
    expect(message).toContain("rien travaillé");
  });

  it("refusent sans rien dépenser quand le sac est vide", () => {
    const jeu = partie({ "baie-grepa": 0 });
    const { state, message } = applyBaie(jeu, "baie-grepa", 0);
    expect(state).toBe(jeu);
    expect(message).toContain("Vous n'avez plus");
  });

  it("se disent en clair avant d'être mangées", () => {
    const base = partie();
    const entraine = { ...base.party[0], evs: addEvs(noEvs(), { spe: 20 }) };
    expect(baieEffectOn("baie-pomroz", entraine)).toEqual({ stat: "spe", refus: null });
    expect(baieEffectOn("potion", entraine).refus).toContain("pas une baie");
    expect(baieEffectOn("baie-pomroz", undefined).refus).toContain("Aucun Pokémon");
  });

  it("défont bien ce qu'une vitamine avait fait", () => {
    // Aller-retour complet : on revient exactement là d'où l'on est parti.
    const base = partie({ proteine: 1, "baie-tamato": 1 });
    const monte = applyVitamine(base, "proteine", 0);
    expect(monte.state.party[0].evs.atk).toBe(VITAMINE_EV);
    const redescendu = applyBaie(monte.state, "baie-tamato", 0);
    expect(redescendu.state.party[0].evs.atk).toBe(0);
    expect(evTotal(redescendu.state.party[0].evs)).toBe(0);
  });
});

describe("la Repousse", () => {
  it("existe en deux forces, la plus chère tenant plus longtemps", () => {
    expect(isRepousse("repousse")).toBe(true);
    expect(isRepousse("super-repousse")).toBe(true);
    expect(isRepousse("potion")).toBe(false);
    expect(REPEL_STEPS["super-repousse"]).toBeGreaterThan(REPEL_STEPS.repousse);
    expect(ITEMS["super-repousse"].price).toBeGreaterThan(ITEMS.repousse.price);
  });

  it("part à zéro dans une partie neuve", () => {
    expect(newGame("Anthony").repel).toBe(0);
  });

  it("pose son compte de pas et se consomme", () => {
    const jeu = partie({ repousse: 2 });
    const { state, message } = applyRepousse(jeu, "repousse");
    expect(state.repel).toBe(REPEL_STEPS.repousse);
    expect(state.bag.repousse).toBe(1);
    expect(message).toContain("distance");
  });

  it("ne se cumule pas : une seule agit à la fois", () => {
    const jeu = partie({ repousse: 2 });
    const posee = applyRepousse(jeu, "repousse").state;
    const encore = applyRepousse(posee, "repousse");
    expect(encore.state).toBe(posee);
    expect(encore.message).toContain("agit déjà");
    expect(encore.state.bag.repousse).toBe(1);
  });

  it("refuse sans rien dépenser quand le sac est vide", () => {
    const jeu = partie({ repousse: 0 });
    const { state, message } = applyRepousse(jeu, "repousse");
    expect(state).toBe(jeu);
    expect(message).toContain("Vous n'avez plus");
  });

  it("refuse poliment ce qui n'est pas une Repousse", () => {
    expect(applyRepousse(partie(), "potion").message).toContain("pas une Repousse");
  });

  it("s'épuise d'un pas à la fois, et prévient à la fin", () => {
    let jeu: GameState = { ...partie(), repel: 3 };
    const dits: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const pas = walkRepel(jeu);
      jeu = pas.state;
      dits.push(pas.message);
    }
    expect(jeu.repel).toBe(0);
    expect(dits.slice(0, 2)).toEqual([null, null]);
    expect(dits[2]).toContain("dissipé");
  });

  it("ne dit plus rien une fois épuisée", () => {
    const jeu: GameState = { ...partie(), repel: 0 };
    const pas = walkRepel(jeu);
    expect(pas.state).toBe(jeu);
    expect(pas.message).toBeNull();
  });

  it("tient jusqu'au bout de son compte", () => {
    let jeu: GameState = { ...partie(), repel: REPEL_STEPS["super-repousse"] };
    for (let i = 0; i < REPEL_STEPS["super-repousse"] - 1; i++) {
      jeu = walkRepel(jeu).state;
      expect(jeu.repel).toBeGreaterThan(0);
    }
    expect(walkRepel(jeu).state.repel).toBe(0);
  });

  it("survit à un rechargement", () => {
    const jeu: GameState = { ...partie(), repel: 42 };
    expect(reviveGame(JSON.parse(JSON.stringify(jeu)))!.repel).toBe(42);
  });

  it("repart à zéro pour une partie d'avant", () => {
    const brut = JSON.parse(JSON.stringify(partie())) as Record<string, unknown>;
    delete brut.repel;
    expect(reviveGame(brut)!.repel).toBe(0);
  });

  it("borne un compteur bricolé à la main", () => {
    const borne = (valeur: unknown) => {
      const brut = JSON.parse(JSON.stringify(partie())) as Record<string, unknown>;
      brut.repel = valeur;
      return reviveGame(brut)!.repel;
    };
    expect(borne(-5)).toBe(0);
    expect(borne(999_999)).toBe(REPEL_MAX);
    expect(borne("beaucoup")).toBe(0);
    expect(borne(12.7)).toBe(12);
  });
});

describe("les nouvelles poches", () => {
  it("rangent la baie avec les soins et la Repousse avec les objets", () => {
    expect(pocketOf("baie-tamato")).toBe("soins");
    expect(pocketOf("repousse")).toBe("objets");
  });

  it("entrent dans un sac neuf à zéro", () => {
    const sac = emptyBag();
    for (const id of [...Object.keys(BAIES), "repousse", "super-repousse"] as ItemId[]) {
      expect(sac[id], `${id}`).toBe(0);
      expect(ITEM_ORDER, `${id} hors du rayon`).toContain(id);
    }
  });
});
