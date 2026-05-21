import { useState, useMemo } from 'react';
import { avatarUrl } from '../lib/sleeper.jsx';

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

export default function Matchups({ allMatchupsRaw, rosterMap, currentWeek }) {
  const availableWeeks = useMemo(() => {
    return allMatchupsRaw
      .filter((w) => w.data && w.data.length > 0)
      .map((w) => w.week);
  }, [allMatchupsRaw]);

  const [selectedWeek, setSelectedWeek] = useState(() => {
    if (availableWeeks.length === 0) return 1;
    return availableWeeks[availableWeeks.length - 1];
  });

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
        <div className="matchups-grid">
          {matchups.map(({ matchupId, teamA, teamB }) => (
            <div key={matchupId} className="matchup-card">
              <MatchupRow team={teamA} isTop />
              <MatchupRow team={teamB} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchupRow({ team, isTop }) {
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
