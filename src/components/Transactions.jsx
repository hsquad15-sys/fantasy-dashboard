import { useMemo, useState, useEffect } from 'react';
import { fetchPlayers, playerLabel, avatarUrl } from '../lib/sleeper.jsx';
import {
  fetchFantasyCalcValues,
  buildValueMap,
  lookupPickValue,
  lookupPlayerValue,
  gradeTradeTeam,
} from '../lib/fantasycalc.jsx';

const PAGE_SIZE = 15;

const TYPE_LABELS = { trade: 'Trade', waiver: 'Waiver', free_agent: 'Free Agent' };
const TYPE_COLORS = {
  trade:      { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
  waiver:     { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  free_agent: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
};

function Avatar({ avatar, name, size = 26 }) {
  const url = avatarUrl(avatar);
  if (url) return <img style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} src={url} alt={name} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function formatDateTime(ts) {
  if (!ts) return { date: '', time: '' };
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}

function GradeBadge({ grade, color, size = 'sm' }) {
  if (!grade) return null;
  const fontSize = size === 'lg' ? '1.1rem' : '0.75rem';
  const padding  = size === 'lg' ? '4px 12px' : '2px 7px';
  return (
    <span style={{
      fontFamily: 'var(--mono)',
      fontWeight: 800,
      fontSize,
      padding,
      borderRadius: 99,
      background: `${color}22`,
      color,
      border: `1px solid ${color}55`,
      flexShrink: 0,
    }}>
      {grade}
    </span>
  );
}

function TradeStatCard({ emoji, label, name, avatar, net, trades, tradeList = [] }) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = net >= 0;
  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${isPositive ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
      borderRadius: 'var(--radius)',
      padding: '16px 20px',
      flex: 1,
      minWidth: 240,
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 10 }}>
        {emoji} {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Avatar avatar={avatar} name={name} size={32} />
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: tradeList.length ? 10 : 0 }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontWeight: 800,
          fontSize: '1.1rem',
          color: isPositive ? '#4ade80' : '#f87171',
        }}>
          {isPositive ? '+' : ''}{Math.round(net).toLocaleString()}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>value · {trades} trade{trades !== 1 ? 's' : ''}</span>
      </div>
      {tradeList.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)', color: 'var(--text2)',
              fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px',
              cursor: 'pointer', marginBottom: expanded ? 10 : 0,
            }}
          >
            {expanded ? 'Hide ▴' : `Show trades ▾`}
          </button>
          {expanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tradeList.map((t, i) => (
                <div key={i} style={{
                  background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{t.date}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.grade && <GradeBadge grade={t.grade.grade} color={t.grade.color} />}
                      <span style={{
                        fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.8rem',
                        color: t.net >= 0 ? '#4ade80' : '#f87171',
                      }}>
                        {t.net >= 0 ? '+' : ''}{Math.round(t.net).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>
                    vs {t.opponents.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Transactions({ transactions, rosterMap }) {
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [page, setPage]             = useState(1);
  const [players, setPlayers]       = useState(null);
  const [fcValues, setFcValues]     = useState(null);
  const [playersLoading, setPlayersLoading] = useState(true);

  useEffect(() => {
    fetchPlayers().then(setPlayers).catch(() => setPlayers({})).finally(() => setPlayersLoading(false));
    fetchFantasyCalcValues().then(setFcValues).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [filter, search, teamFilter, seasonFilter]);

  const valueMap = useMemo(() => buildValueMap(fcValues), [fcValues]);

  const sorted = useMemo(() =>
    [...transactions].filter((tx) => tx.status === 'complete').sort((a, b) => (b.created || 0) - (a.created || 0)),
    [transactions]
  );

  // Compute per-team received/sent value for a trade
  function computeTradeValues(tx) {
    if (tx.type !== 'trade') return null;
    const received = {};
    Object.entries(tx.adds || {}).forEach(([pid, toRid]) => {
      const val = lookupPlayerValue(valueMap, players, pid);
      const key = String(toRid);
      received[key] = (received[key] || 0) + val;
    });
    (tx.draft_picks || []).forEach((p) => {
      const val = lookupPickValue(valueMap, p.round, p.season);
      // owner_id = who gets the pick after the trade
      const toKey = p.owner_id != null ? String(p.owner_id) : null;
      if (toKey) received[toKey] = (received[toKey] || 0) + val;
    });
    const total = Object.values(received).reduce((a, b) => a + b, 0);
    const rids = (tx.roster_ids || []).map(String);
    const result = {};
    rids.forEach((rid) => {
      const teamReceived = received[rid] || 0;
      const teamSent = total - teamReceived;
      result[rid] = { received: teamReceived, sent: teamSent, grade: gradeTradeTeam(teamReceived, teamSent) };
    });
    return result;
  }

  // Trade Shark / Got Cooked aggregates — respects the year filter
  const tradeStats = useMemo(() => {
    if (!fcValues || !players) return null;
    const nets = {};
    const counts = {};
    const teamTrades = {};
    sorted
      .filter((tx) => {
        if (tx.type !== 'trade') return false;
        if (seasonFilter !== 'all' && tx.created && new Date(tx.created).getFullYear() !== Number(seasonFilter)) return false;
        return true;
      })
      .forEach((tx) => {
        const vals = computeTradeValues(tx);
        if (!vals) return;
        const { date } = formatDateTime(tx.created);
        (tx.roster_ids || []).forEach((rid) => {
          const key = String(rid);
          const { received, sent } = vals[key] || { received: 0, sent: 0 };
          const tradeNet = received - sent;
          nets[key] = (nets[key] || 0) + tradeNet;
          counts[key] = (counts[key] || 0) + 1;
          if (!teamTrades[key]) teamTrades[key] = [];
          teamTrades[key].push({
            date,
            opponents: (tx.roster_ids || [])
              .filter((r) => String(r) !== key)
              .map((r) => rosterMap[r]?.displayName || rosterMap[Number(r)]?.displayName || `Team ${r}`),
            net: tradeNet,
            grade: vals[key]?.grade,
          });
        });
      });
    const entries = Object.entries(nets)
      .map(([rid, net]) => ({
        rid, net,
        trades: counts[rid] || 0,
        name:   rosterMap[Number(rid)]?.displayName || rosterMap[rid]?.displayName || `Team ${rid}`,
        avatar: rosterMap[Number(rid)]?.avatar      || rosterMap[rid]?.avatar,
        tradeList: teamTrades[rid] || [],
      }))
      .filter((e) => e.trades > 0);
    if (entries.length < 2) return null;
    entries.sort((a, b) => b.net - a.net);
    return { shark: entries[0], cooked: entries[entries.length - 1] };
  }, [sorted, fcValues, players, valueMap, rosterMap, seasonFilter]);

  const teams = useMemo(() => {
    const ids = new Set(sorted.flatMap((tx) => tx.roster_ids || []));
    return [...ids].map((id) => ({ id, name: rosterMap[id]?.displayName || `Team ${id}` })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sorted, rosterMap]);

  const seasons = useMemo(() => {
    const yr = new Set(sorted.map((tx) => tx.created ? new Date(tx.created).getFullYear() : null).filter(Boolean));
    return [...yr].sort((a, b) => b - a);
  }, [sorted]);

  const pLabel = (id) => playerLabel(players, id);

  const allItems = (tx) => {
    const adds  = Object.keys(tx.adds || {});
    const drops = Object.keys(tx.drops || {});
    const picks = (tx.draft_picks || []).map((p) => `${p.season} Rd ${p.round}`);
    return [...adds.map(pLabel), ...drops.map(pLabel), ...picks].join(' ').toLowerCase();
  };

  const filtered = useMemo(() => {
    return sorted.filter((tx) => {
      if (filter !== 'all' && tx.type !== filter) return false;
      if (teamFilter !== 'all' && !(tx.roster_ids || []).includes(Number(teamFilter))) return false;
      if (seasonFilter !== 'all' && tx.created && new Date(tx.created).getFullYear() !== Number(seasonFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const teamsStr = (tx.roster_ids || []).map((id) => rosterMap[id]?.displayName || '').join(' ').toLowerCase();
        if (!allItems(tx).includes(q) && !teamsStr.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, filter, teamFilter, seasonFilter, search, players]);

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    all:        sorted.length,
    trade:      sorted.filter((t) => t.type === 'trade').length,
    waiver:     sorted.filter((t) => t.type === 'waiver').length,
    free_agent: sorted.filter((t) => t.type === 'free_agent').length,
  };

  const renderRow = (tx) => {
    const { date, time } = formatDateTime(tx.created);
    const type   = tx.type || 'unknown';
    const colors = TYPE_COLORS[type] || { bg: 'var(--bg3)', color: 'var(--text2)' };
    const rosterIds = tx.roster_ids || [];
    const isTrade = type === 'trade';
    const str = (v) => String(v);

    const tradeVals = isTrade && fcValues && players ? computeTradeValues(tx) : null;

    const addEntries  = Object.entries(tx.adds  || {});
    const dropEntries = Object.entries(tx.drops || {});
    const picks = tx.draft_picks || [];

    const allRosterIds = [...new Set([...rosterIds.map(str)])];

    const receivesByTeam = {};
    const sendsByTeam = {};
    allRosterIds.forEach((rid) => { receivesByTeam[rid] = []; sendsByTeam[rid] = []; });

    addEntries.forEach(([pid, toRid]) => {
      const key = str(toRid);
      if (!receivesByTeam[key]) receivesByTeam[key] = [];
      receivesByTeam[key].push({ label: pLabel(pid), isPick: false });
    });
    dropEntries.forEach(([pid, fromRid]) => {
      const key = str(fromRid);
      if (!sendsByTeam[key]) sendsByTeam[key] = [];
      sendsByTeam[key].push({ label: pLabel(pid), isPick: false });
    });
    picks.forEach((p) => {
      const label  = `${p.season} Round ${p.round} pick`;
      const toKey   = p.owner_id != null          ? str(p.owner_id)          : null;
      const fromKey = p.previous_owner_id != null ? str(p.previous_owner_id) : null;
      if (toKey)   { if (!receivesByTeam[toKey]) receivesByTeam[toKey] = []; receivesByTeam[toKey].push({ label, isPick: true }); }
      if (fromKey) { if (!sendsByTeam[fromKey])  sendsByTeam[fromKey]  = []; sendsByTeam[fromKey].push({ label, isPick: true }); }
    });

    const allReceiveRids = [...new Set([...allRosterIds, ...Object.keys(receivesByTeam).filter((k) => receivesByTeam[k].length)])];
    const allSendRids    = [...new Set([...allRosterIds, ...Object.keys(sendsByTeam).filter((k) => sendsByTeam[k].length)])];

    const receives = isTrade ? null : [...addEntries.map(([pid]) => pLabel(pid)), ...picks.map((p) => `${p.season} Round ${p.round} pick`)];
    const sends    = isTrade ? null : dropEntries.map(([pid]) => pLabel(pid));

    return (
      <div key={tx.transaction_id} className="tx-row" style={{
        display: 'grid',
        gridTemplateColumns: '130px 180px 1fr 1fr 100px',
        gap: 16,
        alignItems: 'start',
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.12s',
      }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {/* DATE */}
        <div className="tx-col-date">
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{date}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 2 }}>{time}</div>
        </div>

        {/* TEAMS */}
        <div className="tx-col-teams" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rosterIds.map((rid, i) => {
            const ridStr = str(rid);
            const tval = tradeVals?.[ridStr];
            return (
              <div key={rid}>
                {i > 0 && rosterIds.length > 1 && (
                  <div style={{ color: 'var(--text3)', fontSize: '0.75rem', marginBottom: 4 }}>⇌</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <Avatar avatar={rosterMap[rid]?.avatar} name={rosterMap[rid]?.displayName} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                    {rosterMap[rid]?.displayName || `Team ${rid}`}
                  </span>
                  {tval?.grade && <GradeBadge grade={tval.grade.grade} color={tval.grade.color} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* RECEIVES */}
        <div className="tx-col-receives" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isTrade
            ? allReceiveRids.map((rid) => {
                const items = receivesByTeam[rid] || [];
                if (!items.length) return null;
                const name = rosterMap[rid]?.displayName || rosterMap[Number(rid)]?.displayName || `Team ${rid}`;
                return (
                  <div key={rid}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 4 }}>{name}</div>
                    {items.map((item, i) => (
                      <div key={i} style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>
                        <span style={{ fontWeight: 700, color: '#4ade80', marginRight: 4 }}>+</span>
                        <span style={{ fontWeight: item.isPick ? 400 : 600, color: item.isPick ? '#4ade80' : '#86efac' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })
            : (receives || []).length === 0
              ? <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>—</span>
              : (receives || []).map((label, i) => (
                  <div key={i} style={{ fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: '#4ade80', marginRight: 4 }}>+</span>
                    <span style={{ fontWeight: 600, color: '#86efac' }}>{label}</span>
                  </div>
                ))
          }
        </div>

        {/* SENDS */}
        <div className="tx-col-sends" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isTrade
            ? allSendRids.map((rid) => {
                const items = sendsByTeam[rid] || [];
                if (!items.length) return null;
                const name = rosterMap[rid]?.displayName || rosterMap[Number(rid)]?.displayName || `Team ${rid}`;
                return (
                  <div key={rid}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 4 }}>{name}</div>
                    {items.map((item, i) => (
                      <div key={i} style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>
                        <span style={{ fontWeight: 700, color: '#f87171', marginRight: 4 }}>-</span>
                        <span style={{ fontWeight: item.isPick ? 400 : 600, color: '#fca5a5' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })
            : (sends || []).length === 0
              ? <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>—</span>
              : (sends || []).map((label, i) => (
                  <div key={i} style={{ fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: '#f87171', marginRight: 4 }}>-</span>
                    <span style={{ fontWeight: 600, color: '#fca5a5' }}>{label}</span>
                  </div>
                ))
          }
        </div>

        {/* TYPE */}
        <div className="tx-col-type" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px',
            borderRadius: 99, background: colors.bg, color: colors.color, whiteSpace: 'nowrap',
          }}>
            {TYPE_LABELS[type] || type}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Transactions</h2>
      </div>

      {/* Trade Shark / Got Cooked cards */}
      {tradeStats && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 10 }}>
            Trade Grades · {seasonFilter === 'all' ? 'All Time' : seasonFilter}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <TradeStatCard
            emoji="🦈"
            label="Trade Shark"
            name={tradeStats.shark.name}
            avatar={tradeStats.shark.avatar}
            net={tradeStats.shark.net}
            trades={tradeStats.shark.trades}
            tradeList={tradeStats.shark.tradeList}
          />
          <TradeStatCard
            emoji="🍳"
            label="Got Cooked"
            name={tradeStats.cooked.name}
            avatar={tradeStats.cooked.avatar}
            net={tradeStats.cooked.net}
            trades={tradeStats.cooked.trades}
            tradeList={tradeStats.cooked.tradeList}
          />
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['trade', 'Trades'], ['waiver', 'Waivers'], ['free_agent', 'Free Agent']].map(([f, l]) => (
          <button key={f} className={`week-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {l} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Search + dropdowns */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: 180, maxWidth: 280 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '0.85rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Search players or teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px 7px 30px',
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)', color: 'var(--text)',
              fontSize: '0.85rem', fontFamily: 'var(--font)', outline: 'none',
            }}
          />
        </div>
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          style={{ padding: '7px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--text2)', fontSize: '0.82rem', fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer' }}
        >
          <option value="all">All Teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
          style={{ padding: '7px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--text2)', fontSize: '0.82rem', fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer' }}
        >
          <option value="all">All Seasons</option>
          {seasons.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text3)' }}>
          {filtered.length} results
        </span>
      </div>

      {/* Table */}
      {playersLoading ? (
        <div className="loading-screen"><div className="spinner" /><p>Loading player names…</p></div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div className="tx-header-row" style={{
            display: 'grid', gridTemplateColumns: '130px 180px 1fr 1fr 100px',
            gap: 16, padding: '10px 20px', borderBottom: '1px solid var(--border)',
          }}>
            {[['DATE', 'left'], ['TEAMS / GRADE', 'left'], ['RECEIVES', 'left'], ['SENDS', 'left'], ['TYPE', 'right']].map(([h, align]) => (
              <span key={h} style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: h === 'RECEIVES' ? 'var(--green)' : h === 'SENDS' ? 'var(--red)' : 'var(--text3)', textAlign: align }}>
                {h}
              </span>
            ))}
          </div>
          {paginated.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No transactions match your filters.</div>
            : paginated.map(renderRow)
          }
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--bg2)', border: '1px solid var(--border)', color: page === 1 ? 'var(--text3)' : 'var(--text)', cursor: page === 1 ? 'default' : 'pointer' }}>‹</button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
            .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
            .map((p, i) =>
              p === '...' ? (
                <span key={`e-${i}`} style={{ color: 'var(--text3)', padding: '0 4px' }}>…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 36, height: 36, borderRadius: 'var(--radius-pill)', background: page === p ? 'var(--purple)' : 'var(--bg2)', border: '1px solid var(--border)', color: page === p ? '#fff' : 'var(--text2)', fontWeight: page === p ? 700 : 400, cursor: 'pointer' }}>
                  {p}
                </button>
              )
            )}
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--bg2)', border: '1px solid var(--border)', color: page === pages ? 'var(--text3)' : 'var(--text)', cursor: page === pages ? 'default' : 'pointer' }}>›</button>
        </div>
      )}
    </div>
  );
}
