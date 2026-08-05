/**
 * Liens de recherche vers les places de marché grand public.
 *
 * Cardmarket sert de référence de cotation ; eBay et Vinted permettent de
 * confronter cette cotation aux transactions réellement conclues.
 */

/**
 * Requête de recherche à partir d'un article de la collection.
 * Le numéro est déterminant : « Lugia V » seul ramène toutes les versions,
 * « Lugia V 186 » cible l'illustration alternative.
 */
export function buildSearchQuery(item, kind = "card") {
  if (!item?.name) return "";

  const parts = [item.name];

  if (kind === "card" && item.number) {
    parts.push(item.number);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * eBay, restreint aux annonces vendues et terminées : ce sont des prix
 * de transaction réels, et non des prix demandés par les vendeurs.
 */
export function ebaySoldUrl(query) {
  if (!query) return null;
  const params = new URLSearchParams({
    _nkw: query,
    LH_Sold: "1",
    LH_Complete: "1",
    _sop: "13", // les ventes les plus récentes d'abord
  });
  return `https://www.ebay.fr/sch/i.html?${params}`;
}

/** Vinted ne distingue pas les articles vendus : ce sont des offres en cours. */
export function vintedUrl(query) {
  if (!query) return null;
  const params = new URLSearchParams({ search_text: query });
  return `https://www.vinted.fr/catalog?${params}`;
}
