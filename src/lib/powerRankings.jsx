function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// Sample stdev with a league-typical fallback when a team has too few games to measure variance
function stdev(arr) {
  if (arr.length < 2) return 18;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}

function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

// Box-Muller transform for simulating a team's weekly score
function gaussianRandom(mu, sd) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function getPlayedWeeks(games) {
  const totals = {};
  games.forEach((g) => { totals[g.week] = (totals[g.week] || 0) + g.team1Points + g.team2Points; });
  return Object.entries(totals)
    .filter(([, total]) => total > 0)
    .map(([w]) => Number(w))
    .sort((a, b) => a - b);
}

function buildTeamGameLogs(games, uptoWeek) {
  const logs = {};
  games.forEach((g) => {
    if (g.week > uptoWeek) return;
    const won1 = g.winnerId === g.team1Id;
    (logs[g.team1Id] ??= []).push({ week: g.week, points: g.team1Points, opponent: g.team2Id, won: won1 });
    (logs[g.team2Id] ??= []).push({ week: g.week, points: g.team2Points, opponent: g.team1Id, won: !won1 });
  });
  Object.values(logs).forEach((l) => l.sort((a, b) => a.week - b.week));
  return logs;
}

function winPctMap(logs) {
  const map = {};
  Object.entries(logs).forEach(([id, log]) => {
    map[id] = log.length ? log.filter((g) => g.won).length / log.length : 0;
  });
  return map;
}

// Score = 40% recent form (last 4 games PF) + 30% season PF/game + 30% strength-adjusted win rate,
// each normalized 0-100 across the league so the blend is comparable.
export function computePowerScores(games, rosterMap, uptoWeek) {
  const logs = buildTeamGameLogs(games, uptoWeek);
  const winPct = winPctMap(logs);
  const rosterIds = Object.keys(rosterMap);

  const raw = rosterIds.map((id) => {
    const log = logs[id] || [];
    const allPF = log.map((g) => g.points);
    const recentPF = allPF.slice(-4);
    const seasonPFPerGame = mean(allPF);
    const recentFormPF = recentPF.length ? mean(recentPF) : seasonPFPerGame;
    const strengthAdjWins = log.length ? mean(log.map((g) => (g.won ? (winPct[g.opponent] ?? 0.5) : 0))) : 0;
    return { rosterId: id, seasonPFPerGame, recentFormPF, strengthAdjWins };
  });

  const seasonNorm = normalize(raw.map((r) => r.seasonPFPerGame));
  const recentNorm = normalize(raw.map((r) => r.recentFormPF));
  const qualityNorm = normalize(raw.map((r) => r.strengthAdjWins));

  return raw
    .map((r, i) => ({
      rosterId: r.rosterId,
      score: parseFloat((0.4 * recentNorm[i] + 0.3 * seasonNorm[i] + 0.3 * qualityNorm[i]).toFixed(1)),
      seasonPFPerGame: parseFloat(r.seasonPFPerGame.toFixed(1)),
      recentFormPF: parseFloat(r.recentFormPF.toFixed(1)),
    }))
    .sort((a, b) => b.score - a.score);
}

// SOS = average win% of opponents faced (to date) / opponents on the remaining schedule (rest of season)
export function computeStrengthOfSchedule(games, uptoWeek) {
  const logsToDate = buildTeamGameLogs(games, uptoWeek);
  const winPctToDate = winPctMap(logsToDate);

  const sos = {};
  Object.entries(logsToDate).forEach(([id, log]) => {
    const oppWinPcts = log.map((g) => winPctToDate[g.opponent] ?? 0.5);
    sos[id] = { toDate: oppWinPcts.length ? mean(oppWinPcts) : 0.5, restOfSeason: null };
  });

  const futureByTeam = {};
  games.forEach((g) => {
    if (g.week <= uptoWeek) return;
    [[g.team1Id, g.team2Id], [g.team2Id, g.team1Id]].forEach(([id, opp]) => {
      (futureByTeam[id] ??= []).push(opp);
    });
  });
  Object.entries(futureByTeam).forEach(([id, opps]) => {
    const oppWinPcts = opps.map((o) => winPctToDate[o] ?? 0.5);
    sos[id] = sos[id] || { toDate: 0.5 };
    sos[id].restOfSeason = oppWinPcts.length ? mean(oppWinPcts) : null;
  });

  return sos;
}

// Monte Carlo playoff odds: simulate the remaining schedule N times using each team's own
// scoring distribution, rank by wins/PF, and count how often each team lands in a playoff spot.
// If Sleeper hasn't published future weeks' pairings yet, falls back to a randomized round-robin
// for the remaining weeks so the feature still works mid-season.
export function simulatePlayoffOdds(games, rosterMap, uptoWeek, playoffSpots, regularSeasonEndWeek, simulations = 3000) {
  const rosterIds = Object.keys(rosterMap);
  const logsUpTo = buildTeamGameLogs(games, uptoWeek);
  const leagueAvgPF = mean(Object.values(logsUpTo).flat().map((g) => g.points)) || 110;

  const currentWins = {}, currentPF = {}, teamMean = {}, teamSd = {};
  rosterIds.forEach((id) => {
    const log = logsUpTo[id] || [];
    currentWins[id] = log.filter((g) => g.won).length;
    currentPF[id] = log.reduce((s, g) => s + g.points, 0);
    const pts = log.map((g) => g.points);
    teamMean[id] = pts.length ? mean(pts) : leagueAvgPF;
    teamSd[id] = stdev(pts);
  });

  const remainingGames = games.filter((g) => g.week > uptoWeek);
  const weeksRemaining = Math.max(0, regularSeasonEndWeek - uptoWeek);
  const useFallbackSchedule = remainingGames.length === 0 && weeksRemaining > 0;

  const playoffCounts = {};
  rosterIds.forEach((id) => (playoffCounts[id] = 0));

  for (let sim = 0; sim < simulations; sim++) {
    const wins = { ...currentWins };
    const pf = { ...currentPF };

    if (useFallbackSchedule) {
      for (let w = 0; w < weeksRemaining; w++) {
        const shuffled = [...rosterIds].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length - 1; i += 2) {
          const a = shuffled[i], b = shuffled[i + 1];
          const sa = gaussianRandom(teamMean[a], teamSd[a]);
          const sb = gaussianRandom(teamMean[b], teamSd[b]);
          pf[a] += sa; pf[b] += sb;
          if (sa >= sb) wins[a]++; else wins[b]++;
        }
      }
    } else {
      remainingGames.forEach((g) => {
        const sa = gaussianRandom(teamMean[g.team1Id], teamSd[g.team1Id]);
        const sb = gaussianRandom(teamMean[g.team2Id], teamSd[g.team2Id]);
        pf[g.team1Id] += sa; pf[g.team2Id] += sb;
        if (sa >= sb) wins[g.team1Id]++; else wins[g.team2Id]++;
      });
    }

    rosterIds
      .slice()
      .sort((a, b) => (wins[b] - wins[a]) || (pf[b] - pf[a]))
      .slice(0, playoffSpots)
      .forEach((id) => playoffCounts[id]++);
  }

  const odds = {};
  rosterIds.forEach((id) => { odds[id] = Math.round((playoffCounts[id] / simulations) * 100); });
  return odds;
}

function rankMap(entries, valueFn) {
  const sorted = [...entries].sort((a, b) => valueFn(b) - valueFn(a));
  const map = {};
  sorted.forEach((e, i) => { map[e.rosterId] = i + 1; });
  return map;
}

export function computePowerRankings(allGames, rosterMap, week, playoffSpots, regularSeasonEndWeek = 14) {
  const games = allGames.filter((g) => g.week <= regularSeasonEndWeek);

  const scores = computePowerScores(games, rosterMap, week);
  const sos = computeStrengthOfSchedule(games, week);
  const odds = simulatePlayoffOdds(games, rosterMap, week, playoffSpots, regularSeasonEndWeek);

  const prevRankMap = {};
  if (week - 1 >= 1) {
    computePowerScores(games, rosterMap, week - 1).forEach((s, i) => { prevRankMap[s.rosterId] = i + 1; });
  }

  const sosRanks = rankMap(scores, (s) => sos[s.rosterId]?.restOfSeason ?? sos[s.rosterId]?.toDate ?? 0.5);

  return scores.map((s, i) => {
    const rank = i + 1;
    const prevRank = prevRankMap[s.rosterId] ?? rank;
    return {
      rank,
      rosterId: s.rosterId,
      displayName: rosterMap[s.rosterId]?.displayName || `Team ${s.rosterId}`,
      avatar: rosterMap[s.rosterId]?.avatar,
      score: s.score,
      prevRank,
      trend: prevRank - rank,
      sosToDate: sos[s.rosterId]?.toDate ?? null,
      sosRestOfSeason: sos[s.rosterId]?.restOfSeason ?? null,
      sosRank: sosRanks[s.rosterId],
      playoffOdds: odds[s.rosterId] ?? 0,
    };
  });
}
