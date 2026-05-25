import { useState } from 'react';
import { DEFAULT_SEASON } from './lib/sleeper.jsx';
import { useLeagueData } from './hooks/useLeagueData.jsx';
import Standings from './components/Standings.jsx';
import Matchups from './components/Matchups.jsx';
import PointsChart from './components/PointsChart.jsx';
import Transactions from './components/Transactions.jsx';
import Rivalries from './components/Rivalries.jsx';
import Superlatives from './components/Superlatives.jsx';
import ScheduleLuck from './components/ScheduleLuck.jsx';
import Games from './components/Games.jsx';

const TABS = [
  { id: 'standings', label: 'Standings' },
  { id: 'rivalries', label: 'Rivalries' },
  { id: 'games', label: 'Games' },
  { id: 'superlatives', label: 'Superlatives' },
  { id: 'luck', label: 'Schedule Luck' },
  { id: 'matchups', label: 'Matchups' },
  { id: 'points', label: 'Points' },
  { id: 'transactions', label: 'Transactions' },
];

export default function App() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [activeTab, setActiveTab] = useState('standings');
  const { data, loading, error, reload } = useLeagueData(season);

  const leagueName = data?.currentSeasonData?.league?.name || 'The Ragtag Band of Misfits';
  const totalGames = data?.allGames?.length || 0;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src="/league-photo.jpg"
                alt="League Photo"
                style={{
                  height: 52, width: 52,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  border: '2px solid var(--gold)',
                  flexShrink: 0,
                  boxShadow: '0 0 12px rgba(232,168,4,0.4)',
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <h1 className="league-name">
                {leagueName.includes('Misfits')
                  ? <>{leagueName.replace('Misfits', '')}<span style={{
                      background: 'linear-gradient(135deg, #f5c518 0%, #e8a804 40%, #c47d00 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      textShadow: 'none',
                      filter: 'drop-shadow(0 0 8px rgba(232,168,4,0.5))',
                    }}>Misfits</span></>
                  : leagueName}
              </h1>
            </div>
            <p className="league-sub">
              Dynasty
              <span className="league-sub-dot">·</span>
              12 Teams · PPR · SuperFlex
              <span className="league-sub-dot">·</span>
              {totalGames > 0 && <>{totalGames} matchups<span className="league-sub-dot">·</span></>}
              2024–2026
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="season-switcher">
              {['2024', '2025', '2026', 'all'].map((s) => (
                <button
                  key={s}
                  className={`season-btn${season === s ? ' active' : ''}`}
                  onClick={() => setSeason(s)}
                >
                  {s === 'all' ? 'All Time' : s}
                </button>
              ))}
            </div>
            <button
              onClick={reload}
              disabled={loading}
              title="Refresh data"
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: loading ? 'var(--text3)' : 'var(--text2)',
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '6px 10px',
                fontSize: '1rem',
                lineHeight: 1,
                transition: 'all 0.15s',
              }}
            >
              {loading ? '⏳' : '🔄'}
            </button>
          </div>
        </div>
        <nav className="tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        {loading && (
          <div className="loading-screen">
            <div className="spinner" />
            <p>Loading league data…</p>
          </div>
        )}
        {error && (
          <div className="error-screen">
            <p className="error-msg">⚠️ {error}</p>
            <button className="retry-btn" onClick={reload}>Retry</button>
          </div>
        )}
        {!loading && !error && data && (
          <>
            {activeTab === 'standings' && (
              <Standings
                standings={data.mode === 'all' ? (data.allTimeStandings || []) : (data.currentSeasonData?.standings || [])}
                rosterMap={data.rosterMap || data.currentSeasonData?.rosterMap || {}}
                season={season}
                league={data.currentSeasonData?.league}
                games={data.allGames || []}
                scheduleLuck={data.scheduleLuck || []}
                seasonsData={
                  data.mode === 'all'
                    ? { '2024': data.seasons?.['2024'], '2025': data.seasons?.['2025'], '2026': data.seasons?.['2026'] }
                    : { [season]: data.currentSeasonData }
                }
              />
            )}
            {activeTab === 'rivalries' && (
              <Rivalries
                h2h={data.h2h}
                rosterMap={data.rosterMap}
                games={data.allGames}
              />
            )}
            {activeTab === 'games' && (
              <Games
                games={data.allGames}
                rosterMap={data.rosterMap}
              />
            )}
            {activeTab === 'superlatives' && (
              <Superlatives
                superlatives={data.superlatives}
                rosterMap={data.rosterMap}
                season={season}
              />
            )}
            {activeTab === 'luck' && (
              <ScheduleLuck
                luckData={data.scheduleLuck}
                rosterMap={data.rosterMap}
              />
            )}
            {activeTab === 'matchups' && (
              <Matchups
                leagueId={data.currentSeasonData?.league?.league_id}
                rosterMap={data.currentSeasonData?.rosterMap || {}}
                currentWeek={data.currentSeasonData?.currentWeek || 1}
                allMatchupsRaw={data.currentSeasonData?.allMatchupsRaw || []}
              />
            )}
            {activeTab === 'points' && (
              <PointsChart
                allMatchupsRaw={data.currentSeasonData?.allMatchupsRaw || []}
                rosterMap={data.currentSeasonData?.rosterMap || {}}
              />
            )}
            {activeTab === 'transactions' && (
              <Transactions
                transactions={
                  data.mode === 'all'
                    ? [
                        ...(data.seasons?.['2024']?.transactions || []),
                        ...(data.seasons?.['2025']?.transactions || []),
                        ...(data.seasons?.['2026']?.transactions || []),
                      ]
                    : data.currentSeasonData?.transactions || []
                }
                rosterMap={data.currentSeasonData?.rosterMap || {}}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
