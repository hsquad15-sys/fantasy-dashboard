import { avatarUrl } from '../lib/sleeper.jsx';

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

function StatCard({ emoji, label, name, delta, avatar }) {
  const isPositive = delta >= 0;
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flex: 1,
      minWidth: 180,
    }}>
      <span style={{ fontSize: '1.6rem' }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar avatar={avatar} name={name} size={24} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{name}</span>
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--mono)',
        fontWeight: 800,
        fontSize: '1.3rem',
        color: isPositive ? 'var(--green)' : 'var(--red)',
      }}>
        {isPositive ? '+' : ''}{delta}
      </span>
    </div>
  );
}

export default function ScheduleLuck({ luckData, rosterMap }) {
  if (!luckData || luckData.length === 0) {
    return <div className="loading-screen"><p>No schedule luck data yet.</p></div>;
  }

  const maxDelta = Math.max(...luckData.map((d) => Math.abs(d.luckDelta)), 1);
  const luckiest   = luckData[0];
  const unluckiest = luckData[luckData.length - 1];
  const mostNeutral = [...luckData].sort((a, b) => Math.abs(a.luckDelta) - Math.abs(b.luckDelta))[0];

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Schedule Luck</h2>
      </div>

      {/* Explainer card */}
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          What is Schedule Luck?
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.7 }}>
          Every week, we ask: <em style={{ color: 'var(--text)' }}>"If you played all 11 opponents instead of just 1, how many would you have beaten?"</em> That's your <strong style={{ color: 'var(--blue)' }}>Expected Wins</strong>. The gap between actual and expected = how lucky your schedule was.
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.7, marginTop: 8 }}>
          A <strong style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>+4.4</strong> means you got 4 easy matchups gifted to you.
          A <strong style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>-2</strong> means the schedule screwed you.{' '}
          <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>And if you are Altin, you are screwed every week!</span>
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          emoji="🍀"
          label="Luckiest Schedule"
          name={luckiest.displayName}
          delta={luckiest.luckDelta}
          avatar={luckiest.avatar}
        />
        <StatCard
          emoji="😤"
          label="Unluckiest Schedule"
          name={unluckiest.displayName}
          delta={unluckiest.luckDelta}
          avatar={unluckiest.avatar}
        />
        <StatCard
          emoji="⚖️"
          label="Most Neutral Schedule"
          name={mostNeutral.displayName}
          delta={mostNeutral.luckDelta}
          avatar={mostNeutral.avatar}
        />
      </div>

      {/* Table */}
      <div className="luck-list">
        {/* Column headers — hidden on mobile */}
        <div className="luck-header-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 100px 80px', gap: 12, padding: '6px 16px', marginBottom: 4 }}>
          {['Team', 'Luck Bar', 'Actual W', 'Expected W', 'Delta'].map((h) => (
            <span key={h} style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', textAlign: h === 'Team' ? 'left' : 'right' }}>{h}</span>
          ))}
        </div>

        {luckData.map((row) => {
          const isLucky = row.luckDelta >= 0;
          const barPct = (Math.abs(row.luckDelta) / maxDelta) * 45;
          const team = rosterMap[row.rosterId] || {};

          return (
            <div key={row.rosterId} className="luck-row-item" style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              display: 'grid',
              gridTemplateColumns: '200px 1fr 80px 100px 80px',
              alignItems: 'center',
              gap: 12,
            }}>
              {/* Desktop grid cells */}
              <div className="luck-team-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar avatar={team.avatar || row.avatar} name={row.displayName} />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{row.displayName}</span>
              </div>

              <div className="luck-bar-wrap luck-bar-desktop">
                <div className="luck-center-line" />
                <div className={`luck-bar ${isLucky ? 'positive' : 'negative'}`} style={{ width: `${barPct}%` }} />
              </div>

              <span className="luck-stat-cell" style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', textAlign: 'right', color: 'var(--text)' }}>
                {row.actualWins}
              </span>
              <span className="luck-stat-cell" style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', textAlign: 'right', color: 'var(--text2)' }}>
                {row.expectedWins.toFixed(1)}
              </span>
              <span className={`luck-delta ${isLucky ? 'positive' : 'negative'} luck-stat-cell`} style={{ textAlign: 'right' }}>
                {isLucky ? '+' : ''}{row.luckDelta}
              </span>

              {/* Mobile layout — single row: avatar + name + bar + delta */}
              <div className="luck-mobile-row" style={{ display: 'none', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Avatar avatar={team.avatar || row.avatar} name={row.displayName} />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{row.displayName}</span>
                  <span className={`luck-delta ${isLucky ? 'positive' : 'negative'}`} style={{ fontSize: '1rem' }}>
                    {isLucky ? '+' : ''}{row.luckDelta}
                  </span>
                </div>
                {/* Bar */}
                <div style={{ position: 'relative', height: 8, background: 'var(--bg3)', borderRadius: 99, overflow: 'visible', marginBottom: 4 }}>
                  <div style={{ position: 'absolute', top: -4, left: '50%', width: 2, height: 16, background: 'var(--border)', transform: 'translateX(-50%)' }} />
                  <div style={{
                    position: 'absolute', height: 8, borderRadius: 99, top: 0,
                    background: isLucky ? 'var(--green)' : 'var(--red)',
                    width: `${barPct}%`,
                    ...(isLucky ? { left: '50%' } : { right: '50%' }),
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text3)', marginTop: 4 }}>
                  <span>Actual: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{row.actualWins}W</span></span>
                  <span>Expected: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{row.expectedWins.toFixed(1)}W</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 16, fontSize: '0.75rem', color: 'var(--text3)' }}>
        Positive delta = got easy matchups · Negative delta = got unlucky with scheduling
      </p>
    </div>
  );
}
