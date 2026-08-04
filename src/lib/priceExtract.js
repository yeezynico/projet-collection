/**
 * Relève les annonces dans un texte copié depuis une fiche Cardmarket.
 *
 * Le site bloquant toute lecture automatisée, l'utilisateur copie la page
 * (Ctrl+A / Ctrl+C) et la colle dans l'application.
 */

/**
 * Montant au format français : « 1.000,00 € », « 920,00 € ».
 * Le séparateur de milliers est le point ou l'espace insécable — surtout
 * pas l'espace ordinaire, qui collerait la note du vendeur au prix
 * (« PSA 9  800,00 € » deviendrait 9800,00 €).
 */
const PRICE_RE = /(\d{1,3}(?:[.  ]\d{3})*|\d+),(\d{2})\s*€/;
const PRICE_RE_G = new RegExp(PRICE_RE.source, "g");

/** En-tête du tableau des vendeurs : tout ce qui suit relève des annonces. */
const LISTINGS_MARKER = /\bVendeur\b/i;

/**
 * Libellés des statistiques précédant les annonces. Ancré en début de ligne :
 * un « de » au fil d'une description de vendeur ne doit pas déclencher le filtre.
 */
const STAT_LABELS =
  /^\s*(De|Tendance des prix|Prix moyen|Prix minimum|Depuis)\b/i;

const CONDITION_RE = /\b(MT|NM|EX|GD|LP|PL|PO)\b/;

function toNumber(match) {
  const whole = match[1].replace(/[.  ]/g, "");
  const value = parseFloat(`${whole}.${match[2]}`);
  return Number.isFinite(value) && value > 0 && value < 1000000 ? value : null;
}

/** Premier montant d'une ligne. */
function firstPrice(line) {
  const m = line.match(PRICE_RE);
  return m ? toNumber(m) : null;
}

/** Résumé lisible d'une ligne d'annonce, sans le prix ni les compteurs. */
function cleanLabel(line) {
  return line
    .replace(PRICE_RE_G, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s|\t]+|[\s|\t]+$/g, "")
    .slice(0, 60)
    .trim();
}

/**
 * Extrait les annonces avec leur contexte (vendeur, état) afin que
 * l'utilisateur voie à quoi chaque montant correspond.
 */
export function extractListings(text) {
  if (!text) return [];

  // On ignore l'en-tête statistique en repartant du tableau des vendeurs.
  const marker = text.match(LISTINGS_MARKER);
  const body = marker ? text.slice(marker.index + marker[0].length) : text;

  const lines = body.split(/\r?\n/);
  const listings = [];

  for (const line of lines) {
    // Le marqueur a déjà écarté l'en-tête : le filtre par libellé ne sert
    // qu'en secours, quand la structure de la page n'a pas été reconnue.
    if (!marker && STAT_LABELS.test(line)) continue;

    const value = firstPrice(line);
    if (value == null) continue;

    listings.push({
      value,
      label: cleanLabel(line),
      condition: (line.match(CONDITION_RE) || [])[1] || null,
    });
  }

  // Collage sans retours à la ligne : on retombe sur une simple liste de montants.
  if (listings.length === 0) {
    PRICE_RE_G.lastIndex = 0;
    let m;
    while ((m = PRICE_RE_G.exec(body)) !== null) {
      const value = toNumber(m);
      if (value != null) listings.push({ value, label: "", condition: null });
    }
  }

  return listings;
}

/** Moyenne arrondie au centime. */
export function average(values) {
  if (!values?.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}
