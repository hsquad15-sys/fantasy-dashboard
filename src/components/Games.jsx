import { useState, useMemo } from 'react';
import { avatarUrl } from '../lib/sleeper.jsx';

const FILTERS = [
  { id: 'nailbiters', label: 'Nail-Biters', emoji: '😬', desc: 'Decided by < 5 pts' },
  { id: 'blowouts',   label: 'Blowouts',    emoji: '💀', desc: 'Decided by > 40 pts' },
  { id: 'highscoring',label: 'High Scoring', emoji: '🔥', desc: 'Combined > 330 pts'  },
  { id: 'lowscoring', label: 'Low Scoring',  emoji: '😴', desc: 'Combined < 200 pts'  },
];

function Avatar({ avatar, name, size = 28 }) {
  const url = avatarUrl(avatar);
  if (url) return <img style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} src={url} alt={name} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: 'var(--bg4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export default function Games({ games, rosterMap }) {
  const [filter, setFilter] = useState('nailbiters');

  const filtered = useMemo(() => {
    if (!games || !games.length) return [];
    return games
      .map((g) => ({
        ...g,
        margin: Math.abs(g.team1Points - g.team2Points),
        combined: g.team1Points + g.team2Points,
      }))
      .filter((g) => {
        if (filter === 'nailbiters')  return g.margin < 5;
        if (filter === 'blowouts')    return g.margin > 40;
        if (filter === 'highscoring') return g.combined > 330;
        if (filter === 'lowscoring')  return g.combined < 200;
        return true;
      })
      .sort((a, b) => {
        if (filter === 'nailbiters')  return a.margin - b.margin;
        if (filter === 'blowouts')    return b.margin - a.margin;
        if (filter === 'highscoring') return b.combined - a.combined;
        if (filter === 'lowscoring')  return a.combined - b.combined;
        return 0;
      });
  }, [games, filter]);

  const counts = useMemo(() => {
    if (!games) return {};
    const c = {};
    FILTERS.forEach(({ id }) => {
      c[id] = games.filter((g) => {
        const margin = Math.abs(g.team1Points - g.team2Points);
        const combined = g.team1Points + g.team2Points;
        if (id === 'nailbiters')  return margin < 5;
        if (id === 'blowouts')    return margin > 40;
        if (id === 'highscoring') return combined > 330;
        if (id === 'lowscoring')  return combined < 200;
        return false;
      }).length;
    });
    return c;
  }, [games]);

  const name = (id) => rosterMap[id]?.displayName || `Team ${id}`;
  const avatar = (id) => rosterMap[id]?.avatar;

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Games</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{filtered.length} games</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {FILTERS.map(({ id, label, emoji, desc }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: filter === id ? 'var(--purple)' : 'var(--bg3)',
              color: filter === id ? '#fff' : 'var(--text2)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{emoji}</span>
            {label}
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              background: filter === id ? 'rgba(255,255,255,0.2)' : 'var(--bg4)',
              color: filter === id ? '#fff' : 'var(--text3)',
              padding: '1px 7px',
              borderRadius: 99,
            }}>
              {counts[id] || 0}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="loading-screen"><p>No games match this filter.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((game, i) => {
            const t1Win = game.team1Points >= game.team2Points;
            const winner = t1Win ? game.team1Id : game.team2Id;
            const loser  = t1Win ? game.team2Id : game.team1Id;
            const winPts = t1Win ? game.team1Points : game.team2Points;
            const losPts = t1Win ? game.team2Points : game.team1Points;

            return (
              <div key={i} style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '0.72rem',
                  color: 'var(--text3)',
                  width: 70,
                  flexShrink: 0,
                }}>
                  {game.season ? `${game.season} ` : ''}Wk {game.week}
                </span>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Avatar avatar={avatar(winner)} name={name(winner)} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                      {name(winner)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--green)' }}>
                      {winPts.toFixed(2)}
                    </span>
                    <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>–</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: '1.05rem', color: 'var(--text3)' }}>
                      {losPts.toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text2)', textAlign: 'right' }}>
                      {name(loser)}
                    </span>
                    <Avatar avatar={avatar(loser)} name={name(loser)} />
                  </div>
                </div>

                <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 80 }}>
                  {filter === 'nailbiters' || filter === 'blowouts' ? (
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: filter === 'nailbiters' ? 'var(--green)' : 'var(--red)',
                      background: filter === 'nailbiters' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      padding: '3px 10px',
                      borderRadius: 99,
                    }}>
                      Δ {game.margin.toFixed(1)}
                    </span>
                  ) : (
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: filter === 'highscoring' ? 'var(--gold)' : 'var(--text3)',
                      background: filter === 'highscoring' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)',
                      padding: '3px 10px',
                      borderRadius: 99,
                    }}>
                      {game.combined.toFixed(1)} pts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
