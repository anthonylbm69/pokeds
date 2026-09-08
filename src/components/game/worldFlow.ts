/**
 * Les écrans du monde : ce que la dalle du bas montre hors combat. Comme
 * `battleFlow`, tout est pur — on rend un écran à partir de l'état, sans
 * toucher à quoi que ce soit — pour que `useGame` ne garde que
 * l'enchaînement des phases.
 */

import { MOVES, TYPE_FR, expForLevel, species } from "@/lib/game/data";
import { STATUS_FR, maxHp, statOf, type Mon } from "@/lib/game/battle";
import {
  ITEMS,
  ITEM_ORDER,
  SHOP_STOCK,
  countOf,
  ctMove,
  effectOn,
  isHeld,
  type ItemId,
} from "@/lib/game/items";
import { abilityName, abilityWorks, natureName } from "@/lib/game/traits";
import { MOMENT_FR, momentNow } from "@/lib/game/heure";
import { BUS_STOPS, MAPS, type MapId } from "@/lib/game/world";
import {
  BOX_ORDER_FR,
  BIKE_PRICE,
  PARTY_MAX,
  STARTERS,
  SLOTS,
  hasFlag,
  towerFoe,
  towerReward,
  slotInfo,
  sortedBox,
  type BoxOrder,
  type GameState,
  type SlotInfo,
} from "@/lib/game/state";
import { itemHint, type BattleUi, type MonLine, type Screen } from "./battleFlow";
import type { Choice } from "./TouchPanel";

/** Ce qu'il faut faire une fois le dialogue terminé. */
export type Then =
  | { do: "starter" }
  | { do: "heal"; respawn: boolean }
  | { do: "trainer"; npc: string }
  | { do: "revanche"; npc: string }
  | { do: "tour" }
  | { do: "statique"; npc: string }
  | { do: "shop"; counter: "boutique" | "velo" }
  | { do: "world" };

export type Counter = "boutique" | "velo";

export type Phase =
  | { kind: "intro"; step: number }
  | { kind: "name" }
  | { kind: "world" }
  | { kind: "text"; lines: string[]; i: number; then: Then | null }
  | { kind: "starter" }
  | { kind: "carte" }
  | { kind: "bus" }
  | { kind: "voyage"; to: MapId; label: string }
  | { kind: "shop"; counter: Counter; message: string | null }
  | {
      kind: "sac";
      on: "objets" | "cible" | "oubli";
      item?: ItemId;
      /** Pokémon choisi, quand une Capsule attend qu'on lui fasse de la place. */
      cible?: number;
      message: string | null;
    }
  | { kind: "equipe" }
  | { kind: "fiche"; index: number }
  | { kind: "surnom"; mon: Mon }
  | { kind: "pc"; on: "menu" | "retirer" | "deposer" | "ordre"; message: string | null }
  | { kind: "tri" }
  | { kind: "sauvegarde"; message: string | null }
  | { kind: "tour" }
  | { kind: "carte-dresseur" }
  | { kind: "battle"; ui: BattleUi };

/** Les rayons, aux prix d'Unys. */
export const STOCK: Record<Counter, { id: string; label: string; price: number }[]> = {
  boutique: SHOP_STOCK.map((id) => ({ id, label: ITEMS[id].name, price: ITEMS[id].price })),
  velo: [{ id: "bike", label: "VÉLO", price: BIKE_PRICE }],
};

export const INTRO = [
  "Bonjour ! Bienvenue dans le monde des POKéMON !",
  "Je m'appelle Keteleeria. Mais tout le monde m'appelle le Professeur Pokémon.",
  "Ce monde est peuplé de créatures fabuleuses que l'on nomme Pokémon.",
  "Certaines personnes les élèvent, d'autres les affrontent… et d'autres, comme moi, les étudient.",
  "Et toi ? Quel genre de Dresseur vas-tu devenir ?",
  "Avant de commencer, dis-moi…",
];

export const BADGE_LABEL: Record<string, string> = {
  trio: "insigne Trio",
  sylve: "insigne Sylve",
  roc: "insigne Roc",
};

/**
 * L'écran du bas hors combat. `sacTotal` est passé plutôt que recalculé :
 * `useGame` le tient déjà pour la vignette du menu.
 */
export function worldScreen(
  phase: Phase,
  game: GameState,
  monLine: MonLine,
  sacTotal: number,
): Screen {

    if (phase.kind === "starter") {
      return {
        title: "Choisis ton premier Pokémon",
        hint: "◀ ▶ pour parcourir · A pour choisir",
        layout: "row",
        list: STARTERS.map((id) => ({ id: String(id), label: species(id).name })),
      };
    }

    if (phase.kind === "bus") {
      return {
        title: "Cars Faure",
        hint: "▲ ▼ pour choisir · A pour monter · B pour renoncer",
        layout: "list",
        list: [
          ...BUS_STOPS.filter((stop) => stop.map !== game.map).map((stop) => {
            const manquants = stop.badges.filter(
              (badge) => !hasFlag(game, `insigne:${badge}`),
            );
            return {
              id: stop.map,
              label: stop.label,
              sub: !manquants.length
                ? "desservi"
                : manquants.length === 1
                  ? `${BADGE_LABEL[manquants[0]]} exigé`
                  : `${manquants.length} insignes exigés`,
              disabled: manquants.length > 0,
              tone: (manquants.length ? "back" : "bag") as Choice["tone"],
            };
          }),
          { id: "leave", label: "RENONCER", tone: "back" },
        ],
      };
    }

    if (phase.kind === "voyage") {
      return {
        title: "Cars Faure",
        hint: "Trajet en cours…",
        layout: "row",
        list: [],
      };
    }

    if (phase.kind === "carte") {
      return {
        title: "Carte de la région",
        hint: "B ou START pour refermer",
        layout: "row",
        list: [{ id: "leave", label: "REFERMER", tone: "back" }],
      };
    }

    if (phase.kind === "shop") {
      const owned = (id: string) =>
        id === "bike"
          ? game.bike
            ? "déjà en selle"
            : "un seul suffit"
          : `vous en avez ${countOf(game.bag, id as ItemId)}`;
      return {
        title: phase.counter === "velo" ? "Cycles Maillard" : "Boutique",
        hint: "▲ ▼ pour choisir · A pour acheter · B pour sortir",
        layout: "list",
        list: [
          ...STOCK[phase.counter].map((item) => ({
            id: item.id,
            label: item.label,
            sub: `${item.price} P — ${owned(item.id)}`,
            disabled: game.money < item.price || (item.id === "bike" && game.bike),
            tone: "bag" as const,
          })),
          { id: "leave", label: "SORTIR", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "sac") {
      const back = { id: "back", label: "RETOUR", tone: "back" as const };
      if (phase.on === "oubli") {
        const item = phase.item ?? "potion";
        const mon = game.party[phase.cible ?? 0];
        const move = ctMove(item);
        return {
          title: `Quelle attaque oublier ?`,
          hint: `${mon?.name ?? ""} en connaît déjà quatre · B pour renoncer`,
          layout: "list",
          list: [
            ...(mon?.moves ?? []).map((m, i) => ({
              id: `oubli:${i}`,
              label: MOVES[m.id].name,
              sub: `${TYPE_FR[MOVES[m.id].type]} · ${
                MOVES[m.id].power ? `puissance ${MOVES[m.id].power}` : "statut"
              } · PP ${m.pp}/${m.max}`,
              tone: "fight" as const,
            })),
            {
              id: "back",
              label: `RENONCER À ${move ? MOVES[move].name.toUpperCase() : "LA CT"}`,
              tone: "back" as const,
            },
          ],
        };
      }

      if (phase.on === "cible") {
        const item = phase.item ?? "potion";
        const move = ctMove(item);
        // Un objet tenu se confie : on montre ce que chacun porte déjà.
        if (isHeld(item)) {
          return {
            title: `${ITEMS[item].name} — à qui ?`,
            hint: "▲ ▼ pour choisir · A pour confier · B pour revenir",
            layout: "list",
            list: [
              ...game.party.map((mon, i) => ({
                id: `mon:${i}`,
                ...monLine(mon),
                sub: mon.held ? `porte ${ITEMS[mon.held].name}` : "les mains vides",
                disabled: mon.held === item,
                tone: "party" as const,
              })),
              back,
            ],
          };
        }

        // Une Capsule ne soigne pas : elle enseigne, et tout le monde peut
        // l'apprendre sauf celui qui connaît déjà l'attaque.
        if (move) {
          return {
            title: `${MOVES[move].name} — à qui ?`,
            hint: "▲ ▼ pour choisir · A pour enseigner · B pour revenir",
            layout: "list",
            list: [
              ...game.party.map((mon, i) => ({
                id: `mon:${i}`,
                ...monLine(mon),
                sub: mon.moves.some((m) => m.id === move)
                  ? "la connaît déjà"
                  : `${mon.moves.length}/4 attaques`,
                disabled: mon.moves.some((m) => m.id === move),
                tone: "party" as const,
              })),
              back,
            ],
          };
        }
        return {
          title: `${ITEMS[item].name} sur qui ?`,
          hint: "▲ ▼ pour choisir · A pour utiliser · B pour revenir",
          layout: "list",
          list: [
            ...game.party.map((mon, i) => ({
              id: `mon:${i}`,
              ...monLine(mon),
              disabled: effectOn(item, mon).refus !== null,
              tone: "party" as const,
            })),
            back,
          ],
        };
      }
      const tenus = ITEM_ORDER.filter((id) => countOf(game.bag, id) > 0);
      return {
        title: "Sac",
        hint: "▲ ▼ pour choisir · A pour utiliser · B pour fermer",
        layout: "list",
        list: [
          ...tenus.map((id) => ({
            id,
            label: ITEMS[id].name,
            sub:
              ITEMS[id].kind === "ball"
                ? `× ${countOf(game.bag, id)} — seulement en combat`
                : `× ${countOf(game.bag, id)}${itemHint(id)}`,
            disabled: ITEMS[id].kind === "ball" || !game.party.length,
            tone: "bag" as const,
          })),
          ...(tenus.length ? [] : [{ id: "vide", label: "SAC VIDE", disabled: true, tone: "back" as const }]),
          { id: "leave", label: "FERMER", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "pc") {
      const back = { id: "back", label: "RETOUR", tone: "back" as const };
      if (phase.on === "retirer") {
        return {
          title: `Retirer du PC — ${BOX_ORDER_FR[game.boxOrder]}`,
          hint: "▲ ▼ pour choisir · A pour reprendre · Y pour trier · B pour revenir",
          layout: "list",
          list: [
            ...sortedBox(game.box, game.boxOrder).map((i) => ({
              id: `box:${i}`,
              ...monLine(game.box[i]),
              disabled: game.party.length >= PARTY_MAX,
              tone: "party" as const,
            })),
            back,
          ],
        };
      }
      if (phase.on === "deposer" || phase.on === "ordre") {
        const depot = phase.on === "deposer";
        return {
          title: depot ? "Déposer au PC" : "Mettre en tête",
          hint: `▲ ▼ pour choisir · A pour ${depot ? "déposer" : "placer"} · B pour revenir`,
          layout: "list",
          list: [
            ...game.party.map((mon, i) => ({
              id: `${depot ? "dep" : "tete"}:${i}`,
              ...monLine(mon),
              disabled: depot ? game.party.length <= 1 : i === 0,
              tone: "party" as const,
            })),
            back,
          ],
        };
      }
      return {
        title: `PC de ${game.name || "Dresseur"}`,
        hint: "▲ ▼ pour choisir · A pour valider · B pour fermer",
        layout: "list",
        list: [
          {
            id: "trier",
            label: "TRIER",
            sub: BOX_ORDER_FR[game.boxOrder],
            disabled: game.box.length < 2,
            tone: "plain" as const,
          },
          {
            id: "retirer",
            label: "RETIRER",
            sub: game.box.length ? `${game.box.length} au PC` : "le PC est vide",
            disabled: !game.box.length || game.party.length >= PARTY_MAX,
            tone: "party" as const,
          },
          {
            id: "deposer",
            label: "DÉPOSER",
            sub: `${game.party.length}/${PARTY_MAX} sur vous`,
            disabled: game.party.length <= 1,
            tone: "party" as const,
          },
          {
            id: "ordre",
            label: "METTRE EN TÊTE",
            sub: game.party[0] ? `${game.party[0].name} ouvre les combats` : "—",
            disabled: game.party.length <= 1,
            tone: "party" as const,
          },
          { id: "leave", label: "FERMER", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "equipe") {
      return {
        title: "Équipe",
        hint: "▲ ▼ pour choisir · A pour la fiche · B pour fermer",
        layout: "list",
        list: [
          ...game.party.map((mon, i) => ({
            id: `fiche:${i}`,
            ...monLine(mon),
            tone: "party" as const,
          })),
          { id: "leave", label: "FERMER", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "fiche") {
      const mon = game.party[phase.index];
      if (!mon) {
        return { title: "Fiche", hint: "B pour revenir", layout: "list", list: [] };
      }
      const socle = expForLevel(mon.level);
      const palier = expForLevel(mon.level + 1);
      return {
        title: `${mon.name}${mon.shiny ? " ✦" : ""}`,
        hint: "◀ ▶ pour changer de Pokémon · B pour revenir",
        layout: "list",
        list: [
          {
            id: "espece",
            label: `N.${mon.level} · ${species(mon.id).name}`,
            sub: `${species(mon.id).types.map((t) => TYPE_FR[t]).join(" / ")} — ${species(mon.id).genus}`,
            disabled: true,
            tone: "party" as const,
          },
          {
            id: "vitalite",
            label: `PV ${mon.hp} / ${maxHp(mon)}`,
            sub: mon.status
              ? `${STATUS_FR[mon.status]}`
              : `${Math.max(0, palier - mon.exp)} points d'exp. avant le niveau ${mon.level + 1}`,
            disabled: true,
            tone: "plain" as const,
          },
          {
            id: "stats",
            label: `Att ${statOf(mon, "atk")} · Déf ${statOf(mon, "def")} · Vit ${statOf(mon, "spe")}`,
            sub: `Att.Spé ${statOf(mon, "spa")} · Déf.Spé ${statOf(mon, "spd")} — exp. ${mon.exp - socle}`,
            disabled: true,
            tone: "plain" as const,
          },
          {
            id: "traits",
            label: `Nature ${natureName(mon.nature)} · ${abilityName(mon.id)}`,
            // Sur cent dix-huit talents, seule une poignée agit vraiment :
            // autant le dire plutôt que de laisser croire le contraire.
            sub: abilityWorks(mon.id)
              ? "talent actif en combat"
              : "talent sans effet dans ce jeu",
            disabled: true,
            tone: "plain" as const,
          },
          {
            id: "tenu",
            label: mon.held ? `Porte ${ITEMS[mon.held].name}` : "Ne porte rien",
            sub: mon.held ? "A pour le reprendre" : "confiez-lui un objet depuis le sac",
            disabled: !mon.held,
            tone: "bag" as const,
          },
          ...mon.moves.map((m, i) => ({
            id: `att:${i}`,
            label: MOVES[m.id].name,
            sub: `${TYPE_FR[MOVES[m.id].type]} · ${
              MOVES[m.id].power ? `puissance ${MOVES[m.id].power}` : "statut"
            } · PP ${m.pp}/${m.max}`,
            disabled: true,
            tone: "fight" as const,
          })),
          { id: "leave", label: "RETOUR", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "surnom") {
      return {
        title: `${phase.mon.name} vient d'être capturé`,
        hint: "Laissez vide pour garder son nom d'espèce",
        layout: "row",
        list: [{ id: "ok", label: "VALIDER", tone: "fight" }],
      };
    }

    if (phase.kind === "tour") {
      const suivant = towerFoe(game.towerRun);
      return {
        title: "Tour de Combat",
        hint: "A pour valider · B pour renoncer",
        layout: "list",
        list: [
          {
            id: "duel",
            label: game.towerRun ? `DUEL N°${game.towerRun + 1}` : "COMMENCER UNE SÉRIE",
            sub:
              `${suivant.name} · ${suivant.team} Pokémon niveau ${suivant.level} ` +
              `· ${towerReward(game.towerRun)} P`,
            disabled: !game.party.some((m) => m.hp > 0),
            tone: "fight" as const,
          },
          {
            id: "serie",
            label: `SÉRIE EN COURS : ${game.towerRun}`,
            sub: `meilleure série : ${game.towerBest}`,
            disabled: true,
            tone: "plain" as const,
          },
          { id: "leave", label: "RENONCER", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "carte-dresseur") {
      const insignes = game.flags.filter((f) => f.startsWith("insigne:")).length;
      const heures = Math.floor(game.played / 3600);
      const minutes = Math.floor((game.played % 3600) / 60);
      return {
        title: `Carte de ${game.name || "Dresseur"}`,
        hint: "B pour fermer",
        layout: "list",
        list: [
          {
            id: "temps",
            label: `Temps de jeu : ${heures} h ${String(minutes).padStart(2, "0")}`,
            sub: `${game.money} P en poche`,
            disabled: true,
            tone: "party" as const,
          },
          {
            id: "insignes",
            label: `${insignes} insigne${insignes > 1 ? "s" : ""}`,
            sub: hasFlag(game, "insigne:ligue") ? "Ligue Pokémon remportée" : "la Ligue vous attend",
            disabled: true,
            tone: "plain" as const,
          },
          {
            id: "dex",
            label: `${game.seen.length} espèces vues · ${game.caught.length} capturées`,
            sub: `${game.party.length} sur vous, ${game.box.length} au PC`,
            disabled: true,
            tone: "plain" as const,
          },
          {
            id: "duels",
            label: `${game.wins} duel${game.wins > 1 ? "s" : ""} remporté${game.wins > 1 ? "s" : ""}`,
            sub: game.towerBest
              ? `meilleure série à la Tour : ${game.towerBest}`
              : "la Tour de Combat vous attend",
            disabled: true,
            tone: "plain" as const,
          },
          { id: "leave", label: "FERMER", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "sauvegarde") {
      const decrire = (info: SlotInfo, slot: number) =>
        info
          ? `${info.name} · ${info.badges} insigne${info.badges > 1 ? "s" : ""} · ` +
            `${info.party} au sac · ${info.caught} espèces`
          : `emplacement ${slot} vide`;
      return {
        title: "Sauvegarde",
        hint: "▲ ▼ pour choisir · A pour valider · B pour fermer",
        layout: "list",
        list: [
          ...SLOTS.map((slot) => ({
            id: `slot:${slot}`,
            label: `ENREGISTRER EN ${slot}`,
            sub: decrire(slotInfo(slot), slot),
            tone: "party" as const,
          })),
          {
            id: "exporter",
            label: "EXPORTER UN FICHIER",
            sub: "à garder hors du navigateur",
            tone: "bag" as const,
          },
          {
            id: "importer",
            label: "IMPORTER UN FICHIER",
            sub: "remplace la partie en cours",
            tone: "bag" as const,
          },
          { id: "leave", label: "FERMER", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "tri") {
      return {
        title: "Ranger le PC",
        hint: "▲ ▼ pour choisir · A pour valider · B pour revenir",
        layout: "list",
        list: [
          ...(Object.keys(BOX_ORDER_FR) as BoxOrder[]).map((id) => ({
            id: `tri:${id}`,
            label: BOX_ORDER_FR[id].toUpperCase(),
            sub: id === game.boxOrder ? "en cours" : "",
            tone: "party" as const,
          })),
          { id: "back", label: "RETOUR", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "name") {
      return {
        title: "Ton nom",
        hint: "Tapez un nom puis validez",
        layout: "row",
        list: [{ id: "ok", label: "VALIDER", tone: "fight" }],
      };
    }

    if (phase.kind === "intro" || phase.kind === "text") {
      return {
        title: phase.kind === "intro" ? "Introduction" : MAPS[game.map].name,
        hint: "A pour continuer",
        layout: "row",
        list: [],
      };
    }

    return {
      title: MAPS[game.map].name,
      hint: game.bike
        ? `Croix pour marcher · B pour courir · L pour ${game.riding ? "descendre du" : "monter à"} vélo · A pour interagir`
        : "Croix pour marcher · B pour courir · A pour interagir",
      // Sept entrées : deux colonnes se lisent mieux qu'une rangée serrée.
      layout: "grid",
      list: [
        { id: "sac", label: "SAC", sub: `${sacTotal} objet${sacTotal > 1 ? "s" : ""}` },
        {
          id: "equipe",
          label: "ÉQUIPE",
          sub: game.party.length ? `${game.party.length} Pokémon` : "—",
          disabled: !game.party.length,
        },
        { id: "carte", label: "RÉGION", sub: MOMENT_FR[momentNow()] },
        { id: "dex", label: "POKÉDEX", sub: `${game.caught.length} capturés` },
        { id: "save", label: "SAUVER", sub: "X · emplacements et fichier" },
        { id: "music", label: "MUSIQUE", sub: game.music ? "activée" : "coupée" },
        {
          id: "suiveur",
          label: "SUIVEUR",
          sub: game.party.length ? (game.follower ? "au pied" : "au repos") : "—",
          disabled: !game.party.length,
        },
        {
          id: "carte-dresseur",
          label: "CARTE",
          sub: "votre bilan",
          tone: "plain" as const,
        },
        { id: "title", label: "TITRE", sub: "SELECT" },
      ],
    };
}
