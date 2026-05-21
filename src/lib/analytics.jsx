// Build a lookup: rosterId -> { rosterId, displayName, avatarUrl }
export function buildRosterMap(rosters, users) {
  const userMap = {};
  users.forEach((u) => {
    userMap[u.user_id] = u;
  });
  const map = {};
  rosters.forEach((r) => {
    const user = userMap[r.owner_id] || {};
    map[r.roster_id] = {
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      displayName: user.display_name || user.username || `Team ${r.roster_id}`,
      avatar: user.avatar || null,
      username: user.username || null,
    };
  });
  return map;
}

// Merge two rosterMaps across seasons by matching on username/ownerId
export function mergeRosterMaps(map2024, map2025) {
  const merged = { ...map2025 };
  // For any owner in 2024 not already in 2025, assign a synthetic key
  const existingOwnerIds = new Set(Object.values(map2025).map((v) => v.ownerId));
  Object.values(map2024).forEach((team) => {
    if (!existingOwnerIds.has(team.ownerId)) {
      merged[`2024_${team.rosterId}`] = { ...team, rosterId: `2024_${team.rosterId}` };
    }
  });
  return merged;
}

// Given allMatchupsData [{week, data}], build per-week pair matchups
// Returns: [{ week, season, rosterId, points, matchupId }]
export function flattenMatchups(allMatchupsData, season) {
  const flat = [];
  allMatchupsData.forEach(({ week, data }) => {
    if (!data || data.length === 0) return;
    data.forEach((entry) => {
      flat.push({
        week,
        season,
        rosterId: entry.roster_id,
        points: entry.points || 0,
        matchupId: entry.matchup_id,
      });
    });
  });
  return flat;
}

// Group flat matchup entries into head-to-head game objects
// Returns: [{ week, season, team1Id, team1Points, team2Id, team2Points, winnerId }]
export function buildGames(flatEntries) {
  const byWeekMatchup = {};
  flatEntries.forEach((e) => {
    if (e.matchupId == null) return;
    const key = `${e.season}_${e.week}_${e.matchupId}`;
    if (!byWeekMatchup[key]) byWeekMatchup[key] = [];
    byWeekMatchup[key].push(e);
  });

  const games = [];
  Object.values(byWeekMatchup).forEach((pair) => {
    if (pair.length !== 2) return;
    const [a, b] = pair;
    const winnerId = a.points >= b.points ? a.rosterId : b.rosterId;
    games.push({
      week: a.week,
      season: a.season,
      team1Id: a.rosterId,
      team1Points: a.points,
      team2Id: b.rosterId,
      team2Points: b.points,
      winnerId,
    });
  });
  return games;
}

// Compute head-to-head records for every pair of teams
// Returns: Map<"id1_id2", { teamA, teamB, wins: {[id]: n}, totalGames, games[], avgMargin, closestGame, biggestBlowout }>
export function computeH2H(games, rosterMap) {
  const records = {};

  const pairKey = (a, b) => {
    const ids = [String(a), String(b)].sort();
    return ids.join('_');
  };

  games.forEach((game) => {
    const key = pairKey(game.team1Id, game.team2Id);
    if (!records[key]) {
      const ids = [String(game.team1Id), String(game.team2Id)].sort();
      records[key] = {
        teamAId: ids[0],
        teamBId: ids[1],
        wins: { [ids[0]]: 0, [ids[1]]: 0 },
        games: [],
        totalGames: 0,
      };
    }
    const rec = records[key];
    rec.games.push(game);
    rec.totalGames++;
    rec.wins[String(game.winnerId)] = (rec.wins[String(game.winnerId)] || 0) + 1;
  });

  // Compute derived stats
  Object.values(records).forEach((rec) => {
    const margins = rec.games.map((g) => Math.abs(g.team1Points - g.team2Points));
    rec.avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
    rec.closestGame = rec.games.reduce((best, g) => {
      const margin = Math.abs(g.team1Points - g.team2Points);
      const bestMargin = Math.abs(best.team1Points - best.team2Points);
      return margin < bestMargin ? g : best;
    }, rec.games[0]);
    rec.biggestBlowout = rec.games.reduce((best, g) => {
      const margin = Math.abs(g.team1Points - g.team2Points);
      const bestMargin = Math.abs(best.team1Points - best.team2Points);
      return margin > bestMargin ? g : best;
    }, rec.games[0]);

    // Determine dominant team
    const [idA, idB] = [rec.teamAId, rec.teamBId];
    const winsA = rec.wins[idA] || 0;
    const winsB = rec.wins[idB] || 0;
    rec.dominantId = winsA >= winsB ? idA : idB;
    rec.dominated = winsA >= winsB ? idB : idA;
    rec.dominantWins = Math.max(winsA, winsB);
    rec.dominatedLosses = Math.min(winsA, winsB);
  });

  return records;
}

// Generate a human-readable rivalry narrative
export function generateRivalryNarrative(rec, rosterMap) {
  const nameA = rosterMap[rec.teamAId]?.displayName || `Team ${rec.teamAId}`;
  const nameB = rosterMap[rec.teamBId]?.displayName || `Team ${rec.teamBId}`;
  const winsA = rec.wins[rec.teamAId] || 0;
  const winsB = rec.wins[rec.teamBId] || 0;
  const dominant = winsA >= winsB ? nameA : nameB;
  const loser = winsA >= winsB ? nameB : nameA;
  const domWins = Math.max(winsA, winsB);
  const domLosses = Math.min(winsA, winsB);
  const margin = rec.avgMargin.toFixed(1);

  if (domWins === domLosses) {
    return `${nameA} and ${nameB} are perfectly deadlocked at ${domWins}-${domLosses}. Every game matters.`;
  }
  if (domWins - domLosses === 1) {
    return `${dominant} holds a narrow ${domWins}-${domLosses} edge over ${loser}, winning by ${margin} pts on average. This one's a real nail-biter.`;
  }
  if (domWins >= domLosses * 3 && domLosses === 0) {
    return `${dominant} completely owns ${loser} at ${domWins}-0. It's not even close.`;
  }
  if (domWins >= domLosses * 2) {
    return `${dominant} dominates ${loser} ${domWins}-${domLosses}, winning by ${margin} pts on average. ${loser} is still searching for answers.`;
  }
  return `${dominant} leads ${loser} ${domWins}-${domLosses}, winning by ${margin} pts on average — a true rivalry.`;
}

// Compute schedule luck: actual wins vs expected wins
// Expected wins = for each week, how many opponents would you have beaten?
export function computeScheduleLuck(games, rosterMap) {
  const rosterIds = Object.keys(rosterMap);
  const weekMap = {};

  games.forEach((g) => {
    const key = `${g.season}_${g.week}`;
    if (!weekMap[key]) weekMap[key] = [];
    weekMap[key].push(g);
  });

  const actualWins = {};
  const expectedWins = {};
  const actualLosses = {};
  const pf = {};

  rosterIds.forEach((id) => {
    actualWins[id] = 0;
    actualLosses[id] = 0;
    expectedWins[id] = 0;
    pf[id] = 0;
  });

  Object.values(weekMap).forEach((weekGames) => {
    // Collect all scores this week
    const scores = {};
    weekGames.forEach((g) => {
      scores[g.team1Id] = g.team1Points;
      scores[g.team2Id] = g.team2Points;
    });

    const participants = Object.keys(scores);
    const allScores = Object.values(scores);

    participants.forEach((id) => {
      pf[id] = (pf[id] || 0) + scores[id];

      // Expected wins: beat how many others this week?
      const beaten = allScores.filter((s) => s < scores[id]).length;
      expectedWins[id] += beaten / (allScores.length - 1);
    });

    // Actual wins from matchup results
    weekGames.forEach((g) => {
      if (g.team1Points > g.team2Points) {
        actualWins[g.team1Id]++;
        actualLosses[g.team2Id]++;
      } else {
        actualWins[g.team2Id]++;
        actualLosses[g.team1Id]++;
      }
    });
  });

  return rosterIds.map((id) => ({
    rosterId: id,
    displayName: rosterMap[id]?.displayName || `Team ${id}`,
    avatar: rosterMap[id]?.avatar,
    actualWins: actualWins[id] || 0,
    actualLosses: actualLosses[id] || 0,
    expectedWins: parseFloat((expectedWins[id] || 0).toFixed(1)),
    luckDelta: parseFloat(((actualWins[id] || 0) - (expectedWins[id] || 0)).toFixed(1)),
    pointsFor: parseFloat((pf[id] || 0).toFixed(2)),
  })).sort((a, b) => b.luckDelta - a.luckDelta);
}

// Compute all superlative moments
export function computeSuperlatives(games, rosterMap, standings) {
  if (!games.length) return {};

  const allScores = [];
  games.forEach((g) => {
    allScores.push({ rosterId: g.team1Id, points: g.team1Points, week: g.week, season: g.season, opponent: g.team2Id, opponentPoints: g.team2Points });
    allScores.push({ rosterId: g.team2Id, points: g.team2Points, week: g.week, season: g.season, opponent: g.team1Id, opponentPoints: g.team1Points });
  });

  const name = (id) => rosterMap[id]?.displayName || `Team ${id}`;

  const highScore = allScores.reduce((best, s) => s.points > best.points ? s : best, allScores[0]);
  const lowScore = allScores.reduce((worst, s) => s.points < worst.points ? s : worst, allScores[0]);

  // Season totals
  const seasonTotals = {};
  allScores.forEach((s) => {
    const key = `${s.season}_${s.rosterId}`;
    seasonTotals[key] = (seasonTotals[key] || 0) + s.points;
  });
  const totalEntries = Object.entries(seasonTotals).map(([key, pts]) => {
    const [season, ...rest] = key.split('_');
    const rosterId = rest.join('_');
    return { rosterId, season, points: pts };
  });
  const mostPoints = totalEntries.reduce((best, e) => e.points > best.points ? e : best, totalEntries[0]);
  const leastPoints = totalEntries.reduce((worst, e) => e.points < worst.points ? e : worst, totalEntries[0]);

  // Wins per team per season
  const winsMap = {};
  const lossesMap = {};
  games.forEach((g) => {
    const key = `${g.season}_${g.winnerId}`;
    winsMap[key] = (winsMap[key] || 0) + 1;
    const loserId = g.team1Id === g.winnerId ? g.team2Id : g.team1Id;
    const lkey = `${g.season}_${loserId}`;
    lossesMap[lkey] = (lossesMap[lkey] || 0) + 1;
  });

  // Most wins = best record
  const winEntries = Object.entries(winsMap).map(([key, wins]) => {
    const [season, ...rest] = key.split('_');
    const rosterId = rest.join('_');
    return { rosterId, season, wins };
  });
  const bestRecord = winEntries.reduce((best, e) => e.wins > best.wins ? e : best, winEntries[0]);

  // Lucky = best record with fewest points
  const luckEntries = Object.entries(winsMap).map(([key, wins]) => {
    const [season, ...rest] = key.split('_');
    const rosterId = rest.join('_');
    const pts = seasonTotals[`${season}_${rosterId}`] || 0;
    return { rosterId, season, wins, pts };
  });
  const lucky = luckEntries.reduce((best, e) => {
    if (e.wins > best.wins) return e;
    if (e.wins === best.wins && e.pts < best.pts) return e;
    return best;
  }, luckEntries[0]);

  // Unlucky = most points but fewest wins
  const unlucky = luckEntries.reduce((worst, e) => {
    if (e.wins < worst.wins) return e;
    if (e.wins === worst.wins && e.pts > worst.pts) return e;
    return worst;
  }, luckEntries[0]);

  // Biggest blowout
  const biggestBlowout = games.reduce((worst, g) => {
    const margin = Math.abs(g.team1Points - g.team2Points);
    const worstMargin = Math.abs(worst.team1Points - worst.team2Points);
    return margin > worstMargin ? g : worst;
  }, games[0]);

  // Closest win
  const closestWin = games.reduce((best, g) => {
    const margin = Math.abs(g.team1Points - g.team2Points);
    const bestMargin = Math.abs(best.team1Points - best.team2Points);
    return margin < bestMargin ? g : best;
  }, games[0]);

  // Streaks — sort each team's games chronologically then scan
  const teamGames = {};
  games.forEach((g) => {
    [g.team1Id, g.team2Id].forEach((id) => {
      if (!teamGames[id]) teamGames[id] = [];
      teamGames[id].push({ season: g.season, week: g.week, won: g.winnerId === id });
    });
  });
  Object.values(teamGames).forEach((tg) =>
    tg.sort((a, b) => a.season !== b.season ? String(a.season).localeCompare(String(b.season)) : a.week - b.week)
  );

  let longestWinStreak  = { rosterId: null, length: 0, startWeek: null, startSeason: null };
  let longestLossStreak = { rosterId: null, length: 0, startWeek: null, startSeason: null };

  Object.entries(teamGames).forEach(([id, tg]) => {
    let curWin = 0, curLoss = 0;
    let winStart = null, lossStart = null;
    tg.forEach((g) => {
      if (g.won) {
        curWin++;
        if (!winStart) winStart = g;
        curLoss = 0; lossStart = null;
        if (curWin > longestWinStreak.length)
          longestWinStreak = { rosterId: id, length: curWin, startWeek: winStart.week, startSeason: winStart.season };
      } else {
        curLoss++;
        if (!lossStart) lossStart = g;
        curWin = 0; winStart = null;
        if (curLoss > longestLossStreak.length)
          longestLossStreak = { rosterId: id, length: curLoss, startWeek: lossStart.week, startSeason: lossStart.season };
      }
    });
  });

  return {
    highScore: { ...highScore, name: name(highScore.rosterId) },
    lowScore: { ...lowScore, name: name(lowScore.rosterId) },
    mostPoints: { ...mostPoints, name: name(mostPoints.rosterId) },
    leastPoints: { ...leastPoints, name: name(leastPoints.rosterId) },
    bestRecord: { ...bestRecord, name: name(bestRecord.rosterId) },
    lucky: { ...lucky, name: name(lucky.rosterId) },
    unlucky: { ...unlucky, name: name(unlucky.rosterId) },
    biggestBlowout: {
      ...biggestBlowout,
      winnerName: name(biggestBlowout.winnerId),
      loserName: name(biggestBlowout.team1Id === biggestBlowout.winnerId ? biggestBlowout.team2Id : biggestBlowout.team1Id),
      margin: Math.abs(biggestBlowout.team1Points - biggestBlowout.team2Points).toFixed(1),
    },
    closestWin: {
      ...closestWin,
      winnerName: name(closestWin.winnerId),
      loserName: name(closestWin.team1Id === closestWin.winnerId ? closestWin.team2Id : closestWin.team1Id),
      margin: Math.abs(closestWin.team1Points - closestWin.team2Points).toFixed(1),
    },
    longestWinStreak: longestWinStreak.rosterId
      ? { ...longestWinStreak, name: name(longestWinStreak.rosterId) }
      : null,
    longestLossStreak: longestLossStreak.rosterId
      ? { ...longestLossStreak, name: name(longestLossStreak.rosterId) }
      : null,
  };
}
