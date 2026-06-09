import { useState, useEffect, useCallback } from 'react';
import {
  SEASONS,
  fetchLeague,
  fetchRosters,
  fetchUsers,
  fetchAllMatchups,
  fetchWinnersBracket,
  fetchLosersBracket,
  fetchAllTransactions,
  fetchNflState,
} from '../lib/sleeper.jsx';
import {
  buildRosterMap,
  flattenMatchups,
  buildGames,
  computeH2H,
  computeScheduleLuck,
  computeSuperlatives,
} from '../lib/analytics.jsx';

async function loadSeason(leagueId, season) {
  const [league, rosters, users, nflState, winnersBracket, losersBracket] = await Promise.all([
    fetchLeague(leagueId),
    fetchRosters(leagueId),
    fetchUsers(leagueId),
    fetchNflState(),
    fetchWinnersBracket(leagueId).catch(() => []),
    fetchLosersBracket(leagueId).catch(() => []),
  ]);

  // Always fetch all 18 weeks — nflState.week reflects the current NFL calendar
  // which may be week 1 of a new season in the offseason. Empty weeks return [] gracefully.
  const TOTAL_WEEKS = 18;
  const currentWeek = nflState.week || 1;
  const allMatchupsRaw = await fetchAllMatchups(leagueId, TOTAL_WEEKS);
  const transactions = await fetchAllTransactions(leagueId, TOTAL_WEEKS);

  const rosterMap = buildRosterMap(rosters, users);
  const flatEntries = flattenMatchups(allMatchupsRaw, season);
  const games = buildGames(flatEntries);

  // Build standings from rosters
  const standings = rosters.map((r) => {
    const user = users.find((u) => u.user_id === r.owner_id) || {};
    return {
      rosterId: r.roster_id,
      displayName: user.display_name || user.username || `Team ${r.roster_id}`,
      avatar: user.avatar || null,
      wins: r.settings?.wins || 0,
      losses: r.settings?.losses || 0,
      ties: r.settings?.ties || 0,
      pointsFor: r.settings?.fpts + (r.settings?.fpts_decimal || 0) / 100 || 0,
      pointsAgainst: r.settings?.fpts_against + (r.settings?.fpts_against_decimal || 0) / 100 || 0,
      streak: r.metadata?.streak || null,
      playoffSeed: r.settings?.rank || null,
    };
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  let championRosterId = null;
  if (Array.isArray(winnersBracket) && winnersBracket.length) {
    console.log('[bracket]', season, JSON.stringify(winnersBracket));
    // Sleeper marks the championship game with p=1; fall back to highest round m=1
    const byPlacement = winnersBracket.find((m) => m.p === 1 && m.w);
    if (byPlacement) {
      championRosterId = byPlacement.w;
    } else {
      const maxRound = Math.max(...winnersBracket.map((m) => m.r));
      const champMatch = winnersBracket.find((m) => m.r === maxRound && m.m === 1 && m.w);
      if (champMatch) championRosterId = champMatch.w;
    }
  }
  console.log('[champion]', season, championRosterId);

  return {
    league,
    rosters,
    users,
    rosterMap,
    standings,
    allMatchupsRaw,
    games,
    flatEntries,
    transactions,
    winnersBracket,
    losersBracket,
    nflState,
    currentWeek,
    season,
    championRosterId,
  };
}

export function useLeagueData(selectedSeason) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedSeason === 'all') {
        const [data2024, data2025, data2026] = await Promise.all([
          loadSeason(SEASONS['2024'], '2024'),
          loadSeason(SEASONS['2025'], '2025'),
          loadSeason(SEASONS['2026'], '2026'),
        ]);

        // Build taggedId -> ownerId map so cross-season analytics use stable owner identity
        const taggedToOwner = {};
        Object.values(data2024.rosterMap).forEach((t) => { taggedToOwner[`2024_${t.rosterId}`] = t.ownerId; });
        Object.values(data2025.rosterMap).forEach((t) => { taggedToOwner[`2025_${t.rosterId}`] = t.ownerId; });
        Object.values(data2026.rosterMap).forEach((t) => { taggedToOwner[`2026_${t.rosterId}`] = t.ownerId; });

        // Owner-keyed rosterMap for analytics (prefer most recent display info)
        const ownerRosterMap = {};
        [data2024, data2025, data2026].forEach((sd) => {
          Object.values(sd.rosterMap).forEach((t) => {
            ownerRosterMap[t.ownerId] = { rosterId: t.ownerId, displayName: t.displayName, avatar: t.avatar, ownerId: t.ownerId };
          });
        });

        // Tag games then re-map to owner IDs so the same two owners across seasons are one rivalry
        const tag = (games, season) =>
          games.map((g) => ({
            ...g,
            team1Id: `${season}_${g.team1Id}`,
            team2Id: `${season}_${g.team2Id}`,
            winnerId: `${season}_${g.winnerId}`,
          }));

        const allGames = [
          ...tag(data2024.games, '2024'),
          ...tag(data2025.games, '2025'),
          ...tag(data2026.games, '2026'),
        ];

        const ownerGames = allGames.map((g) => ({
          ...g,
          team1Id: taggedToOwner[g.team1Id] || g.team1Id,
          team2Id: taggedToOwner[g.team2Id] || g.team2Id,
          winnerId: taggedToOwner[g.winnerId] || g.winnerId,
        }));

        const h2h = computeH2H(ownerGames, ownerRosterMap);
        const scheduleLuck = computeScheduleLuck(ownerGames, ownerRosterMap);
        const superlatives = computeSuperlatives(ownerGames, ownerRosterMap, []);

        // Build combined all-time standings matched by Sleeper user_id (stable across seasons)
        const ownerTotals = {};
        const addToTotals = (seasonData, preferDisplay) => {
          seasonData.rosters.forEach((r) => {
            const ownerId = r.owner_id;
            if (!ownerId) return;
            const user = seasonData.users.find((u) => u.user_id === ownerId) || {};
            const displayName = user.display_name || user.username || `Team ${r.roster_id}`;
            const avatar = user.avatar || null;
            const wins = r.settings?.wins || 0;
            const losses = r.settings?.losses || 0;
            const pf = (r.settings?.fpts || 0) + (r.settings?.fpts_decimal || 0) / 100;
            const pa = (r.settings?.fpts_against || 0) + (r.settings?.fpts_against_decimal || 0) / 100;
            if (!ownerTotals[ownerId]) {
              ownerTotals[ownerId] = { rosterId: ownerId, displayName, avatar, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
            }
            ownerTotals[ownerId].wins += wins;
            ownerTotals[ownerId].losses += losses;
            ownerTotals[ownerId].pointsFor += pf;
            ownerTotals[ownerId].pointsAgainst += pa;
            if (preferDisplay) {
              ownerTotals[ownerId].displayName = displayName;
              ownerTotals[ownerId].avatar = avatar;
            }
          });
        };
        addToTotals(data2024, false);
        addToTotals(data2025, false);
        addToTotals(data2026, true);
        const allTimeStandings = Object.values(ownerTotals).sort((a, b) =>
          b.wins !== a.wins ? b.wins - a.wins : b.pointsFor - a.pointsFor
        );

        setData({
          mode: 'all',
          seasons: { '2024': data2024, '2025': data2025, '2026': data2026 },
          rosterMap: ownerRosterMap,
          allGames: ownerGames,
          allTimeStandings,
          h2h,
          scheduleLuck,
          superlatives,
          currentSeasonData: data2026,
        });
      } else {
        const leagueId = SEASONS[selectedSeason];
        const seasonData = await loadSeason(leagueId, selectedSeason);
        const h2h = computeH2H(seasonData.games, seasonData.rosterMap);
        const scheduleLuck = computeScheduleLuck(seasonData.games, seasonData.rosterMap);
        const superlatives = computeSuperlatives(seasonData.games, seasonData.rosterMap, seasonData.standings);

        setData({
          mode: 'single',
          season: selectedSeason,
          ...seasonData,
          h2h,
          scheduleLuck,
          superlatives,
          allGames: seasonData.games,
          currentSeasonData: seasonData,
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load league data');
    } finally {
      setLoading(false);
    }
  }, [selectedSeason]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
