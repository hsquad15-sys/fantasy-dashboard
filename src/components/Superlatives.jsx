import { avatarUrl } from '../lib/sleeper.jsx';

function Avatar({ avatar, name, size = 28 }) {
  const url = avatarUrl(avatar);
  if (url) return <img style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} src={url} alt={name} />;
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

function Card({ emoji, label, name, stat, detail, avatar, accentColor = 'var(--gold)', tag }) {
  return (
    <div className="superlative-card" style={{ position: 'relative' }}>
      {tag && (
        <div style={{
          position: 'absolute',
          top: 12,
          right: 14,
          fontSize: '0.72rem',
          fontWeight: 700,
          color: 'var(--red)',
          opacity: 0.85,
          textAlign: 'right',
          lineHeight: 1.3,
        }}>
          {tag}
        </div>
      )}
      <div className="superlative-emoji">{emoji}</div>
      <div className="superlative-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        {avatar !== undefined && <Avatar avatar={avatar} name={name} size={24} />}
        <div className="superlative-name">{name}</div>
      </div>
      {stat && <div className="superlative-stat" style={{ color: accentColor }}>{stat}</div>}
      {detail && <div className="superlative-detail">{detail}</div>}
    </div>
  );
}

export default function Superlatives({ superlatives, rosterMap, season }) {
  if (!superlatives || Object.keys(superlatives).length === 0) {
    return (
      <div className="loading-screen">
        <p>Not enough data to compute superlatives yet.</p>
      </div>
    );
  }

  const {
    highScore,
    lowScore,
    mostPoints,
    leastPoints,
    bestRecord,
    lucky,
    unlucky,
    biggestBlowout,
    closestWin,
  } = superlatives;

  const getAvatar = (rosterId) => rosterMap[rosterId]?.avatar;

  const cards = [
    highScore && {
      emoji: '🔥',
      label: 'Highest Single-Week Score',
      name: highScore.name,
      stat: `${highScore.points.toFixed(2)} pts`,
      detail: `Week ${highScore.week}${highScore.season ? ` · ${highScore.season}` : ''} vs ${rosterMap[highScore.opponent]?.displayName || 'Opponent'}`,
      avatar: getAvatar(highScore.rosterId),
      accentColor: 'var(--gold)',
    },
    lowScore && {
      emoji: '😬',
      label: 'Lowest Single-Week Score',
      name: lowScore.name,
      stat: `${lowScore.points.toFixed(2)} pts`,
      detail: `Week ${lowScore.week}${lowScore.season ? ` · ${lowScore.season}` : ''} vs ${rosterMap[lowScore.opponent]?.displayName || 'Opponent'}`,
      avatar: getAvatar(lowScore.rosterId),
      accentColor: 'var(--red)',
    },
    mostPoints && {
      emoji: '📈',
      label: 'Most Points in a Season',
      name: mostPoints.name,
      stat: `${mostPoints.points.toFixed(1)} pts`,
      detail: mostPoints.season ? `${mostPoints.season} season` : '',
      avatar: getAvatar(mostPoints.rosterId),
      accentColor: 'var(--green)',
    },
    leastPoints && {
      emoji: '📉',
      label: 'Least Points in a Season',
      name: leastPoints.name,
      stat: `${leastPoints.points.toFixed(1)} pts`,
      detail: leastPoints.season ? `${leastPoints.season} season` : '',
      avatar: getAvatar(leastPoints.rosterId),
      accentColor: 'var(--red)',
    },
    bestRecord && {
      emoji: '📆',
      label: 'Best Regular Season Record',
      name: bestRecord.name,
      stat: `${bestRecord.wins}W`,
      detail: bestRecord.season ? `${bestRecord.season} season` : '',
      avatar: getAvatar(bestRecord.rosterId),
      accentColor: 'var(--blue)',
    },
    lucky && {
      emoji: '😤',
      label: 'Luckiest Schedule',
      name: lucky.name,
      stat: `${lucky.wins}W`,
      detail: `Only ${lucky.pts.toFixed(0)} pts scored${lucky.season ? ` in ${lucky.season}` : ''}`,
      avatar: getAvatar(lucky.rosterId),
      accentColor: 'var(--purple)',
    },
    unlucky && {
      emoji: '😭',
      label: 'Unluckiest Schedule',
      name: unlucky.name,
      stat: `${unlucky.pts.toFixed(0)} pts`,
      detail: `Only ${unlucky.wins}W despite scoring${unlucky.season ? ` in ${unlucky.season}` : ''}`,
      tag: 'You so ass bro 😭',
      avatar: getAvatar(unlucky.rosterId),
      accentColor: 'var(--red)',
    },
    biggestBlowout && {
      emoji: '💀',
      label: 'Worst Blowout',
      name: biggestBlowout.winnerName,
      stat: `+${biggestBlowout.margin} pts`,
      detail: `${biggestBlowout.winnerName} def. ${biggestBlowout.loserName} · Wk ${biggestBlowout.week}${biggestBlowout.season ? ` ${biggestBlowout.season}` : ''} · ${biggestBlowout.team1Points.toFixed(1)}–${biggestBlowout.team2Points.toFixed(1)}`,
      avatar: getAvatar(biggestBlowout.winnerId),
      accentColor: 'var(--red)',
    },
    closestWin && {
      emoji: '🎯',
      label: 'Closest Win Ever',
      name: closestWin.winnerName,
      stat: `+${closestWin.margin} pts`,
      detail: `${closestWin.winnerName} def. ${closestWin.loserName} · Wk ${closestWin.week}${closestWin.season ? ` ${closestWin.season}` : ''} · ${closestWin.team1Points.toFixed(1)}–${closestWin.team2Points.toFixed(1)}`,
      avatar: getAvatar(closestWin.winnerId),
      accentColor: 'var(--green)',
    },
    superlatives.longestWinStreak && {
      emoji: '⚡',
      label: 'Longest Winning Streak',
      name: superlatives.longestWinStreak.name,
      stat: `${superlatives.longestWinStreak.length}W in a row`,
      detail: `Started Wk ${superlatives.longestWinStreak.startWeek}${superlatives.longestWinStreak.startSeason ? ` · ${superlatives.longestWinStreak.startSeason}` : ''}`,
      avatar: getAvatar(superlatives.longestWinStreak.rosterId),
      accentColor: 'var(--green)',
    },
    superlatives.longestLossStreak && {
      emoji: '💩',
      label: 'Longest Losing Streak',
      name: superlatives.longestLossStreak.name,
      stat: `${superlatives.longestLossStreak.length}L in a row`,
      detail: `Started Wk ${superlatives.longestLossStreak.startWeek}${superlatives.longestLossStreak.startSeason ? ` · ${superlatives.longestLossStreak.startSeason}` : ''}`,
      avatar: getAvatar(superlatives.longestLossStreak.rosterId),
      accentColor: 'var(--red)',
    },
  ].filter(Boolean);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Superlatives</h2>
        <span className="badge badge-gold">
          {season === 'all' ? '🏆 All Time' : `🏆 ${season} Season`}
        </span>
      </div>
      <div className="superlatives-grid">
        {cards.map((card, i) => (
          <Card key={i} {...card} />
        ))}
      </div>
    </div>
  );
}
