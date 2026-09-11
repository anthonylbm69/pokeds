import { describe, expect, it } from "vitest";
import { MOVES, SPECIES, species } from "./data";
import { createMon, maxHp } from "./battle";
import { CT_MOVES, ITEMS, SHOP_STOCK, ctId, emptyBag, isCT, needsTarget } from "./items";
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
  applyPP,
  RELEARN_PRICE,
  relearnMove,
  relearnable,
  followerLine,
  teachMove,
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

describe("les répliques du suiveur", () => {
  const solide = (id: number, level = 30) => createMon(id, level, false);

  it("répondent quelque chose pour chaque espèce du Pokédex", () => {
    for (const id of [1, 25, 133, 151, 448, 497, 649]) {
      const lignes = followerLine(solide(id));
      expect(lignes.length, `${id} muet`).toBeGreaterThan(0);
      for (const l of lignes) expect(l.length).toBeGreaterThan(0);
    }
  });

  it("nomment le Pokémon, surnom compris", () => {
    const mon = { ...solide(25), name: "Pikou" };
    expect(followerLine(mon)[0]).toContain("Pikou");
  });

  it("signalent un Pokémon au tapis plutôt que son humeur", () => {
    const mon = solide(25);
    mon.hp = 0;
    expect(followerLine(mon).join(" ")).toContain("Centre");
  });

  it("signalent une altération", () => {
    const mon = solide(25);
    mon.status = "poison";
    expect(followerLine(mon).join(" ")).toContain("empoisonné");
  });

  it("s'inquiètent quand il est bas, avant de parler d'humeur", () => {
    const mon = solide(25);
    mon.hp = 1;
    expect(followerLine(mon).join(" ")).toContain("patte");
  });

  it("changent de ton selon le type", () => {
    // Un Feu et un Eau ne disent pas la même chose en pleine forme.
    expect(followerLine(solide(498))[0]).not.toBe(followerLine(solide(501))[0]);
  });
});

describe("les Capsules Techniques", () => {
  const avec = (moves: string[], potions = 0) => {
    const mon = createMon(495, 40, false);
    mon.moves = moves.map((id) => ({ id: id as never, pp: 10, max: 10 }));
    return { ...newGame("Test"), party: [mon], bag: { ...emptyBag(), potion: potions } };
  };
  const ct = ctId("lance-flammes");

  it("apprennent une attaque quand il reste de la place", () => {
    const avant = { ...avec(["charge"]), bag: { ...emptyBag(), [ct]: 1 } };
    const { state, message } = teachMove(avant, ct, 0, -1);
    expect(state.party[0].moves.map((m) => m.id)).toContain("lance-flammes");
    expect(message).toContain("apprend");
    // La Capsule se consomme.
    expect(state.bag[ct]).toBe(0);
  });

  it("remplacent celle que l'on désigne, et elle seule", () => {
    const avant = {
      ...avec(["charge", "griffe", "morsure", "picpic"]),
      bag: { ...emptyBag(), [ct]: 1 },
    };
    const { state, message } = teachMove(avant, ct, 0, 2);
    const ids = state.party[0].moves.map((m) => m.id);
    expect(ids).toEqual(["charge", "griffe", "lance-flammes", "picpic"]);
    expect(message).toContain("oublie");
    expect(message).toContain("Morsure");
  });

  it("refusent d'écraser au hasard quand les quatre sont prises", () => {
    const avant = {
      ...avec(["charge", "griffe", "morsure", "picpic"]),
      bag: { ...emptyBag(), [ct]: 1 },
    };
    const { state, message } = teachMove(avant, ct, 0, -1);
    expect(state).toBe(avant);
    expect(message).toContain("oublier");
  });

  it("ne se gaspillent pas sur qui connaît déjà l'attaque", () => {
    const avant = {
      ...avec(["lance-flammes"]),
      bag: { ...emptyBag(), [ct]: 1 },
    };
    const { state, message } = teachMove(avant, ct, 0, -1);
    expect(state).toBe(avant);
    expect(message).toContain("connaît déjà");
  });

  it("refusent sans Capsule en poche, ou sur un rang absent", () => {
    const sans = avec(["charge"]);
    expect(teachMove(sans, ct, 0, -1).state).toBe(sans);

    const avecCt = { ...avec(["charge"]), bag: { ...emptyBag(), [ct]: 1 } };
    expect(teachMove(avecCt, ct, 9, -1).state).toBe(avecCt);
  });

  it("ne s'appliquent qu'aux vraies Capsules", () => {
    const avant = { ...avec(["charge"]), bag: { ...emptyBag(), potion: 1 } };
    expect(teachMove(avant, "potion", 0, -1).message).toContain("pas une Capsule");
  });

  it("figurent au rayon, à un prix qui suit leur puissance", () => {
    expect(SHOP_STOCK).toContain(ct);
    expect(ITEMS[ct].teaches).toBe("lance-flammes");
    expect(ITEMS[ct].price).toBeGreaterThan(ITEMS.potion.price);
    // Une Capsule ne se pose pas sur un Pokémon comme un soin.
    expect(needsTarget(ct)).toBe(false);
    expect(isCT(ct)).toBe(true);
    expect(isCT("potion")).toBe(false);
  });

  it("n'enseignent que des attaques du catalogue", () => {
    for (const move of CT_MOVES) {
      expect(MOVES[move], `${move} inconnue`).toBeDefined();
      expect(ITEMS[ctId(move)].name).toContain(MOVES[move].name);
    }
    expect(new Set(CT_MOVES).size).toBe(CT_MOVES.length);
  });
});

describe("les objets de PP, au sac", () => {
  /** Une partie dont le premier Pokémon a le répertoire à sec. */
  const àSec = (item: "huile" | "elixir", combien = 1) => {
    const base = giveStarter(newGame("Anthony"), 495);
    const mon = base.party[0];
    return {
      ...base,
      bag: { ...base.bag, [item]: combien },
      party: [{ ...mon, moves: mon.moves.map((m) => ({ ...m, pp: 0 })) }],
    };
  };

  it("recharge l'attaque visée et consomme l'objet", () => {
    const avant = àSec("huile");
    const { state, message } = applyPP(avant, "huile", 0, 0);
    expect(state.party[0].moves[0].pp).toBeGreaterThan(0);
    expect(state.bag.huile).toBe(0);
    expect(message).toContain("retrouve des PP");
  });

  it("ne touche pas aux autres attaques", () => {
    const avant = àSec("huile");
    expect(avant.party[0].moves.length).toBeGreaterThan(1);
    const { state } = applyPP(avant, "huile", 0, 0);
    expect(state.party[0].moves[1].pp).toBe(0);
  });

  it("l'Élixir sert tout le répertoire d'un coup", () => {
    const avant = àSec("elixir");
    const { state, message } = applyPP(avant, "elixir", 0, 0);
    for (const m of state.party[0].moves) expect(m.pp).toBeGreaterThan(0);
    expect(message).toContain("retrouve ses PP");
  });

  it("refuse sans rien dépenser quand le sac est vide", () => {
    const avant = { ...àSec("huile"), bag: { ...àSec("huile").bag, huile: 0 } };
    const { state, message } = applyPP(avant, "huile", 0, 0);
    expect(state).toBe(avant);
    expect(message).toContain("Vous n'avez plus");
  });

  it("refuse sans rien dépenser sur un répertoire déjà plein", () => {
    const base = giveStarter(newGame("Anthony"), 495);
    const avant = { ...base, bag: { ...base.bag, elixir: 1 } };
    const { state, message } = applyPP(avant, "elixir", 0, 0);
    expect(state).toBe(avant);
    expect(state.bag.elixir).toBe(1);
    expect(message).toContain("déjà tous ses PP");
  });
});

describe("le Maître des Capacités", () => {
  const partie = (money = 5000) => {
    const base = giveStarter(newGame("Anthony"), 495);
    return { ...base, money, party: [{ ...base.party[0], level: 40 }] };
  };

  it("ne propose que des attaques inconnues du Pokémon", () => {
    const mon = partie().party[0];
    const connues = new Set(mon.moves.map((m) => m.id));
    for (const id of relearnable(mon)) {
      expect(connues.has(id)).toBe(false);
      expect(MOVES[id], `${id} inconnue`).toBeDefined();
    }
  });

  it("ne propose rien au-dessus du niveau atteint", () => {
    const bas = { ...partie().party[0], level: 2 };
    const haut = { ...bas, level: 60 };
    expect(relearnable(haut).length).toBeGreaterThanOrEqual(relearnable(bas).length);
  });

  it("apprend contre monnaie quand il reste de la place", () => {
    const avant = partie();
    const mon = { ...avant.party[0], moves: avant.party[0].moves.slice(0, 1) };
    const jeu = { ...avant, party: [mon] };
    const cible = relearnable(mon)[0];
    const { state, message } = relearnMove(jeu, 0, cible, -1);
    expect(state.party[0].moves.map((m) => m.id)).toContain(cible);
    expect(state.money).toBe(avant.money - RELEARN_PRICE);
    expect(message).toContain("retrouve");
  });

  it("échange une attaque quand les quatre emplacements sont pris", () => {
    const avant = partie();
    const plein = { ...avant.party[0] };
    while (plein.moves.length < 4) plein.moves = [...plein.moves, plein.moves[0]];
    const jeu = { ...avant, party: [{ ...plein, moves: plein.moves.slice(0, 4) }] };
    const cible = relearnable(jeu.party[0])[0];
    const perdue = jeu.party[0].moves[2].id;
    const { state, message } = relearnMove(jeu, 0, cible, 2);
    expect(state.party[0].moves).toHaveLength(4);
    expect(state.party[0].moves[2].id).toBe(cible);
    expect(message).toContain(MOVES[perdue].name);
  });

  it("réclame un choix d'oubli quand le répertoire est plein", () => {
    const avant = partie();
    const plein = { ...avant.party[0] };
    while (plein.moves.length < 4) plein.moves = [...plein.moves, plein.moves[0]];
    const jeu = { ...avant, party: [{ ...plein, moves: plein.moves.slice(0, 4) }] };
    const { state, message } = relearnMove(jeu, 0, relearnable(jeu.party[0])[0], -1);
    expect(state).toBe(jeu);
    expect(message).toContain("attaque à oublier");
  });

  it("refuse sans argent, et ne prélève rien", () => {
    const pauvre = partie(RELEARN_PRICE - 1);
    const { state, message } = relearnMove(pauvre, 0, relearnable(pauvre.party[0])[0], -1);
    expect(state).toBe(pauvre);
    expect(message).toContain("de quoi me payer");
  });

  it("refuse une attaque hors de portée du Pokémon", () => {
    const jeu = partie();
    const inconnue = (Object.keys(MOVES) as (keyof typeof MOVES)[]).find(
      (id) => !relearnable(jeu.party[0]).includes(id),
    )!;
    const { state, message } = relearnMove(jeu, 0, inconnue, -1);
    expect(state).toBe(jeu);
    expect(message).toContain("ne peut pas apprendre");
  });
});

describe("la Pension dans la partie", () => {
  it("commence vide, sans œuf en poche", () => {
    const jeu = newGame("Anthony");
    expect(jeu.daycare.mons).toEqual([]);
    expect(jeu.daycare.ready).toBeNull();
    expect(jeu.eggs).toEqual([]);
  });
});
