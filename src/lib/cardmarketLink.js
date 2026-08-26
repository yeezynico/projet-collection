/**
 * Retrouve l'adresse Cardmarket d'une carte, sans jamais interroger
 * Cardmarket.
 *
 * pokemontcg.io tient une table de correspondance entre ses cartes et les
 * fiches produit de Cardmarket, et l'expose par une simple redirection. On lit
 * l'en-tête `Location` de leur serveur : l'adresse en sort telle qu'elle est,
 * suffixe de variante compris.
 *
 * Ce suffixe est la raison d'être de ce détour. Cardmarket écrit
 * « Lugia-V-V1-SIT138 » et « Lugia-V-V3-SIT186 » pour deux versions d'une même
 * carte, mais « Annihilape-SSP100 » sans suffixe pour une carte unique. Rien
 * dans les données de la carte ne permet de le deviner.
 */

import { TCGDEX_TO_PTCGIO } from "@/lib/ptcgioSets";
import { setIdOf, setCodeFor } from "@/lib/tcgdex";

const REDIRECT_BASE = "https://prices.pokemontcg.io/cardmarket";

/** Identifiant de la carte chez pokemontcg.io, sans zéros initiaux. */
export function ptcgioIdFor(cardId, localId) {
  const setId = setIdOf(cardId);
  if (!setId || !localId) return null;

  const mapped = TCGDEX_TO_PTCGIO[setId] || setId;
  return `${mapped}-${String(localId).replace(/^0+(?=.)/, "")}`;
}

/**
 * Répare un suffixe manifestement erroné, sans toucher au reste.
 *
 * La table de pokemontcg.io comporte quelques entrées fautives : le Primo-Groudon
 * EX de Primo-Choc y pointe vers `Primal-Groudon-EX-V2-OS` au lieu de
 * `…-V2-PRC151`. La réparation ne s'applique qu'en présence d'un marqueur de
 * variante (« -V2 »), lequel annonce un suffixe de code : si celui qui suit ne
 * contient pas le numéro de la carte, il est remplacé — le marqueur, lui, est
 * conservé, car il est précisément ce qu'on ne sait pas deviner.
 *
 * Les adresses sans marqueur ne sont jamais modifiées : « Celebrations/Lugia »
 * est correcte telle quelle, et lui accoler un code la casserait.
 */
function repairSuffix(pathname, setId, localId) {
  const code = setCodeFor(setId);
  if (!code || !localId) return pathname;

  const cut = pathname.lastIndexOf("/");
  const segment = pathname.slice(cut + 1);

  const parts = segment.match(/^(.*-V\d+)-([A-Za-z][A-Za-z0-9]*)$/);
  if (!parts) return pathname;

  const bare = String(localId).replace(/^0+(?=.)/, "");
  if (parts[2].includes(bare) || parts[2].includes(String(localId))) {
    return pathname;
  }

  return `${pathname.slice(0, cut + 1)}${parts[1]}-${code}${localId}`;
}

/**
 * Adresse française de la fiche, débarrassée du marquage publicitaire.
 * La redirection pointe vers la version anglaise du site.
 */
function toFrenchProductUrl(location, { setId, localId } = {}) {
  try {
    const url = new URL(location);
    if (!url.hostname.endsWith("cardmarket.com")) return null;

    url.hostname = "www.cardmarket.com";
    url.pathname = repairSuffix(
      url.pathname.replace(/^\/[a-z]{2}\//, "/fr/"),
      setId,
      localId
    );
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Adresse de la fiche produit, ou null si la carte n'est pas référencée.
 *
 * Le service répond parfois 502 tout en fournissant un `Location` correct :
 * l'en-tête est donc lu quel que soit le statut, et seule son absence après
 * plusieurs tentatives vaut échec.
 */
export async function resolveCardmarketUrl(cardId, localId, attempts = 3) {
  const id = ptcgioIdFor(cardId, localId);
  if (!id) return null;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${REDIRECT_BASE}/${id}`, {
        redirect: "manual",
        next: { revalidate: 604800 },
      });

      const location = res.headers.get("location");
      if (location) {
        return toFrenchProductUrl(location, {
          setId: setIdOf(cardId),
          localId,
        });
      }

      // 404 franc : la carte n'est pas dans leur table, inutile d'insister.
      if (res.status === 404) return null;
    } catch {
      // on retente
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }

  return null;
}


/** Segment d'URL Cardmarket : les espaces deviennent des tirets. */
function slug(text) {
  return String(text || "").trim().replace(/\s+/g, "-");
}

/**
 * Reconstruit l'adresse d'une fiche à partir des noms anglais.
 *
 * Cardmarket compose ses adresses ainsi : nom anglais de l'extension, nom
 * anglais de la carte, puis code d'extension et numéro — « MEP Black Star
 * Promos » et « Oricorio ex » donnant
 * `MEP-Black-Star-Promos/Oricorio-ex-MEP024`.
 *
 * Le numéro porte parfois déjà le code (« SWSH301 »), auquel cas il suffit.
 *
 * ⚠️ Approximation assumée : Cardmarket insère un suffixe de variante
 * (« -V1 », « -V3 ») quand plusieurs cartes partagent un nom dans une même
 * extension, et rien ne permet de le deviner. Cette reconstruction n'est donc
 * employée qu'à défaut de correspondance connue, là où l'alternative est de
 * n'avoir aucun lien.
 */
export function buildCardmarketUrl({ cardName, setName, setId, localId }) {
  if (!cardName || !setName || !localId) return null;

  const suffix = /[A-Za-z]/.test(localId)
    ? localId
    : `${setCodeFor(setId) || ""}${localId}`;

  if (!/[A-Za-z]/.test(suffix)) return null;

  return (
    "https://www.cardmarket.com/fr/Pokemon/Products/Singles/" +
    `${slug(setName)}/${slug(cardName)}-${suffix}`
  );
}
