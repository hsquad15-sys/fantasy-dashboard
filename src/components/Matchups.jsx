import { useState, useMemo, useRef, useEffect } from 'react';
import { avatarUrl, fetchPlayers } from '../lib/sleeper.jsx';

function Avatar({ avatar, name, size = 28 }) {
  const url = avatarUrl(avatar);
  if (url) return <img style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} src={url} alt={name} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--bg4)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

const POSITION_COLORS = {
  QB:  '#f59e0b', RB: '#10b981', WR: '#3b82f6', TE: '#8b5cf6',
  K:   '#64748b', DEF: '#ef4444', DL: '#ef4444', LB: '#f97316', DB: '#06b6d4',
};

export default function Matchups({ allMatchupsRaw, rosterMap, currentWeek }) {
  const availableWeeks = useMemo(() => {
    return allMatchupsRaw
      .filter((w) => {
        if (!w.data || w.data.length === 0) return false;
        const counts = {};
        w.data.forEach((e) => { if (e.matchup_id != null) counts[e.matchup_id] = (counts[e.matchup_id] || 0) + 1; });
        return Object.values(counts).some((c) => c === 2);
      })
      .map((w) => w.week);
  }, [allMatchupsRaw]);

  const [selectedWeek, setSelectedWeek] = useState(() => {
    if (availableWeeks.length === 0) return 1;
    return availableWeeks[availableWeeks.length - 1];
  });
  const [detail, setDetail] = useState(null);
  const [players, setPlayers] = useState(null);

  useEffect(() => {
    if (detail && !players) {
      fetchPlayers().then(setPlayers).catch(() => setPlayers({}));
    }
  }, [detail, players]);

  const matchups = useMemo(() => {
    const weekData = allMatchupsRaw.find((w) => w.week === selectedWeek);
    if (!weekData || !weekData.data) return [];

    const byMatchup = {};
    weekData.data.forEach((entry) => {
      if (entry.matchup_id == null) return;
      if (!byMatchup[entry.matchup_id]) byMatchup[entry.matchup_id] = [];
      byMatchup[entry.matchup_id].push(entry);
    });

    return Object.entries(byMatchup)
      .filter(([, pair]) => pair.length === 2)
      .map(([matchupId, pair]) => {
        const [a, b] = pair.sort((x, y) => (y.points || 0) - (x.points || 0));
        const teamA = rosterMap[a.roster_id] || { displayName: `Team ${a.roster_id}`, avatar: null };
        const teamB = rosterMap[b.roster_id] || { displayName: `Team ${b.roster_id}`, avatar: null };
        return {
          matchupId,
          entryA: a,
          entryB: b,
          teamA: { ...teamA, points: a.points || 0, isWinner: (a.points || 0) >= (b.points || 0) },
          teamB: { ...teamB, points: b.points || 0, isWinner: (b.points || 0) > (a.points || 0) },
        };
      })
      .sort((a, b) => {
        const maxA = Math.max(a.teamA.points, a.teamB.points);
        const maxB = Math.max(b.teamA.points, b.teamB.points);
        return maxB - maxA;
      });
  }, [allMatchupsRaw, selectedWeek, rosterMap]);

  const weekRanks = useMemo(() => {
    if (!players) return null;
    const weekData = allMatchupsRaw.find((w) => w.week === selectedWeek);
    if (!weekData?.data) return { ranks: {}, lists: {} };
    const byPos = {};
    weekData.data.forEach((e) => {
      (e.starters || []).forEach((pid) => {
        if (!pid || pid === '0') return;
        const pos = players[pid]?.position || '?';
        if (!byPos[pos]) byPos[pos] = [];
        byPos[pos].push({ pid, pts: e.players_points?.[pid] ?? 0, rosterId: e.roster_id });
      });
    });
    const ranks = {};
    Object.values(byPos).forEach((arr) => {
      arr.sort((a, b) => b.pts - a.pts);
      arr.forEach((x, i) => { ranks[x.pid] = { rank: i + 1, of: arr.length }; });
    });
    return { ranks, lists: byPos };
  }, [players, allMatchupsRaw, selectedWeek]);

  const posRanks = weekRanks?.ranks ?? null;
  const [leaderboard, setLeaderboard] = useState(null);

  if (availableWeeks.length === 0) {
    return <div className="loading-screen"><p>No matchup data available yet.</p></div>;
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Matchups</h2>
        <span className="badge badge-blue">Week {selectedWeek}</span>
      </div>

      <div className="week-selector">
        {availableWeeks.map((w) => (
          <button
            key={w}
            className={`week-btn${selectedWeek === w ? ' active' : ''}`}
            onClick={() => setSelectedWeek(w)}
          >
            Wk {w}
          </button>
        ))}
      </div>

      {matchups.length === 0 ? (
        <div className="loading-screen"><p>No matchups for week {selectedWeek}.</p></div>
      ) : (
        <>
          <div className="matchups-grid">
            {matchups.map((m) => (
              <div
                key={m.matchupId}
                className="matchup-card"
                onClick={() => setDetail(m)}
                style={{ cursor: 'pointer' }}
              >
                <MatchupRow team={m.teamA} />
                <MatchupRow team={m.teamB} />
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text3)' }}>
            Click any game for the box score and player ranks
          </p>
        </>
      )}

      {detail && (
        <MatchupDetail
          detail={detail}
          week={selectedWeek}
          players={players}
          posRanks={posRanks}
          onRankClick={(pos, pid) => setLeaderboard({ pos, pid })}
          onClose={() => setDetail(null)}
        />
      )}

      {leaderboard && weekRanks && (
        <WeekLeaderboard
          week={selectedWeek}
          lists={weekRanks.lists}
          initialPos={leaderboard.pos}
          highlightPid={leaderboard.pid}
          players={players}
          rosterMap={rosterMap}
          onClose={() => setLeaderboard(null)}
        />
      )}
    </div>
  );
}

function MatchupRow({ team }) {
  return (
    <div className="matchup-row">
      <div className="matchup-team">
        <Avatar avatar={team.avatar} name={team.displayName} />
        <span
          className="team-name"
          style={{ color: team.isWinner ? 'var(--text)' : 'var(--text2)' }}
        >
          {team.displayName}
        </span>
      </div>
      <span className={`matchup-score${team.isWinner ? ' winner' : ' loser'}`}>
        {team.points.toFixed(2)}
      </span>
    </div>
  );
}

function rankColor(rank, of) {
  if (rank === 1) return 'var(--gold)';
  if (rank <= Math.ceil(of * 0.25)) return 'var(--green)';
  if (rank > of - Math.ceil(of * 0.25)) return 'var(--red)';
  return 'var(--text2)';
}

function shortName(players, pid) {
  const p = players?.[pid];
  if (!p) return pid;
  if (p.position === 'DEF') return `${p.last_name || pid} DEF`;
  return `${p.first_name ? p.first_name[0] + '. ' : ''}${p.last_name || ''}`.trim() || pid;
}

function benchPoints(entry) {
  const started = new Set(entry.starters || []);
  return Object.entries(entry.players_points || {})
    .filter(([pid]) => !started.has(pid))
    .reduce((sum, [, pts]) => sum + (pts || 0), 0);
}

function StarterCell({ pid, players, posRanks, align, onRankClick }) {
  if (!pid || pid === '0') {
    return <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>Empty</span>;
  }
  const p = players?.[pid];
  const pos = p?.position || '?';
  const posColor = POSITION_COLORS[pos] || 'var(--text3)';
  const r = posRanks?.[pid];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: align === 'right' ? 'flex-end' : 'flex-start', minWidth: 0 }}>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        {shortName(players, pid)}
      </span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: posColor }}>{pos}</span>
        {r && (
          <button
            onClick={(e) => { e.stopPropagation(); onRankClick?.(pos, pid); }}
            title={`See all ${pos}s this week`}
            style={{
              fontFamily: 'var(--mono)', fontSize: '0.66rem', fontWeight: 700,
              color: rankColor(r.rank, r.of),
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '1px 5px', cursor: 'pointer',
            }}
          >
            {pos}{r.rank}<span style={{ color: 'var(--text3)', fontWeight: 400 }}>/{r.of}</span>
          </button>
        )}
      </span>
    </div>
  );
}

function WeekLeaderboard({ week, lists, initialPos, highlightPid, players, rosterMap, onClose }) {
  const [pos, setPos] = useState(initialPos);
  const positions = Object.keys(lists).sort((a, b) => {
    const order = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];
    return (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99);
  });
  const rows = lists[pos] || [];
  const highlightRef = useRef(null);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'center' });
  }, [pos]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 480, maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          animation: 'panel-slide-in 0.2s ease',
        }}
      >
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Week {week} Rankings</span>
            <button
              onClick={onClose}
              style={{ background: 'var(--bg3)', border: 'none', color: 'var(--text3)', fontSize: '0.95rem', padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {positions.map((p) => (
              <button
                key={p}
                className={`week-btn${pos === p ? ' active' : ''}`}
                onClick={() => setPos(p)}
                style={{ color: pos === p ? undefined : POSITION_COLORS[p] || 'var(--text2)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '6px 8px 10px' }}>
          {rows.map((row, i) => {
            const isHighlight = row.pid === highlightPid;
            const team = rosterMap[row.rosterId] || {};
            return (
              <div
                key={row.pid}
                ref={isHighlight ? highlightRef : null}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  background: isHighlight ? 'rgba(245,158,11,0.1)' : 'transparent',
                  border: isHighlight ? '1px solid rgba(245,158,11,0.45)' : '1px solid transparent',
                }}
              >
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.75rem', minWidth: 26, color: rankColor(i + 1, rows.length) }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {shortName(players, row.pid)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {team.displayName || `Team ${row.rosterId}`}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.85rem', color: i === 0 ? 'var(--gold)' : 'var(--text)' }}>
                  {row.pts.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchupDetail({ detail, week, players, posRanks, onRankClick, onClose }) {
  const { teamA, teamB, entryA, entryB } = detail;
  const loading = !players || !posRanks;
  const slots = Math.max(entryA.starters?.length || 0, entryB.starters?.length || 0);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 700, maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          animation: 'panel-slide-in 0.2s ease',
        }}
      >
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '16px 18px', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <Avatar avatar={teamA.avatar} name={teamA.displayName} size={30} />
              <span className="team-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamA.displayName}</span>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'var(--bg3)', border: 'none', color: 'var(--text3)', fontSize: '1rem', padding: '4px 9px', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}
            >
              ✕
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
              <span className="team-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamB.displayName}</span>
              <Avatar avatar={teamB.avatar} name={teamB.displayName} size={30} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 800, color: teamA.isWinner ? 'var(--green)' : 'var(--text3)' }}>
              {teamA.points.toFixed(2)}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.08em' }}>WEEK {week}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 800, color: teamB.isWinner ? 'var(--green)' : 'var(--text3)' }}>
              {teamB.points.toFixed(2)}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ padding: 40 }}>
            <div className="spinner" />
            <p>Loading players…</p>
          </div>
        ) : (
          <div style={{ padding: '10px 18px 18px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase', margin: '10px 0 8px' }}>
              Starters · rank vs all starters at that position this week
            </div>
            {Array.from({ length: slots }, (_, i) => {
              const pidA = entryA.starters?.[i];
              const pidB = entryB.starters?.[i];
              const ptsA = pidA && pidA !== '0' ? (entryA.players_points?.[pidA] ?? 0) : null;
              const ptsB = pidB && pidB !== '0' ? (entryB.players_points?.[pidB] ?? 0) : null;
              const aWins = ptsA != null && (ptsB == null || ptsA >= ptsB);
              const bWins = ptsB != null && (ptsA == null || ptsB > ptsA);
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 54px 54px 1fr',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: i < slots - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <StarterCell pid={pidA} players={players} posRanks={posRanks} align="left" onRankClick={onRankClick} />
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'right', color: aWins ? 'var(--text)' : 'var(--text3)' }}>
                    {ptsA != null ? ptsA.toFixed(1) : '—'}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'left', color: bWins ? 'var(--text)' : 'var(--text3)' }}>
                    {ptsB != null ? ptsB.toFixed(1) : '—'}
                  </span>
                  <StarterCell pid={pidB} players={players} posRanks={posRanks} align="right" onRankClick={onRankClick} />
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text3)' }}>
                Bench: {benchPoints(entryA).toFixed(1)}
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase' }}>
                Points left on bench
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text3)' }}>
                Bench: {benchPoints(entryB).toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
