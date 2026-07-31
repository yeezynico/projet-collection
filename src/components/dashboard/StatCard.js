import { ArrowUp, ArrowDown } from "lucide-react";

export default function StatCard({
  label,
  value,
  change,
  icon: Icon,
  variant = "default",
}) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  let colorClass = "text-dark-400";
  if (!isNeutral) {
    colorClass = isPositive ? "text-green-400" : "text-red-400";
  }

  let bgGradient = "bg-dark-800/50";
  if (variant === "primary") {
    bgGradient = "bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10";
  }

  return (
    <div
      className={`${bgGradient} backdrop-blur border border-dark-700 rounded-xl p-6 hover:border-dark-600 transition`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-dark-400 text-sm font-medium mb-2">{label}</p>
          <p className="text-2xl lg:text-3xl font-bold text-dark-50 mb-2">
            {value}
          </p>
          {change !== undefined && change !== null && (
            <div className={`flex items-center gap-1 ${colorClass} text-sm`}>
              {!isNeutral && (
                <>
                  {isPositive ? (
                    <ArrowUp size={16} />
                  ) : (
                    <ArrowDown size={16} />
                  )}
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </>
              )}
              {isNeutral && <span className="text-dark-500">Neutre</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <Icon size={24} className="text-brand-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
