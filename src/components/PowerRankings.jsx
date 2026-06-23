import { useState, useMemo, useEffect } from 'react';
import { avatarUrl } from '../lib/sleeper.jsx';
import { getPlayedWeeks, computePowerRankings } from '../lib/powerRankings.jsx';

function Avatar({ avatar, name }) {
  const url = avatarUrl(avatar);
  if (url) return <img className="avatar" src={url} alt={name} />;
  return <div className="avatar-placeholder">{(name || '?')[0].toUpperCase()}</div>;
}

function Gauge({ value, size = 42, color, trackColor = 'var(--bg4)' }) {
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth="4" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color}
        strokeWidth="4"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  );
}

function GaugeStat({ value, label, color, size = 42 }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <Gauge value={value} size={size} color={color} />
      <span style={{
        position: 'absolute', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--mono)', color,
      }}>
        {label}
      </span>
    </div>
  );
}

function oddsColor(pct) {
  if (pct >= 60) return 'var(--green)';
  if (pct >= 25) return 'var(--gold)';
  return 'var(--red)';
}

function scoreColor(value) {
  if (value >= 67) return 'var(--green)';
  if (value >= 34) return 'var(--gold)';
  return 'var(--red)';
}

export default function PowerRankings({ games, rosterMap, league }) {
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const playoffSpots = league?.settings?.playoff_teams || 6;
  const regularSeasonEndWeek = (league?.settings?.playoff_week_start || 15) - 1;

  const regularSeasonGames = useMemo(
    () => games.filter((g) => g.week <= regularSeasonEndWeek),
    [games, regularSeasonEndWeek]
  );
  const playedWeeks = useMemo(() => getPlayedWeeks(regularSeasonGames), [regularSeasonGames]);
  const latestWeek = playedWeeks.length ? playedWeeks[playedWeeks.length - 1] : 0;
  const [week, setWeek] = useState(latestWeek);

  useEffect(() => {
    if (playedWeeks.length && !playedWeeks.includes(week)) {
      setWeek(playedWeeks[playedWeeks.length - 1]);
    }
  }, [playedWeeks]);

  const rankings = useMemo(
    () => (week ? computePowerRankings(regularSeasonGames, rosterMap, week, playoffSpots, regularSeasonEndWeek) : []),
    [regularSeasonGames, rosterMap, week, playoffSpots, regularSeasonEndWeek]
  );

  if (!playedWeeks.length) {
    return <div className="loading-screen"><p>Power Rankings appear once Week 1 games are played.</p></div>;
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Power Rankings</h2>
        <select
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            padding: '6px 10px',
            fontSize: '0.85rem',
          }}
        >
          {playedWeeks.map((w) => (
            <option key={w} value={w}>Through Week {w}</option>
          ))}
        </select>
      </div>

      {showScoreInfo && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
          marginBottom: 20,
        }}>
          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            How is Score calculated?
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.7 }}>
            Score is a 0–100 number blending three things, each ranked against the rest of the league:
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.7, marginTop: 8 }}>
            <strong style={{ color: 'var(--blue)' }}>Recent Form (40%)</strong> — your average points over the last 4 games. How hot are you right now?
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.7, marginTop: 4 }}>
            <strong style={{ color: 'var(--blue)' }}>Season PF/Game (30%)</strong> — your scoring average across the whole season.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.7, marginTop: 4 }}>
            <strong style={{ color: 'var(--blue)' }}>Quality of Wins (30%)</strong> — wins count for more when the team you beat had a good record.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.7, marginTop: 8 }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>Green</span> = top tier ·{' '}
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Yellow</span> = middle of the pack ·{' '}
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>Red</span> = bottom tier
          </p>
        </div>
      )}

      <div className="card standings-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Team</th>
              <th className="center">Trend</th>
              <th className="center">
                Score
                <button
                  onClick={() => setShowScoreInfo((s) => !s)}
                  style={{
                    display: 'block', margin: '2px auto 0', background: 'none', border: 'none',
                    color: 'var(--blue)', fontSize: '0.62rem', fontWeight: 600, textTransform: 'none',
                    letterSpacing: 0, cursor: 'pointer', padding: 0,
                  }}
                >
                  {showScoreInfo ? 'Hide formula ▲' : 'How? ▼'}
                </button>
              </th>
              <th className="right">
                SOS
                <div style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>
                  Opponent strength
                </div>
              </th>
              <th className="right">Playoff Odds</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((r) => (
              <tr key={r.rosterId}>
                <td><span className="rank-num">{r.rank}</span></td>
                <td>
                  <div className="team-cell">
                    <Avatar avatar={r.avatar} name={r.displayName} />
                    <span className="team-name">{r.displayName}</span>
                  </div>
                </td>
                <td className="center">
                  {r.trend === 0 ? (
                    <span style={{ color: 'var(--text3)' }}>—</span>
                  ) : (
                    <span style={{ color: r.trend > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {r.trend > 0 ? '▲' : '▼'} {Math.abs(r.trend)}
                    </span>
                  )}
                  <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>Last wk: #{r.prevRank}</div>
                </td>
                <td className="center">
                  <GaugeStat value={r.score} label={r.score} color={scoreColor(r.score)} />
                </td>
                <td className="right">
                  <span className="pts">
                    {(r.sosRestOfSeason ?? r.sosToDate ?? 0).toFixed(3)}
                  </span>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>
                    {r.sosRank ? `${r.sosRank}${r.sosRank === 1 ? 'st' : r.sosRank === 2 ? 'nd' : r.sosRank === 3 ? 'rd' : 'th'} hardest` : ''}
                  </div>
                </td>
                <td className="right">
                  <GaugeStat value={r.playoffOdds} label={`${r.playoffOdds}%`} color={oddsColor(r.playoffOdds)} size={40} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text3)' }}>
        Score blends recent form, season points, and quality of wins · SOS is opponent strength on the remaining schedule (falls back to schedule-to-date until future weeks are set) · Playoff odds via Monte Carlo simulation (3,000 runs)
      </p>
    </div>
  );
}
