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
import { CARDMARKET_SETS } from "@/lib/cardmarketSets";
import { SET_CODE_TO_IDS } from "@/lib/pokemonSets";

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

/** Numéro exploitable pour un classement, les promos mises à part. */
function numericPart(localId) {
  const digits = String(localId).match(/\d+/);
  return digits ? parseInt(digits[0], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Marqueur de variante à insérer dans l'adresse, ou chaîne vide.
 *
 * Cardmarket numérote les cartes qui partagent un nom dans une même extension,
 * dans l'ordre croissant de leur numéro : le Zacian n°045 de Phantasmal Flames
 * est « -V1 », l'illustration rare n°100 est « -V2 ». Vérifié sur les six
 * adresses réelles dont nous disposons, dont le Lugia V de Tempête Argentée
 * qui est « -V3 » parce qu'un troisième Lugia V existe au numéro 185.
 *
 * Sans la liste des cartes de l'extension, aucun marqueur n'est produit :
 * mieux vaut une adresse sans variante qu'une variante inventée.
 */
function variantMarker(cardName, localId, setCards) {
  if (!Array.isArray(setCards)) return "";

  const homonyms = setCards
    .filter((c) => c.name === cardName)
    .sort((a, b) => numericPart(a.localId) - numericPart(b.localId));

  if (homonyms.length < 2) return "";

  const rank = homonyms.findIndex((c) => c.localId === localId) + 1;
  return rank > 0 ? `-V${rank}` : "";
}

/**
 * Reconstruit l'adresse d'une fiche à partir des noms anglais.
 *
 * Cardmarket compose ses adresses ainsi : nom anglais de l'extension, nom
 * anglais de la carte, un éventuel marqueur de variante, puis le code
 * d'extension et le numéro — « MEP Black Star Promos » et « Oricorio ex »
 * donnant `MEP-Black-Star-Promos/Oricorio-ex-MEP024`.
 *
 * Le numéro porte parfois déjà le code (« SWSH301 »), auquel cas il suffit.
 *
 * Reste une reconstruction : elle n'est employée qu'à défaut de correspondance
 * connue, là où l'alternative est de n'avoir aucun lien.
 */
export function buildCardmarketUrl({
  cardName,
  setName,
  setId,
  localId,
  setCards,
}) {
  if (!cardName || !setName || !localId) return null;

  const { slug: setSlug, code } = cardmarketSetFor(setId, setName);

  const suffix = /[A-Za-z]/.test(localId) ? localId : `${code || ""}${localId}`;
  if (!/[A-Za-z]/.test(suffix)) return null;

  const variant = variantMarker(cardName, localId, setCards);

  return (
    "https://www.cardmarket.com/fr/Pokemon/Products/Singles/" +
    `${setSlug || slug(setName)}/${slug(cardName)}${variant}-${suffix}`
  );
}

/** Lettres seules, pour comparer un code au nom d'une extension. */
function letters(text) {
  return String(text || "").toLowerCase().replace(/[^a-z]/g, "");
}

/** Les lettres du code se retrouvent-elles dans l'ordre dans le nom ? */
function isSubsequence(code, name) {
  const target = letters(name);
  const needle = letters(code);
  let i = 0;
  for (const ch of target) if (ch === needle[i]) i++;
  return i === needle.length;
}

/**
 * Segment d'URL et code de suffixe d'une extension.
 *
 * La table relevée sur des adresses réelles fait autorité. Pour les extensions
 * trop récentes pour y figurer, le code est choisi parmi les candidats connus :
 * on écarte ceux qui contiennent des chiffres, puis on retient celui dont la
 * première lettre ouvre le nom de l'extension et dont les lettres s'y
 * retrouvent dans l'ordre — « POR » pour « Perfect Order », là où « ORP »,
 * l'autre candidat, ne correspond à rien.
 *
 * Cette règle retrouve 37 des 50 codes récents que la table permet de vérifier ;
 * elle échoue sur les Trainer Galleries et les promotions. C'est un repli, non
 * une source : les adresses ainsi composées sont annoncées comme reconstituées.
 */
export function cardmarketSetFor(setId, englishSetName) {
  const known = CARDMARKET_SETS[setId];
  if (known) return known;

  const candidates = Object.entries(SET_CODE_TO_IDS)
    .filter(([, ids]) => ids.includes(setId))
    .map(([code]) => code.replace(/:/g, ""));

  const alphabetic = candidates.filter((c) => /^[A-Za-z]+$/.test(c));
  const pool = alphabetic.length ? alphabetic : candidates;

  const score = (code) =>
    (letters(code)[0] === letters(englishSetName)[0] ? 4 : 0) +
    (isSubsequence(code, englishSetName) ? 2 : 0);

  const code =
    pool.length > 1
      ? [...pool].sort((a, b) => score(b) - score(a))[0]
      : (pool[0] ?? setCodeFor(setId));

  return { slug: null, code: code || null };
}
