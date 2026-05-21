import { useState, useMemo } from 'react';
import { avatarUrl } from '../lib/sleeper.jsx';
import { generateRivalryNarrative } from '../lib/analytics.jsx';

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

function RecordBar({ winsA, winsB }) {
  const total = winsA + winsB;
  if (total === 0) return null;
  const pctA = (winsA / total) * 100;
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 99, overflow: 'hidden', gap: 1, minWidth: 80 }}>
      <div style={{ width: `${pctA}%`, background: 'var(--blue)' }} />
      <div style={{ width: `${100 - pctA}%`, background: 'var(--red)' }} />
    </div>
  );
}

export default function Rivalries({ h2h, rosterMap, games }) {
  const [expanded, setExpanded] = useState(null);
  const [sortBy, setSortBy] = useState('games');

  const rivalries = useMemo(() => {
    if (!h2h || !rosterMap) return [];
    return Object.values(h2h)
      .filter((rec) => rec.totalGames >= 1)
      .map((rec) => ({
        ...rec,
        narrative: generateRivalryNarrative(rec, rosterMap),
        nameA: rosterMap[rec.teamAId]?.displayName || `Team ${rec.teamAId}`,
        nameB: rosterMap[rec.teamBId]?.displayName || `Team ${rec.teamBId}`,
        avatarA: rosterMap[rec.teamAId]?.avatar,
        avatarB: rosterMap[rec.teamBId]?.avatar,
        winsA: rec.wins[rec.teamAId] || 0,
        winsB: rec.wins[rec.teamBId] || 0,
        imbalance: Math.abs((rec.wins[rec.teamAId] || 0) - (rec.wins[rec.teamBId] || 0)),
      }))
      .sort((a, b) => {
        if (sortBy === 'games') return b.totalGames - a.totalGames;
        if (sortBy === 'margin') return a.avgMargin - b.avgMargin;
        if (sortBy === 'dominant') return b.imbalance - a.imbalance;
        return 0;
      });
  }, [h2h, rosterMap, sortBy]);

  if (rivalries.length === 0) {
    return <div className="loading-screen"><p>No rivalry data yet.</p></div>;
  }

  const toggle = (key) => setExpanded(expanded === key ? null : key);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Rivalries</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['games', 'Most Games'], ['margin', 'Closest'], ['dominant', 'Most Lopsided']].map(([val, label]) => (
            <button key={val} className={`week-btn${sortBy === val ? ' active' : ''}`} onClick={() => setSortBy(val)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rivalry-list">
        {rivalries.map((rec) => {
          const key = `${rec.teamAId}_${rec.teamBId}`;
          const isOpen = expanded === key;

          return (
            <div key={key} className="rivalry-row">
              <div className="rivalry-header" onClick={() => toggle(key)}>
                <div className="rivalry-teams">
                  <Avatar avatar={rec.avatarA} name={rec.nameA} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.nameA}</span>
                  <span className="rivalry-vs">vs</span>
                  <Avatar avatar={rec.avatarB} name={rec.nameB} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.nameB}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="rivalry-record">
                      <span style={{ color: rec.winsA >= rec.winsB ? 'var(--green)' : 'var(--text2)' }}>{rec.winsA}</span>
                      <span style={{ color: 'var(--text3)', margin: '0 4px' }}>-</span>
                      <span style={{ color: rec.winsB >= rec.winsA ? 'var(--green)' : 'var(--text2)' }}>{rec.winsB}</span>
                    </div>
                    <RecordBar winsA={rec.winsA} winsB={rec.winsB} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{rec.totalGames} games</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                      avg margin: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{rec.avgMargin.toFixed(1)}</span>
                    </span>
                  </div>

                  <span className={`rivalry-expand-icon${isOpen ? ' open' : ''}`}>▼</span>
                </div>
              </div>

              <div className="rivalry-narrative" style={{ padding: '0 16px 12px', display: 'block' }}>
                {rec.narrative}
              </div>

              {isOpen && (
                <div className="rivalry-games">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    {rec.closestGame && (
                      <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          🎯 Closest Game
                        </div>
                        <GameSnippet game={rec.closestGame} rosterMap={rosterMap} />
                      </div>
                    )}
                    {rec.biggestBlowout && (
                      <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          💀 Biggest Blowout
                        </div>
                        <GameSnippet game={rec.biggestBlowout} rosterMap={rosterMap} />
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    All Games
                  </div>
                  {rec.games
                    .sort((a, b) => a.season === b.season ? a.week - b.week : a.season - b.season)
                    .map((game, i) => {
                      const t1 = rosterMap[game.team1Id] || { displayName: `Team ${game.team1Id}` };
                      const t2 = rosterMap[game.team2Id] || { displayName: `Team ${game.team2Id}` };
                      const t1Win = game.team1Points >= game.team2Points;
                      return (
                        <div key={i} className="rivalry-game-row">
                          <span className="rivalry-game-week">
                            {game.season ? `${game.season} ` : ''}Wk {game.week}
                          </span>
                          <span className={`rivalry-game-score ${t1Win ? 'rivalry-game-winner' : 'rivalry-game-loser'}`}>
                            {t1.displayName}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text2)', margin: '0 6px' }}>
                            {game.team1Points.toFixed(1)} – {game.team2Points.toFixed(1)}
                          </span>
                          <span className={`rivalry-game-score ${!t1Win ? 'rivalry-game-winner' : 'rivalry-game-loser'}`}>
                            {t2.displayName}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text3)', marginLeft: 'auto' }}>
                            Δ{Math.abs(game.team1Points - game.team2Points).toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GameSnippet({ game, rosterMap }) {
  const t1 = rosterMap[game.team1Id] || { displayName: `Team ${game.team1Id}` };
  const t2 = rosterMap[game.team2Id] || { displayName: `Team ${game.team2Id}` };
  const t1Win = game.team1Points >= game.team2Points;
  const margin = Math.abs(game.team1Points - game.team2Points).toFixed(1);
  return (
    <div>
      <div style={{ fontSize: '0.82rem' }}>
        <span style={{ color: t1Win ? 'var(--green)' : 'var(--text2)', fontWeight: t1Win ? 700 : 400 }}>{t1.displayName}</span>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', margin: '0 6px' }}>
          {game.team1Points.toFixed(1)}
        </span>
        <span style={{ color: 'var(--text3)' }}>–</span>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', margin: '0 6px' }}>
          {game.team2Points.toFixed(1)}
        </span>
        <span style={{ color: !t1Win ? 'var(--green)' : 'var(--text2)', fontWeight: !t1Win ? 700 : 400 }}>{t2.displayName}</span>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 2 }}>
        Wk {game.week}{game.season ? ` · ${game.season}` : ''} · margin {margin}
      </div>
    </div>
  );
}
