import { describe, expect, it } from "vitest";
import { MOVES, SPECIES, species } from "./data";
import { maxHp } from "./battle";
import {
  DREAM_LEVEL,
  STARTERS,
  counterStarter,
  dreamTeam,
  giveStarter,
  newGame,
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
