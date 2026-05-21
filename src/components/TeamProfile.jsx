import { useEffect, useState, useRef } from 'react';
import { fetchPlayers, avatarUrl } from '../lib/sleeper.jsx';

function InfoTooltip({ text }) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 5 }}>
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--bg4)', color: 'var(--text3)',
          fontSize: '0.58rem', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'default', border: '1px solid var(--border)', flexShrink: 0,
        }}
      >
        i
      </button>
      {visible && (
        <div style={{
          position: 'absolute', top: '50%', right: 20,
          transform: 'translateY(-50%)',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 10px',
          whiteSpace: 'nowrap', zIndex: 999,
          fontSize: '0.72rem', color: 'var(--text2)',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];
const POSITION_COLORS = {
  QB:  '#f59e0b', RB: '#10b981', WR: '#3b82f6', TE: '#8b5cf6',
  K:   '#64748b', DEF: '#ef4444', DL: '#ef4444', LB: '#f97316', DB: '#06b6d4',
};

function Avatar({ avatar, name, size = 64 }) {
  const url = avatarUrl(avatar);
  if (url) return <img style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} src={url} alt={name} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function PosBadge({ pos }) {
  const color = POSITION_COLORS[pos] || 'var(--text3)';
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: `${color}22`, color, flexShrink: 0, minWidth: 28, textAlign: 'center' }}>
      {pos}
    </span>
  );
}

function computeCareerHigh(seasonsData) {
  let best = null;
  seasonsData.forEach(({ season, roster, allMatchupsRaw }) => {
    const rid = roster?.roster_id;
    if (!rid || !allMatchupsRaw) return;
    allMatchupsRaw.forEach(({ week, data }) => {
      const entry = data?.find((e) => String(e.roster_id) === String(rid));
      if (entry && entry.points > 0 && (!best || entry.points > best.points)) {
        best = { points: entry.points, week, season };
      }
    });
  });
  return best;
}

function computeLineupEfficiency(seasonsData) {
  let totalActual = 0, totalOptimal = 0;
  seasonsData.forEach(({ season, roster, allMatchupsRaw }) => {
    const rid = roster?.roster_id;
    if (!rid || !allMatchupsRaw) return;
    allMatchupsRaw.forEach(({ week, data }) => {
      if (week > 14) return; // regular season only
      const entry = data?.find((e) => String(e.roster_id) === String(rid));
      if (!entry?.players_points || !entry.starters?.length) return;
      const numStarters = entry.starters.length;
      const actual = entry.starters.reduce((sum, pid) => sum + (entry.players_points[pid] || 0), 0);
      const optimal = [...Object.values(entry.players_points)]
        .sort((a, b) => b - a)
        .slice(0, numStarters)
        .reduce((a, b) => a + b, 0);
      if (optimal > 0) { totalActual += actual; totalOptimal += optimal; }
    });
  });
  if (totalOptimal === 0) return null;
  return ((totalActual / totalOptimal) * 100).toFixed(1);
}

function computeNemesis(teamId, games, rosterMap) {
  const lossCounts = {};
  games.forEach((g) => {
    const isTeam1 = String(g.team1Id) === String(teamId);
    const isTeam2 = String(g.team2Id) === String(teamId);
    if (!isTeam1 && !isTeam2) return;
    const won = String(g.winnerId) === String(teamId);
    if (!won) {
      const opponentId = isTeam1 ? g.team2Id : g.team1Id;
      lossCounts[opponentId] = (lossCounts[opponentId] || 0) + 1;
    }
  });
  if (!Object.keys(lossCounts).length) return null;
  const nemesisId = Object.entries(lossCounts).sort((a, b) => b[1] - a[1])[0][0];
  return {
    name: rosterMap[nemesisId]?.displayName || `Team ${nemesisId}`,
    avatar: rosterMap[nemesisId]?.avatar,
    losses: lossCounts[nemesisId],
  };
}

export default function TeamProfile({ team, seasonsData, games, scheduleLuck, rosterMap, onClose }) {
  const [players, setPlayers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayers().then(setPlayers).catch(() => setPlayers({})).finally(() => setLoading(false));
  }, []);

  const buildRoster = (roster, playerData) => {
    if (!roster?.players || !playerData) return [];
    const starters = new Set(roster.starters || []);
    const taxi     = new Set(roster.taxi || []);
    const reserve  = new Set(roster.reserve || []);

    return roster.players
      .map((pid) => {
        const p = playerData[pid];
        if (!p) return null;
        return {
          id: pid,
          name: [p.first_name, p.last_name].filter(Boolean).join(' '),
          position: p.position || '?',
          team: p.team || 'FA',
          isStarter: starters.has(pid),
          isTaxi: taxi.has(pid),
          isIR: reserve.has(pid),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ai = POSITION_ORDER.indexOf(a.position);
        const bi = POSITION_ORDER.indexOf(b.position);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
  };

  const groupByPosition = (rosterPlayers) => {
    const groups = {};
    rosterPlayers.forEach((p) => {
      if (!groups[p.position]) groups[p.position] = [];
      groups[p.position].push(p);
    });
    return groups;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 560,
        background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)',
        overflowY: 'auto',
        animation: 'slideIn 0.2s ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar avatar={team.avatar} name={team.displayName} size={56} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{team.displayName}</h2>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--green)' }}>{team.wins}W</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--red)' }}>{team.losses}L</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text2)' }}>{team.pointsFor.toFixed(1)} PF</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text3)' }}>{team.pointsAgainst.toFixed(1)} PA</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text3)', fontSize: '1.2rem', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', background: 'var(--bg3)' }}
          >
            ✕
          </button>
        </div>

        {/* Stat sub-sections */}
        {(() => {
          const nemesis = games?.length ? computeNemesis(team.rosterId, games, rosterMap) : null;
          const luckEntry = scheduleLuck?.find((r) =>
            String(r.rosterId) === String(team.rosterId) ||
            r.displayName === team.displayName
          );
          const luckRank = luckEntry ? scheduleLuck.indexOf(luckEntry) + 1 : null;
          const totalTeams = scheduleLuck?.length || 0;
          const careerHigh = computeCareerHigh(seasonsData);
          const efficiency = computeLineupEfficiency(seasonsData);

          const stats = [
            {
              label: 'Win % By Season',
              content: seasonsData.length === 0 ? <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>—</span>
                : [...seasonsData].sort((a, b) => String(b.season).localeCompare(String(a.season))).map(({ season, roster }) => {
                    const w = roster?.settings?.wins || 0;
                    const l = roster?.settings?.losses || 0;
                    const pct = w + l > 0 ? ((w / (w + l)) * 100).toFixed(0) : '—';
                    return (
                      <div key={season} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{season}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text3)' }}>{w}–{l}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', fontWeight: 700, color: parseFloat(pct) >= 50 ? 'var(--green)' : 'var(--red)' }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  }),
            },
            {
              label: 'All-Time Nemesis',
              content: nemesis ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  {nemesis.avatar
                    ? <img src={`https://sleepercdn.com/avatars/thumbs/${nemesis.avatar}`} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} alt={nemesis.name} />
                    : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)' }}>{nemesis.name[0]}</div>
                  }
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{nemesis.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--red)', marginTop: 1 }}>{nemesis.losses} loss{nemesis.losses !== 1 ? 'es' : ''} to them</div>
                  </div>
                </div>
              ) : <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>No losses yet</span>,
            },
            {
              label: 'Schedule Luck',
              content: luckEntry ? (
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '1.4rem', fontWeight: 800, color: luckEntry.luckDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {luckEntry.luckDelta >= 0 ? '+' : ''}{luckEntry.luckDelta}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 3 }}>#{luckRank} of {totalTeams} {luckEntry.luckDelta >= 0 ? '(lucky)' : '(unlucky)'}</div>
                </div>
              ) : <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>—</span>,
            },
            {
              label: 'PF / PA Ratio',
              content: team.pointsAgainst > 0 ? (() => {
                const ratio = (team.pointsFor / team.pointsAgainst).toFixed(3);
                const isAbove = parseFloat(ratio) >= 1;
                return (
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '1.4rem', fontWeight: 800, color: isAbove ? 'var(--green)' : 'var(--red)' }}>{ratio}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 3 }}>{isAbove ? 'above average' : 'below average'}</div>
                  </div>
                );
              })() : <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>—</span>,
            },
            {
              label: 'Career High (Week)',
              content: careerHigh ? (
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold)' }}>{careerHigh.points.toFixed(2)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 3 }}>Wk {careerHigh.week}{careerHigh.season ? ` · ${careerHigh.season}` : ''}</div>
                </div>
              ) : <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>—</span>,
            },
            {
              label: 'Lineup Efficiency',
              info: 'Actual pts started ÷ Best possible pts × 100',
              content: efficiency ? (() => {
                const eff = parseFloat(efficiency);
                const color = eff >= 90 ? 'var(--green)' : eff >= 80 ? 'var(--gold)' : 'var(--red)';
                return (
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '1.4rem', fontWeight: 800, color }}>{efficiency}%</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 3 }}>
                      {eff >= 90 ? 'Elite decisions' : eff >= 80 ? 'Left pts on bench' : 'Costly mistakes'}
                    </div>
                  </div>
                );
              })() : <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>Not enough data</span>,
            },
          ];

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              borderBottom: '1px solid var(--border)',
            }}>
              {stats.map(({ label, content, info }, i) => {
                const isRightCol = (i + 1) % 3 === 0;
                const isBottomRow = i >= 3;
                return (
                  <div key={label} style={{
                    padding: '14px 16px',
                    borderRight: isRightCol ? 'none' : '1px solid var(--border)',
                    borderBottom: isBottomRow ? 'none' : '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      {label}
                      {info && <InfoTooltip text={info} />}
                    </div>
                    {content}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Season rosters — most recent first */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading players…</div>
        ) : (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
            {[...seasonsData].sort((a, b) => String(b.season).localeCompare(String(a.season))).map(({ season, roster }) => {
              if (!roster) return null;
              const rosterPlayers = buildRoster(roster, players);
              const groups = groupByPosition(rosterPlayers);
              const posOrder = POSITION_ORDER.filter((p) => groups[p]);

              return (
                <div key={season}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 14 }}>
                    {season} Roster · {rosterPlayers.length} players
                  </div>

                  {posOrder.map((pos) => (
                    <div key={pos} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: POSITION_COLORS[pos] || 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, paddingLeft: 4 }}>
                        {pos}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {groups[pos].map((p) => (
                          <div key={p.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 10px', borderRadius: 5,
                            background: 'var(--bg3)',
                          }}>
                            <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.team}</span>
                            {p.isTaxi && <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.15)', color: 'var(--gold)' }}>TAXI</span>}
                            {p.isIR && <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.15)', color: 'var(--red)' }}>IR</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
