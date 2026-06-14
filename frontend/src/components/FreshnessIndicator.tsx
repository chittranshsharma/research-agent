'use client';

interface FreshnessIndicatorProps {
  score: number;       // 0-100
  ageDays: number;
  isStale: boolean;
  decayLabel: string;
}

export function FreshnessIndicator({
  score,
  ageDays,
  isStale,
  decayLabel,
}: FreshnessIndicatorProps) {
  const barColor =
    score > 70 ? '#22c55e' :  // green
    score > 40 ? '#eab308' :  // yellow
    score > 20 ? '#f97316' :  // orange
    '#ef4444';                 // red

  return (
    <div className="flex items-center gap-2 mt-1">
      {/* Freshness bar */}
      <div
        className="flex-none h-1 bg-gray-800 rounded-full overflow-hidden"
        style={{ width: '80px' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${score}%`, backgroundColor: barColor }}
        />
      </div>

      {/* Label */}
      <span className="text-xs font-medium" style={{ color: barColor }}>
        {decayLabel}
      </span>

      {/* Age */}
      <span className="text-xs text-gray-600">
        {ageDays === 0
          ? 'today'
          : ageDays === 1
          ? '1d ago'
          : `${ageDays}d ago`}
      </span>

      {/* Stale warning */}
      {isStale && (
        <span className="text-xs text-orange-500 flex items-center gap-1">
          ⚠ Refresh recommended
        </span>
      )}
    </div>
  );
}
