import { useState } from 'react';
import { avatarUrl } from '../lib/sleeper.jsx';
import TeamProfile from './TeamProfile.jsx';

function Avatar({ avatar, name }) {
  const url = avatarUrl(avatar);
  if (url) return <img className="avatar" src={url} alt={name} />;
  return <div className="avatar-placeholder">{(name || '?')[0].toUpperCase()}</div>;
}

export default function Standings({ standings, rosterMap, season, league, seasonsData, games, scheduleLuck }) {
  const [selectedTeam, setSelectedTeam] = useState(null);

  if (!standings || standings.length === 0) {
    return <div className="loading-screen"><p>No standings data available.</p></div>;
  }

  const playoffSpots = league?.settings?.playoff_teams || 6;

  const openTeam = (team) => {
    const seasons = [];
    if (seasonsData) {
      Object.entries(seasonsData).forEach(([yr, sd]) => {
        const roster = sd.rosters?.find((r) =>
          // All-time mode: team.rosterId IS the owner_id (user_id string)
          String(r.owner_id) === String(team.rosterId) ||
          // Single-season mode: match by numeric roster_id
          String(r.roster_id) === String(team.rosterId) ||
          // Fallback: match by display name using season-specific rosterMap
          sd.rosterMap?.[r.roster_id]?.displayName === team.displayName
        );
        if (roster) seasons.push({ season: yr, roster, allMatchupsRaw: sd.allMatchupsRaw || [] });
      });
      seasons.sort((a, b) => String(a.season).localeCompare(String(b.season)));
    }
    setSelectedTeam({ team, seasons });
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Standings</h2>
        <span className="badge badge-blue">
          {season === 'all' ? 'All Time' : `${season} Season`}
        </span>
      </div>
      <div className="card standings-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Team</th>
              <th className="center">W</th>
              <th className="center">L</th>
              <th className="right">PF</th>
              <th className="right">PA</th>
              <th className="right" style={{ minWidth: 70 }}>+/-</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team, idx) => {
              const isPlayoffLine = idx === playoffSpots && season !== 'all';
              const diff = (team.pointsFor - team.pointsAgainst).toFixed(1);
              const diffNum = parseFloat(diff);
              return (
                <tr
                  key={team.rosterId}
                  className={isPlayoffLine ? 'playoff-divider' : ''}
                  onClick={() => openTeam(team)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><span className="rank-num">{idx + 1}</span></td>
                  <td>
                    <div className="team-cell">
                      <Avatar avatar={team.avatar} name={team.displayName} />
                      <div>
                        <div className="team-name">{team.displayName}</div>
                        {idx === 0 && season !== 'all' && (
                          <span className="badge badge-gold" style={{ fontSize: '0.68rem', marginTop: 2 }}>🏆 1st</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="center"><span className="record" style={{ color: 'var(--green)' }}>{team.wins}</span></td>
                  <td className="center"><span className="record" style={{ color: 'var(--red)' }}>{team.losses}</span></td>
                  <td className="right pts">{team.pointsFor.toFixed(1)}</td>
                  <td className="right pts" style={{ color: 'var(--text3)' }}>{team.pointsAgainst.toFixed(1)}</td>
                  <td className="right">
                    <span className="pts" style={{ color: diffNum >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {diffNum >= 0 ? '+' : ''}{diff}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {season !== 'all' && (
        <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text3)' }}>
          Click any team to view their roster · Top {playoffSpots} qualify for playoffs
        </p>
      )}

      {selectedTeam && (
        <TeamProfile
          team={selectedTeam.team}
          seasonsData={selectedTeam.seasons}
          games={games}
          scheduleLuck={scheduleLuck}
          rosterMap={rosterMap}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
