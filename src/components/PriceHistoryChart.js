"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, List } from "lucide-react";

const RANGES = [
  { key: "1m", label: "1 M", days: 30 },
  { key: "3m", label: "3 M", days: 90 },
  { key: "6m", label: "6 M", days: 180 },
  { key: "1y", label: "1 A", days: 365 },
  { key: "5y", label: "5 A", days: 365 * 5 },
  { key: "all", label: "Tout", days: Infinity },
];

// Au-delà de ce nombre de points, on ne garde que la dernière valeur de
// chaque groupe pour rester lisible même après plusieurs années de suivi.
const MAX_RENDERED_POINTS = 48;

const DAY_MS = 24 * 60 * 60 * 1000;

const VB = { width: 640, height: 240 };
const PAD = { left: 52, right: 14, top: 16, bottom: 28 };

function formatEuro(value) {
  return `${value.toFixed(2)} €`;
}

function formatDateShort(date, spanDays) {
  return date.toLocaleDateString("fr-FR", {
    day: spanDays <= 120 ? "numeric" : undefined,
    month: "short",
    year: spanDays <= 120 ? undefined : "2-digit",
  });
}

function formatDateFull(date) {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Arrondit un pas d'axe à une valeur "propre" (1, 2 ou 5 × une puissance de 10). */
function niceStep(rawStep) {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const residual = rawStep / magnitude;
  let step;
  if (residual > 5) step = 10;
  else if (residual > 2) step = 5;
  else if (residual > 1) step = 2;
  else step = 1;
  return step * magnitude;
}

/** Garde au plus `max` points, en conservant la dernière valeur de chaque groupe. */
function downsample(points, max) {
  if (points.length <= max) return points;
  const bucketSize = Math.ceil(points.length / max);
  const kept = [];
  for (let i = 0; i < points.length; i += bucketSize) {
    kept.push(points[Math.min(i + bucketSize, points.length) - 1]);
  }
  const last = points[points.length - 1];
  if (kept[kept.length - 1] !== last) kept.push(last);
  return kept;
}

/**
 * Courbe d'évolution du prix d'un article, avec filtres de période.
 *
 * Ne fait qu'un seul appel réseau : toute la période est chargée d'un coup,
 * puis filtrée et sous-échantillonnée côté client au changement de plage.
 * Un seul point par jour est stocké en base (voir `src/lib/priceHistory.js`),
 * mais des années de suivi peuvent quand même dépasser ce que l'oeil peut
 * lire sur un graphique : `downsample` ramène ça à ~48 points visibles,
 * toujours ancrés sur la dernière valeur connue de chaque période.
 */
export default function PriceHistoryChart({ endpoint }) {
  const [allPoints, setAllPoints] = useState(null);
  const [error, setError] = useState(false);
  const [range, setRange] = useState("all");
  const [showTable, setShowTable] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  // Capturé une seule fois, au montage : sert de référence fixe pour les
  // filtres de période, sans dépendre d'un `Date.now()` évalué au rendu.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur");
        return res.json();
      })
      .then((rows) => {
        if (cancelled) return;
        setAllPoints(
          rows.map((r) => ({ date: new Date(r.date), price: r.price }))
        );
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const rangeDef = RANGES.find((r) => r.key === range);

  const filtered = useMemo(() => {
    if (!allPoints) return [];
    if (!Number.isFinite(rangeDef.days)) return allPoints;
    const cutoff = now - rangeDef.days * DAY_MS;
    const kept = allPoints.filter((p) => p.date.getTime() >= cutoff);
    // La plage ne doit jamais faire retomber à moins de deux points : sur
    // une carte suivie depuis longtemps mais jamais remise à jour
    // récemment, une période courte afficherait sinon un graphique vide ou
    // réduit à un point isolé.
    return kept.length >= 2 ? kept : allPoints;
  }, [allPoints, rangeDef, now]);

  const rendered = useMemo(
    () => downsample(filtered, MAX_RENDERED_POINTS),
    [filtered]
  );

  if (error) {
    return (
      <p className="text-sm text-dark-500 text-center py-6">
        Impossible de charger l&apos;historique des prix.
      </p>
    );
  }

  if (allPoints === null) {
    return <div className="h-[200px] flex items-center justify-center text-dark-600 text-sm">Chargement…</div>;
  }

  if (allPoints.length < 2) {
    return (
      <p className="text-sm text-dark-500 text-center py-6">
        Pas encore assez de prix enregistrés pour tracer une courbe. Modifiez
        le prix une nouvelle fois, à une autre date, pour commencer le suivi.
      </p>
    );
  }

  const spanDays =
    (rendered[rendered.length - 1].date.getTime() - rendered[0].date.getTime()) /
      DAY_MS || 1;

  const minTime = rendered[0].date.getTime();
  const maxTime = rendered[rendered.length - 1].date.getTime();
  const timeSpan = Math.max(maxTime - minTime, DAY_MS);

  const rawMin = Math.min(...rendered.map((p) => p.price));
  const rawMax = Math.max(...rendered.map((p) => p.price));
  const priceCushion = rawMax === rawMin ? Math.max(rawMax * 0.1, 1) : (rawMax - rawMin) * 0.12;
  const yMin = Math.max(0, rawMin - priceCushion);
  const yMax = rawMax + priceCushion;

  const innerWidth = VB.width - PAD.left - PAD.right;
  const innerHeight = VB.height - PAD.top - PAD.bottom;

  const scaleX = (time) => PAD.left + ((time - minTime) / timeSpan) * innerWidth;
  const scaleY = (price) =>
    PAD.top + innerHeight - ((price - yMin) / (yMax - yMin || 1)) * innerHeight;

  const linePath = rendered
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.date.getTime()).toFixed(1)} ${scaleY(p.price).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${scaleX(maxTime).toFixed(1)} ${PAD.top + innerHeight} L ${scaleX(minTime).toFixed(1)} ${PAD.top + innerHeight} Z`;

  const yStep = niceStep((yMax - yMin) / 3);
  const yTicks = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
    yTicks.push(v);
  }
  if (yTicks.length === 0) yTicks.push(yMin);

  const tickCount = 5;
  const xTicks = Array.from({ length: tickCount }, (_, i) => minTime + (timeSpan * i) / (tickCount - 1));

  const hovered = hoverIndex != null ? rendered[hoverIndex] : null;

  function handlePointerMove(e) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB.width;
    const time = minTime + ((x - PAD.left) / innerWidth) * timeSpan;
    let nearest = 0;
    let best = Infinity;
    rendered.forEach((p, i) => {
      const d = Math.abs(p.date.getTime() - time);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const first = rendered[0];
  const last = rendered[rendered.length - 1];
  const trend = last.price - first.price;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRange(r.key);
                setHoverIndex(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                range === r.key
                  ? "bg-brand-primary/15 border-brand-primary/40 text-brand-primary"
                  : "border-dark-700 text-dark-400 hover:text-dark-200 hover:border-dark-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          title={showTable ? "Voir le graphique" : "Voir en liste"}
          className="flex items-center justify-center w-7 h-7 rounded-lg border border-dark-700 text-dark-400 hover:text-dark-200 hover:border-dark-600 transition shrink-0"
        >
          {showTable ? <LineChart size={14} /> : <List size={14} />}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-[200px] overflow-y-auto surface rounded-xl divide-y divide-dark-800">
          {[...filtered].reverse().map((p) => (
            <div
              key={p.date.toISOString()}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="text-dark-400">{formatDateFull(p.date)}</span>
              <span className="font-semibold text-dark-50">{formatEuro(p.price)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${VB.width} ${VB.height}`}
            className="w-full h-[200px] touch-none"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={VB.width - PAD.right}
                  y1={scaleY(v)}
                  y2={scaleY(v)}
                  stroke="var(--color-dark-700)"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 8}
                  y={scaleY(v)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="10"
                  fill="var(--color-dark-500)"
                >
                  {v.toFixed(v < 10 ? 2 : 0)} €
                </text>
              </g>
            ))}

            {xTicks.map((t, i) => (
              <text
                key={i}
                x={scaleX(t)}
                y={VB.height - 8}
                textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
                fontSize="10"
                fill="var(--color-dark-500)"
              >
                {formatDateShort(new Date(t), spanDays)}
              </text>
            ))}

            <path d={areaPath} fill="url(#priceArea)" />
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-brand-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <circle
              cx={scaleX(last.date.getTime())}
              cy={scaleY(last.price)}
              r="4"
              fill="var(--color-brand-primary)"
              stroke="var(--color-dark-900)"
              strokeWidth="2"
            />

            {hovered && (
              <g>
                <line
                  x1={scaleX(hovered.date.getTime())}
                  x2={scaleX(hovered.date.getTime())}
                  y1={PAD.top}
                  y2={PAD.top + innerHeight}
                  stroke="var(--color-dark-500)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={scaleX(hovered.date.getTime())}
                  cy={scaleY(hovered.price)}
                  r="4"
                  fill="var(--color-brand-primary)"
                  stroke="var(--color-dark-900)"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {hovered && (
            <div
              className="absolute top-1 pointer-events-none surface rounded-lg px-2.5 py-1.5 shadow-xl text-xs whitespace-nowrap"
              style={{
                left: `${(scaleX(hovered.date.getTime()) / VB.width) * 100}%`,
                transform:
                  scaleX(hovered.date.getTime()) / VB.width > 0.7
                    ? "translateX(-100%)"
                    : "translateX(0%)",
              }}
            >
              <p className="text-dark-400">{formatDateFull(hovered.date)}</p>
              <p className="font-bold text-dark-50">{formatEuro(hovered.price)}</p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-dark-500 mt-2">
        {trend > 0.005 && (
          <span className="text-green-400">+{formatEuro(trend)}</span>
        )}
        {trend < -0.005 && (
          <span className="text-red-400">{formatEuro(trend)}</span>
        )}
        {Math.abs(trend) <= 0.005 && <span>Stable</span>}
        {" "}sur la période affichée · {rendered.length !== filtered.length ? `${filtered.length} prix enregistrés, ` : ""}
        du {formatDateFull(first.date)} au {formatDateFull(last.date)}
      </p>
    </div>
  );
}
