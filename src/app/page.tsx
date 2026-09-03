import Console from "@/components/Console";
import { fetchIndex, type IndexEntry } from "@/lib/pokeapi";

// L'index change au rythme des nouvelles générations : une révision par semaine suffit.
export const revalidate = 604800;

export default async function Home() {
  let index: IndexEntry[] = [];
  try {
    index = await fetchIndex();
  } catch {
    // La PokéAPI est injoignable au rendu : le client retentera au montage.
  }

  return (
    <main className="page">
      <Console index={index} />
      <p className="page__credit">
        <span className="page__tip">
          Glissez la coque pour la déplacer · molette pour zoomer · double-clic
          pour recentrer —{" "}
        </span>
        données &amp; sprites :{" "}
        <a href="https://pokeapi.co" target="_blank" rel="noreferrer">
          PokéAPI
        </a>
      </p>
    </main>
  );
}
