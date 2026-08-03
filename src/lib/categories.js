export const CARD_CATEGORIES = [
  { value: "Promo", label: "Promo" },
  { value: "Rare", label: "Illustration Rare" },
  { value: "Alt Art", label: "Illustration Rare Spéciale / Alt Art" },
  { value: "Gold", label: "Gold" },
  { value: "EX", label: "EX" },
  { value: "GX", label: "GX" },
  { value: "V", label: "V" },
  { value: "VMAX", label: "VMAX" },
  { value: "VSTAR", label: "VSTAR" },
  { value: "Full Art", label: "Full Art" },
  { value: "Rainbow", label: "Rainbow" },
];

export const SEALED_TYPES = [
  { value: "ETB", label: "ETB (Elite Trainer Box)" },
  { value: "Display", label: "Display (36 boosters)" },
  { value: "Coffret", label: "Coffret spécial" },
  { value: "Bundle", label: "Bundle" },
  { value: "Booster", label: "Booster" },
  { value: "Autre", label: "Autre" },
];

// `cmId` correspond au paramètre `language` des URLs Cardmarket.
export const LANGUAGES = [
  { value: "FR", label: "Français", flag: "🇫🇷", cmId: 2 },
  { value: "EN", label: "Anglais", flag: "🇬🇧", cmId: 1 },
  { value: "JP", label: "Japonais", flag: "🇯🇵", cmId: 7 },
  { value: "DE", label: "Allemand", flag: "🇩🇪", cmId: 3 },
  { value: "ES", label: "Espagnol", flag: "🇪🇸", cmId: 4 },
  { value: "IT", label: "Italien", flag: "🇮🇹", cmId: 5 },
  { value: "PT", label: "Portugais", flag: "🇵🇹", cmId: 8 },
  { value: "KR", label: "Coréen", flag: "🇰🇷", cmId: 10 },
];

// `cmId` correspond au paramètre `minCondition` des URLs Cardmarket.
export const CONDITIONS = [
  { value: "MT", label: "Mint", short: "MT", cmId: 1, tone: "emerald" },
  { value: "NM", label: "Near Mint", short: "NM", cmId: 2, tone: "green" },
  { value: "EX", label: "Excellent", short: "EX", cmId: 3, tone: "lime" },
  { value: "GD", label: "Good", short: "GD", cmId: 4, tone: "yellow" },
  { value: "LP", label: "Light Played", short: "LP", cmId: 5, tone: "orange" },
  { value: "PL", label: "Played", short: "PL", cmId: 6, tone: "red" },
  { value: "PO", label: "Poor", short: "PO", cmId: 7, tone: "rose" },
];

// Classes Tailwind explicites (le JIT ne peut pas générer des noms construits).
export const CONDITION_STYLES = {
  MT: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  NM: "bg-green-500/15 text-green-300 border-green-500/30",
  EX: "bg-lime-500/15 text-lime-300 border-lime-500/30",
  GD: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  LP: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  PL: "bg-red-500/15 text-red-300 border-red-500/30",
  PO: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function getLanguage(value) {
  return LANGUAGES.find((l) => l.value === value) || null;
}

export function getCondition(value) {
  return CONDITIONS.find((c) => c.value === value) || null;
}
