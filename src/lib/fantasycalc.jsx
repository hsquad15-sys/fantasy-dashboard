const FC_URL = 'https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&ppr=1';
let _fcCache = null;

export async function fetchFantasyCalcValues() {
  if (_fcCache) return _fcCache;
  try {
    const res = await fetch(FC_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    _fcCache = await res.json();
    return _fcCache;
  } catch {
    return null;
  }
}

const normalize = (s) => (s || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

export function buildValueMap(fcValues) {
  if (!fcValues) return {};
  const map = {};
  for (const entry of fcValues) {
    const key = normalize(entry.player?.name);
    if (key && entry.value) map[key] = entry.value;
  }
  return map;
}

const ROUND_NAMES = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

export function lookupPickValue(valueMap, round, season) {
  const key = normalize(`${season} ${ROUND_NAMES[round] || `${round}th`}`);
  return valueMap[key] || 0;
}

export function lookupPlayerValue(valueMap, players, playerId) {
  if (!players || !valueMap || !playerId) return 0;
  const p = players[playerId];
  if (!p) return 0;
  const name = normalize(`${p.first_name || ''} ${p.last_name || ''}`);
  return valueMap[name] || 0;
}

// pct = (received - sent) / (total / 2) * 100
// ranges -200 (got nothing) to +200 (gave nothing)
export function gradeTradeTeam(received, sent) {
  const total = received + sent;
  if (total < 300) return null;
  const pct = ((received - sent) / (total / 2)) * 100;
  if (pct >= 30)  return { grade: 'A+', color: '#4ade80', pct };
  if (pct >= 12)  return { grade: 'A',  color: '#86efac', pct };
  if (pct >= 4)   return { grade: 'B+', color: '#a3e635', pct };
  if (pct >= -4)  return { grade: 'B',  color: '#facc15', pct };
  if (pct >= -12) return { grade: 'C',  color: '#fb923c', pct };
  if (pct >= -30) return { grade: 'D',  color: '#f87171', pct };
  return { grade: 'F', color: '#ef4444', pct };
}
