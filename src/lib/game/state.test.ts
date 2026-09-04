import { describe, expect, it } from "vitest";
import { MOVES, SPECIES, species } from "./data";
import { createMon, maxHp } from "./battle";
import { emptyBag } from "./items";
import {
  DREAM_LEVEL,
  STARTERS,
  counterStarter,
  dreamTeam,
  giveStarter,
  newGame,
  PARTY_MAX,
  addCaught,
  applyItem,
  depositMon,
  leadMon,
  withdrawMon,
  withDreamTeam,
} from "./state";

describe("la dream team", () => {
  const team = dreamTeam();

  it("aligne six Pokémon au niveau prévu", () => {
    expect(team).toHaveLength(6);
    for (const mon of team) {
      expect(mon.level).toBe(DREAM_LEVEL);
      expect(SPECIES[mon.id], `espèce ${mon.id} inconnue`).toBeDefined();
      expect(mon.name).toBe(species(mon.id).name);
    }
  });

  it("les fournit à pleine forme et aux IV parfaits", () => {
    for (const mon of team) {
      expect(mon.hp).toBe(maxHp(mon));
      expect(Object.values(mon.ivs).every((iv) => iv === 31)).toBe(true);
      for (const slot of mon.moves) expect(slot.pp).toBe(slot.max);
    }
  });

  it("donne quatre attaques connues à chacun", () => {
    for (const mon of team) {
      expect(mon.moves, mon.name).toHaveLength(4);
      for (const slot of mon.moves) {
        expect(MOVES[slot.id], `${mon.name} : ${slot.id}`).toBeDefined();
      }
    }
  });

  it("laisse à chacun une attaque de son propre type", () => {
    for (const mon of team) {
      const types = species(mon.id).types;
      const stab = mon.moves.some((slot) => types.includes(MOVES[slot.id].type));
      expect(stab, `${mon.name} sans attaque de son type`).toBe(true);
    }
  });

  it("couvre un large éventail de types offensifs", () => {
    const types = new Set(
      team.flatMap((mon) => mon.moves.map((slot) => MOVES[slot.id].type)),
    );
    expect(types.size).toBeGreaterThanOrEqual(8);
  });

  it("n'aligne jamais deux fois la même espèce", () => {
    expect(new Set(team.map((mon) => mon.id)).size).toBe(6);
  });

  it("inscrit les nouveaux venus au Pokédex de la partie", () => {
    const before = newGame("Test");
    const after = withDreamTeam(before);
    for (const mon of after.party) {
      expect(after.seen).toContain(mon.id);
      expect(after.caught).toContain(mon.id);
    }
    // Le reste de la partie n'est pas touché.
    expect(after.money).toBe(before.money);
    expect(after.map).toBe(before.map);
  });
});

describe("le starter", () => {
  it("se retient pour l'Arène de Maillard", () => {
    const state = giveStarter(newGame("Test"), 495);
    expect(state.starter).toBe(495);
    expect(state.party).toHaveLength(1);
    expect(state.party[0].id).toBe(495);
  });

  it("appelle toujours le type qui le met en difficulté", () => {
    expect(counterStarter(495)).toBe(498);
    expect(counterStarter(498)).toBe(501);
    expect(counterStarter(501)).toBe(495);
    for (const id of STARTERS) {
      expect(STARTERS).toContain(counterStarter(id));
      expect(counterStarter(id)).not.toBe(id);
    }
  });
});

describe("le PC des Centres", () => {
  /** Une partie avec `n` Pokémon sur soi, tous en pleine forme. */
  const partie = (n: number) => ({
    ...newGame("Test"),
    party: Array.from({ length: n }, (_, i) => createMon(495 + i * 3, 10, false)),
  });

  it("accueille les captures quand l'équipe est pleine", () => {
    const plein = partie(PARTY_MAX);
    const pris = createMon(25, 8, false);
    pris.hp = 1;
    const apres = addCaught(plein, pris);
    expect(apres.party).toHaveLength(PARTY_MAX);
    expect(apres.box).toHaveLength(1);
    expect(apres.box[0].id).toBe(25);
    // Le PC ne garde que des Pokémon en forme.
    expect(apres.box[0].hp).toBe(maxHp(apres.box[0]));
    expect(apres.caught).toContain(25);
  });

  it("laisse la capture dans l'équipe tant qu'il reste de la place", () => {
    const apres = addCaught(partie(2), createMon(25, 8, false));
    expect(apres.party).toHaveLength(3);
    expect(apres.box).toHaveLength(0);
  });

  it("soigne le Pokémon que l'on dépose", () => {
    const avant = partie(3);
    avant.party[1].hp = 1;
    const nom = avant.party[1].name;
    const apres = depositMon(avant, 1);
    expect(apres.party).toHaveLength(2);
    expect(apres.box).toHaveLength(1);
    expect(apres.box[0].name).toBe(nom);
    expect(apres.box[0].hp).toBe(maxHp(apres.box[0]));
  });

  it("refuse de laisser le joueur les mains vides", () => {
    const seul = partie(1);
    expect(depositMon(seul, 0)).toBe(seul);
  });

  it("rend un Pokémon rangé, et refuse si l'équipe est pleine", () => {
    const range = depositMon(partie(3), 2);
    const repris = withdrawMon(range, 0);
    expect(repris.party).toHaveLength(3);
    expect(repris.box).toHaveLength(0);

    const plein = { ...partie(PARTY_MAX), box: [createMon(25, 8, false)] };
    expect(withdrawMon(plein, 0)).toBe(plein);
  });

  it("ignore un rang qui n'existe pas", () => {
    const trois = partie(3);
    expect(depositMon(trois, 9)).toBe(trois);
    expect(withdrawMon(trois, 0)).toBe(trois);
    expect(leadMon(trois, 9)).toBe(trois);
  });

  it("met un Pokémon en tête sans perdre les autres", () => {
    const avant = partie(3);
    const noms = avant.party.map((m) => m.name);
    const apres = leadMon(avant, 2);
    expect(apres.party[0].name).toBe(noms[2]);
    expect(apres.party.map((m) => m.name).sort()).toEqual([...noms].sort());
    // Le premier est déjà en tête : rien ne bouge.
    expect(leadMon(apres, 0)).toBe(apres);
  });
});

describe("le sac hors combat", () => {
  const blesse = () => {
    const state = {
      ...newGame("Test"),
      party: [createMon(495, 20, false)],
      bag: { ...emptyBag(), potion: 2, rappel: 1 },
    };
    state.party[0].hp = 1;
    return state;
  };

  it("rend des PV et consomme une Potion", () => {
    const avant = blesse();
    const { state, message } = applyItem(avant, "potion", 0);
    expect(state.bag.potion).toBe(1);
    expect(state.party[0].hp).toBe(21);
    expect(message).toContain("récupère");
  });

  it("ne dépasse jamais les PV maximum", () => {
    const avant = blesse();
    avant.party[0].hp = maxHp(avant.party[0]) - 3;
    const { state } = applyItem(avant, "potion", 0);
    expect(state.party[0].hp).toBe(maxHp(state.party[0]));
  });

  it("refuse sans Potion, sur un Pokémon intact, ou sur un rang absent", () => {
    const vide = { ...blesse(), bag: emptyBag() };
    expect(applyItem(vide, "potion", 0).state).toBe(vide);
    expect(applyItem(vide, "potion", 0).message).toContain("plus de Potion");

    const intact = blesse();
    intact.party[0].hp = maxHp(intact.party[0]);
    expect(applyItem(intact, "potion", 0).state).toBe(intact);
    expect(applyItem(intact, "potion", 0).message).toContain("tous ses PV");

    const absent = blesse();
    expect(applyItem(absent, "potion", 4).state).toBe(absent);
  });

  it("ne touche pas aux autres Pokémon de l'équipe", () => {
    const avant = { ...blesse(), party: [createMon(495, 20, false), createMon(498, 20, false)] };
    avant.party[0].hp = 1;
    avant.party[1].hp = 5;
    const { state } = applyItem(avant, "potion", 0);
    expect(state.party[1].hp).toBe(5);
  });
});
