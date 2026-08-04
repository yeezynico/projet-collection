/**
 * Conversion de devise via Frankfurter (taux de référence BCE, sans clé).
 * Utilisé pour les produits scellés, dont les seuls prix accessibles
 * sont en dollars sur le marché américain.
 */
const RATES_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR";

/** Taux de repli si l'API est indisponible, pour ne pas bloquer la recherche. */
const FALLBACK_USD_TO_EUR = 0.87;

export async function getUsdToEur() {
  try {
    const res = await fetch(RATES_URL, { next: { revalidate: 43200 } });
    if (!res.ok) return { rate: FALLBACK_USD_TO_EUR, date: null, approximate: true };

    const data = await res.json();
    const rate = data?.rates?.EUR;

    if (typeof rate === "number" && rate > 0) {
      return { rate, date: data.date || null, approximate: false };
    }
  } catch {
    // réseau indisponible : on retombe sur le taux de repli
  }

  return { rate: FALLBACK_USD_TO_EUR, date: null, approximate: true };
}

export async function usdToEur(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const { rate, date, approximate } = await getUsdToEur();
  return { value: amount * rate, rate, date, approximate };
}
