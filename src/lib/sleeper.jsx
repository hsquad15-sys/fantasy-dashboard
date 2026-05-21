export const USER_ID = '591358817996939264';

export const SEASONS = {
  '2024': '1130652624027676672',
  '2025': '1185277150819115008',
};

export const DEFAULT_SEASON = '2025';

const BASE = 'https://api.sleeper.app/v1';

export const avatarUrl = (avatarId) =>
  avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : null;

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sleeper API error ${res.status}: ${url}`);
  return res.json();
}

export const fetchLeague = (leagueId) => get(`${BASE}/league/${leagueId}`);
export const fetchRosters = (leagueId) => get(`${BASE}/league/${leagueId}/rosters`);
export const fetchUsers = (leagueId) => get(`${BASE}/league/${leagueId}/users`);
export const fetchMatchups = (leagueId, week) => get(`${BASE}/league/${leagueId}/matchups/${week}`);
export const fetchWinnersBracket = (leagueId) => get(`${BASE}/league/${leagueId}/winners_bracket`);
export const fetchLosersBracket = (leagueId) => get(`${BASE}/league/${leagueId}/losers_bracket`);
export const fetchTransactions = (leagueId, week) =>
  get(`${BASE}/league/${leagueId}/transactions/${week}`);
export const fetchNflState = () => get(`${BASE}/state/nfl`);

// Cached in memory for the session — the full NFL players file is ~8MB
let _playersCache = null;
export async function fetchPlayers() {
  if (_playersCache) return _playersCache;
  _playersCache = await get(`${BASE}/players/nfl`);
  return _playersCache;
}

export function playerName(players, id) {
  if (!players || !id) return id;
  const p = players[id];
  if (!p) return id;
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return name || id;
}

export function playerLabel(players, id) {
  if (!players || !id) return id;
  const p = players[id];
  if (!p) return id;
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
  const pos = p.position || '';
  const team = p.team || '';
  const meta = [pos, team].filter(Boolean).join(', ');
  return meta ? `${name} (${meta})` : name || id;
}

export async function fetchAllMatchups(leagueId, totalWeeks = 18) {
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const results = await Promise.all(
    weeks.map((w) =>
      fetchMatchups(leagueId, w).then((data) => ({ week: w, data })).catch(() => ({ week: w, data: [] }))
    )
  );
  return results;
}

export async function fetchAllTransactions(leagueId, totalWeeks = 18) {
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const results = await Promise.all(
    weeks.map((w) =>
      fetchTransactions(leagueId, w).then((data) => ({ week: w, data })).catch(() => ({ week: w, data: [] }))
    )
  );
  return results.flatMap((r) => r.data).filter(Boolean);
}
