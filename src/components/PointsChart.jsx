import { useMemo, useState } from 'react';

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6',
  '#a855f7', '#64748b',
];

const REGULAR_SEASON_WEEKS = 14;

export default function PointsChart({ allMatchupsRaw, rosterMap }) {
  const [highlighted, setHighlighted] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const { series, weeks } = useMemo(() => {
    const weeks = [];
    const teamWeekScores = {};

    allMatchupsRaw.forEach(({ week, data }) => {
      if (week > REGULAR_SEASON_WEEKS) return;
      if (!data || data.length === 0) return;
      weeks.push(week);
      data.forEach((entry) => {
        if (!teamWeekScores[entry.roster_id]) teamWeekScores[entry.roster_id] = {};
        teamWeekScores[entry.roster_id][week] = entry.points || 0;
      });
    });

    const sortedWeeks = [...new Set(weeks)].sort((a, b) => a - b);
    const rosterIds = Object.keys(teamWeekScores);

    const series = rosterIds.map((id, i) => ({
      rosterId: id,
      displayName: rosterMap[id]?.displayName || `Team ${id}`,
      color: PALETTE[i % PALETTE.length],
      scores: sortedWeeks.map((w) => teamWeekScores[id][w] ?? null),
    }));

    return { series, weeks: sortedWeeks };
  }, [allMatchupsRaw, rosterMap]);

  if (weeks.length === 0) {
    return <div className="loading-screen"><p>No points data yet.</p></div>;
  }

  // SVG dimensions
  const W = 860;
  const H = 340;
  const PADDING = { top: 20, right: 20, bottom: 36, left: 52 };
  const chartW = W - PADDING.left - PADDING.right;
  const chartH = H - PADDING.top - PADDING.bottom;

  const allScores = series.flatMap((s) => s.scores.filter((v) => v !== null));
  const minScore = Math.floor(Math.min(...allScores) / 10) * 10;
  const maxScore = Math.ceil(Math.max(...allScores) / 10) * 10;

  const xScale = (i) => (i / (weeks.length - 1)) * chartW;
  const yScale = (v) => chartH - ((v - minScore) / (maxScore - minScore)) * chartH;

  const buildPath = (scores) => {
    const points = scores
      .map((s, i) => (s !== null ? `${xScale(i)},${yScale(s)}` : null))
      .filter(Boolean);
    if (points.length < 2) return '';
    return 'M ' + points.join(' L ');
  };

  const yTicks = [];
  const step = Math.round((maxScore - minScore) / 5 / 10) * 10 || 10;
  for (let v = minScore; v <= maxScore; v += step) yTicks.push(v);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Weekly Points</h2>
        <span className="badge badge-blue">Regular Season (Wks 1–{REGULAR_SEASON_WEEKS})</span>
      </div>

      <div className="card">
        <div className="chart-legend">
          {series.map((s) => (
            <button
              key={s.rosterId}
              className={`legend-item${highlighted !== null && highlighted !== s.rosterId ? ' dimmed' : ''}`}
              onClick={() => setHighlighted(highlighted === s.rosterId ? null : s.rosterId)}
            >
              <span className="legend-dot" style={{ background: s.color }} />
              {s.displayName}
            </button>
          ))}
        </div>

        <div className="chart-wrap">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', maxWidth: W, display: 'block' }}
            onMouseLeave={() => setTooltip(null)}
          >
            <g transform={`translate(${PADDING.left},${PADDING.top})`}>
              {/* Grid lines */}
              {yTicks.map((v) => (
                <g key={v}>
                  <line
                    x1={0} x2={chartW}
                    y1={yScale(v)} y2={yScale(v)}
                    stroke="var(--border)" strokeWidth={1}
                  />
                  <text
                    x={-8} y={yScale(v) + 4}
                    textAnchor="end"
                    fill="var(--text3)"
                    fontSize={11}
                    fontFamily="var(--mono)"
                  >
                    {v}
                  </text>
                </g>
              ))}

              {/* X axis labels */}
              {weeks.map((w, i) => (
                <text
                  key={w}
                  x={xScale(i)}
                  y={chartH + 20}
                  textAnchor="middle"
                  fill="var(--text3)"
                  fontSize={11}
                >
                  {w}
                </text>
              ))}
              <text x={chartW / 2} y={chartH + 34} textAnchor="middle" fill="var(--text3)" fontSize={11}>Week</text>

              {/* Lines */}
              {series.map((s) => {
                const isHighlighted = highlighted === null || highlighted === s.rosterId;
                return (
                  <path
                    key={s.rosterId}
                    d={buildPath(s.scores)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={isHighlighted ? 2.5 : 1}
                    opacity={isHighlighted ? 1 : 0.15}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Dots + hover targets */}
              {series.map((s) => {
                const isHighlighted = highlighted === null || highlighted === s.rosterId;
                return s.scores.map((score, i) => {
                  if (score === null) return null;
                  return (
                    <circle
                      key={`${s.rosterId}-${i}`}
                      cx={xScale(i)}
                      cy={yScale(score)}
                      r={isHighlighted ? 4 : 2.5}
                      fill={s.color}
                      opacity={isHighlighted ? 1 : 0.15}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => {
                        setTooltip({
                          x: xScale(i) + PADDING.left,
                          y: yScale(score) + PADDING.top,
                          name: s.displayName,
                          score,
                          week: weeks[i],
                          color: s.color,
                        });
                      }}
                    />
                  );
                });
              })}
            </g>

            {/* Tooltip */}
            {tooltip && (
              <g transform={`translate(${Math.min(tooltip.x + 12, W - 140)},${Math.max(tooltip.y - 30, 4)})`}>
                <rect x={0} y={0} width={130} height={52} rx={6} fill="var(--bg3)" stroke="var(--border)" strokeWidth={1} />
                <text x={10} y={18} fill={tooltip.color} fontSize={11} fontWeight={700}>{tooltip.name}</text>
                <text x={10} y={34} fill="var(--text2)" fontSize={11}>Week {tooltip.week}</text>
                <text x={10} y={48} fill="var(--text)" fontSize={13} fontFamily="var(--mono)" fontWeight={600}>
                  {tooltip.score.toFixed(2)} pts
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
