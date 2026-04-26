const DEFAULT_FEED_BASE_URL = "https://scores.iplt20.com/ipl/feeds";
const SCORE_LOCK_BALL = 43;
const PLAYER_NAME_PARTICLES = new Set([
  "al",
  "bin",
  "da",
  "de",
  "del",
  "der",
  "di",
  "jr",
  "la",
  "le",
  "st",
  "van",
  "von",
]);
const PLAYER_NAME_IGNORED_TAGS = new Set([
  "c",
  "cs",
  "ip",
  "rp",
  "sub",
  "wk",
]);

async function syncActiveMatches({
  supabaseUrl,
  supabaseServiceRoleKey,
  limit = 40,
  leagueId = null,
} = {}) {
  const rawMatches = await fetchTrackedMatches(
    supabaseUrl,
    supabaseServiceRoleKey,
    Math.max(Number(limit) * 3 || 120, 60),
    { leagueId },
  );
  const matches = rawMatches
    .filter((match) => shouldAutoSyncMatch(match))
    .slice(0, Math.max(Number(limit) || 40, 1));

  const report = {
    scanned: rawMatches.length,
    queued: matches.length,
    synced: 0,
    settled: 0,
    failed: 0,
    skipped: rawMatches.length - matches.length,
    details: [],
  };

  for (const match of matches) {
    try {
      const snapshot = await fetchProviderMatchSnapshot(match.external_match_id, match);
      const settlement = extractOfficialSettlementPayload(
        snapshot?.official_scorecard_bundle,
        match,
        snapshot,
      );
      const persistedStatus = computePersistedProviderStatus(
        snapshot,
        match,
        Boolean(settlement),
      );
      const partialSettlementMessage =
        !settlement && snapshot?.status === "completed"
          ? "Official result is complete but point extraction is waiting for the full scorecard."
          : null;

      await updateMatch(
        supabaseUrl,
        supabaseServiceRoleKey,
        match.id,
        buildMatchUpdatePayload(match, snapshot, {
          persistedStatus,
          syncError: partialSettlementMessage,
        }),
      );

      report.synced += 1;

      if (persistedStatus === "cancelled") {
        await deleteMatchResult(
          supabaseUrl,
          supabaseServiceRoleKey,
          match.id,
        );
        report.details.push({
          match_id: match.id,
          title: match.title,
          status: "cancelled",
        });
        continue;
      }

      if (settlement) {
        await upsertMatchResult(
          supabaseUrl,
          supabaseServiceRoleKey,
          match,
          settlement,
        );
        await updateMatch(supabaseUrl, supabaseServiceRoleKey, match.id, {
          status: "completed",
          sync_error: null,
        });
        report.settled += 1;
      }

      report.details.push({
        match_id: match.id,
        title: match.title,
        status: settlement ? "settled" : snapshot?.status || "synced",
      });
    } catch (error) {
      report.failed += 1;
      const message = cleanText(error?.message || "Sync failed.", 300);
      await updateMatch(supabaseUrl, supabaseServiceRoleKey, match.id, {
        sync_error: message,
      }).catch(() => {});
      report.details.push({
        match_id: match.id,
        title: match.title,
        status: "failed",
        error: message,
      });
    }
  }

  return report;
}

async function fetchTrackedMatches(
  supabaseUrl,
  supabaseServiceRoleKey,
  limit,
  { leagueId = null } = {},
) {
  const select =
    "id,league_id,title,team_a,team_b,venue,starts_at,status,notes,created_by,provider,external_match_id,series_name,playing_xi,current_innings_ball,current_over_display,auto_sync_enabled,last_synced_at,sync_error";
  const rows = await supabaseRequest(supabaseUrl, supabaseServiceRoleKey, "matches", {
    params: {
      select,
      auto_sync_enabled: "is.true",
      external_match_id: "not.is.null",
      status: "not.eq.cancelled",
      league_id: leagueId ? `eq.${leagueId}` : undefined,
      order: "starts_at.asc.nullslast",
      limit: String(limit),
    },
  });

  return asArray(rows);
}

async function updateMatch(supabaseUrl, supabaseServiceRoleKey, matchId, payload) {
  const body = Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined),
  );
  if (!Object.keys(body).length) {
    return null;
  }

  await supabaseRequest(supabaseUrl, supabaseServiceRoleKey, "matches", {
    method: "PATCH",
    params: {
      id: `eq.${matchId}`,
    },
    headers: {
      Prefer: "return=minimal",
    },
    body,
  });

  return true;
}

async function upsertMatchResult(
  supabaseUrl,
  supabaseServiceRoleKey,
  match,
  settlement,
) {
  const nowIso = new Date().toISOString();
  await supabaseRequest(supabaseUrl, supabaseServiceRoleKey, "match_results", {
    method: "POST",
    params: {
      on_conflict: "match_id",
    },
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: {
      match_id: match.id,
      winner_team: settlement.winner_team,
      first_innings_total: settlement.first_innings_total,
      batsman_runs: normalizeResultScoreMap(settlement.batsman_runs, match),
      bowler_wickets: normalizeResultScoreMap(settlement.bowler_wickets, match),
      notes: settlement.notes,
      settled_by: match.created_by,
      settled_at: nowIso,
    },
  });
}

async function deleteMatchResult(supabaseUrl, supabaseServiceRoleKey, matchId) {
  await supabaseRequest(supabaseUrl, supabaseServiceRoleKey, "match_results", {
    method: "DELETE",
    params: {
      match_id: `eq.${matchId}`,
    },
    headers: {
      Prefer: "return=minimal",
    },
  });
}

function buildMatchUpdatePayload(
  match,
  snapshot,
  { persistedStatus, syncError = null } = {},
) {
  const nowIso = new Date().toISOString();
  const nextStatus =
    cleanNullableText(persistedStatus, 20) ||
    cleanNullableText(snapshot?.status, 20) ||
    match?.status ||
    "scheduled";
  const isCancelled = nextStatus === "cancelled";
  const currentBall =
    isCancelled ? null : snapshot?.current_innings_ball ?? match?.current_innings_ball ?? null;
  const overDisplay =
    isCancelled
      ? null
      : cleanNullableText(snapshot?.current_over_display, 20) ||
        (currentBall !== null ? formatBallsAsOvers(currentBall) : null) ||
        match?.current_over_display ||
        null;

  return {
    title: cleanText(snapshot?.title || match?.title, 120),
    team_a: cleanNullableText(snapshot?.team_a, 80) || match?.team_a,
    team_b: cleanNullableText(snapshot?.team_b, 80) || match?.team_b,
    venue: cleanNullableText(snapshot?.venue, 120) || match?.venue || null,
    provider: cleanNullableText(snapshot?.provider, 40) || match?.provider || "ipl-official",
    series_name:
      cleanNullableText(snapshot?.series_name, 120) || match?.series_name || null,
    status: nextStatus,
    current_innings_ball: currentBall,
    current_over_display: overDisplay,
    auto_sync_enabled: isCancelled ? false : match?.auto_sync_enabled ?? true,
    last_synced_at: nowIso,
    sync_error: isCancelled ? null : syncError,
  };
}

function shouldAutoSyncMatch(match) {
  if (!match?.external_match_id || !match?.auto_sync_enabled) {
    return false;
  }

  if (match.status === "cancelled") {
    return false;
  }

  if (!match.starts_at) {
    return true;
  }

  const startsAt = new Date(match.starts_at).getTime();
  if (Number.isNaN(startsAt)) {
    return true;
  }

  const now = Date.now();
  return startsAt <= now + 36 * 60 * 60 * 1000 && startsAt >= now - 48 * 60 * 60 * 1000;
}

function computePersistedProviderStatus(snapshot, existingMatch, settlementReady = false) {
  const nextStatus =
    cleanNullableText(snapshot?.status, 20) || existingMatch?.status || "scheduled";

  if (nextStatus !== "completed") {
    return nextStatus;
  }

  if (settlementReady) {
    return "completed";
  }

  const previousStatus = cleanNullableText(existingMatch?.status, 20);
  if (previousStatus === "live" || previousStatus === "locked") {
    return previousStatus;
  }

  return "locked";
}

async function fetchProviderMatchSnapshot(externalMatchId, fallbackMatch = null) {
  try {
    return normalizeOfficialLiveSnapshot(await fetchOfficialMatchBundle(externalMatchId));
  } catch (error) {
    if (shouldUseOfficialScheduledFallback(error, fallbackMatch)) {
      return buildOfficialScheduledSnapshot(fallbackMatch, externalMatchId);
    }

    throw error;
  }
}

async function fetchOfficialMatchBundle(matchId) {
  const summaryPayload = await fetchOfficialFeedJson("match-summary", { matchId });
  const summary = asArray(summaryPayload?.MatchSummary)[0] || null;
  if (!summary) {
    throw new Error("Official IPL match summary is unavailable.");
  }

  const inningsNumbers = [1];
  const currentInnings = Math.max(toOptionalInteger(summary?.CurrentInnings) || 1, 1);
  if (currentInnings >= 2 || toOptionalInteger(summary?.IsMatchEnd) === 1) {
    inningsNumbers.push(2);
  }
  if (currentInnings >= 4) {
    inningsNumbers.push(3, 4);
  }
  if (currentInnings >= 6) {
    inningsNumbers.push(5, 6);
  }

  const innings = (
    await Promise.all(
      Array.from(new Set(inningsNumbers)).map(async (inningsNo) => {
        try {
          const payload = await fetchOfficialFeedJson("match-innings", {
            matchId,
            inningsNo,
          });
          return payload?.[`Innings${inningsNo}`] || null;
        } catch (error) {
          return null;
        }
      }),
    )
  ).filter(Boolean);

  return {
    provider: "ipl-official",
    summary,
    innings,
  };
}

async function fetchOfficialFeedJson(kind, params = {}) {
  if (kind === "match-summary") {
    return fetchJsonpPayload(`${DEFAULT_FEED_BASE_URL}/${params.matchId}-matchsummary.js`);
  }

  if (kind === "match-innings") {
    return fetchJsonpPayload(
      `${DEFAULT_FEED_BASE_URL}/${params.matchId}-Innings${params.inningsNo}.js`,
    );
  }

  throw new Error("Unsupported official IPL request.");
}

async function fetchJsonpPayload(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/javascript, text/javascript, */*;q=0.1",
      "User-Agent": "IPL-Prediction-League/1.0",
    },
  });

  if (!response.ok) {
    const error = new Error(`Official IPL feed returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return parseJsonpPayload(await response.text());
}

function parseJsonpPayload(source) {
  const text = String(source || "").trim();
  const startIndex = text.indexOf("(");
  const endIndex = text.lastIndexOf(")");

  if (startIndex < 0 || endIndex <= startIndex) {
    throw new Error("Official IPL feed returned an unexpected format.");
  }

  return JSON.parse(text.slice(startIndex + 1, endIndex));
}

function normalizeOfficialLiveSnapshot(bundle) {
  const summary = bundle?.summary || {};
  const innings = asArray(bundle?.innings);
  const inningsOne =
    innings.find((entry) => toOptionalInteger(entry?.InningsNo) === 1) || innings[0] || null;
  const firstInningsBallCount = extractOfficialBallsFromInnings(inningsOne);
  const currentInnings = Math.max(toOptionalInteger(summary?.CurrentInnings) || 1, 1);
  const currentInningsData =
    innings.find((entry) => toOptionalInteger(entry?.InningsNo) === currentInnings) || inningsOne;
  const currentInningsBallCount = extractOfficialBallsFromInnings(currentInningsData);
  const currentBall =
    currentInnings >= 2 || toOptionalInteger(summary?.IsMatchEnd) === 1
      ? firstInningsBallCount !== null
        ? Math.max(firstInningsBallCount, SCORE_LOCK_BALL)
        : SCORE_LOCK_BALL
      : currentInningsBallCount;

  return {
    external_match_id: cleanNullableText(summary?.MatchID, 40),
    title: cleanText(
      summary?.MatchName || `${summary?.Team1 || ""} vs ${summary?.Team2 || ""}`,
      120,
    ),
    team_a: cleanNullableText(summary?.Team1, 80),
    team_b: cleanNullableText(summary?.Team2, 80),
    venue: cleanNullableText(summary?.GroundName, 120),
    starts_at: null,
    series_name: cleanNullableText(summary?.CompetitionName, 120),
    status: computeOfficialMatchStatus(summary, currentBall),
    current_innings_ball: currentBall,
    current_over_display: extractOfficialOversText(currentInningsData, currentBall),
    provider: "ipl-official",
    raw: summary,
    official_scorecard_bundle: bundle,
  };
}

function shouldUseOfficialScheduledFallback(error, fallbackMatch) {
  const status = toOptionalInteger(error?.status);
  const message = cleanText(error?.message || "", 200).toLowerCase();
  const isMissingOfficialLiveFile =
    status === 404 || /\b404\b/.test(message) || message.includes("not found");

  if (!isMissingOfficialLiveFile) {
    return false;
  }

  const startsAt = fallbackMatch?.starts_at ? new Date(fallbackMatch.starts_at).getTime() : null;
  if (!startsAt || Number.isNaN(startsAt)) {
    return false;
  }

  return Date.now() < startsAt;
}

function buildOfficialScheduledSnapshot(match, externalMatchId) {
  return {
    external_match_id: cleanNullableText(externalMatchId || match?.external_match_id, 40),
    title: cleanText(match?.title || `${match?.team_a || ""} vs ${match?.team_b || ""}`, 120),
    team_a: cleanNullableText(match?.team_a, 80),
    team_b: cleanNullableText(match?.team_b, 80),
    venue: cleanNullableText(match?.venue, 120),
    starts_at: match?.starts_at || null,
    series_name: cleanNullableText(match?.series_name, 120) || "Indian Premier League",
    status: "scheduled",
    current_innings_ball: null,
    current_over_display: null,
    provider: "ipl-official",
    raw: null,
    official_scorecard_bundle: null,
    live_feed_pending: true,
  };
}

function extractOfficialSettlementPayload(bundle, match, snapshot) {
  if (!bundle || typeof bundle !== "object") {
    return null;
  }

  const summary = bundle?.summary || {};
  const innings = asArray(bundle?.innings);
  const batsmanRuns = {};
  const bowlerWickets = {};

  for (const inningsData of innings) {
    for (const entry of asArray(inningsData?.BattingCard)) {
      const key = resolvePlayerCanonicalKey(
        entry?.PlayerName || entry?.PlayerShortName,
        match,
      );
      const runs = toOptionalInteger(entry?.Runs);
      if (key && runs !== null) {
        batsmanRuns[key] = Math.max(batsmanRuns[key] || 0, runs);
      }
    }

    for (const entry of asArray(inningsData?.BowlingCard)) {
      const key = resolvePlayerCanonicalKey(
        entry?.PlayerName || entry?.PlayerShortName,
        match,
      );
      const wickets = toOptionalInteger(entry?.Wickets);
      if (key && wickets !== null) {
        bowlerWickets[key] = Math.max(bowlerWickets[key] || 0, wickets);
      }
    }
  }

  const winnerTeam = findWinningTeam(summary, match, snapshot);
  const firstInningsTotal = extractOfficialSettlementFirstInningsTotal(bundle, snapshot);

  if (!winnerTeam || firstInningsTotal === null) {
    return null;
  }

  if (!hasSettlementStats(batsmanRuns, bowlerWickets)) {
    return null;
  }

  return {
    winner_team: winnerTeam,
    first_innings_total: firstInningsTotal,
    batsman_runs: batsmanRuns,
    bowler_wickets: bowlerWickets,
    notes:
      "Settled automatically from the official IPL match-centre feeds. Players missing from the match-day squad or scorecard receive 0 points.",
  };
}

function hasSettlementStats(batsmanRuns, bowlerWickets) {
  return Object.keys(batsmanRuns || {}).length > 0 || Object.keys(bowlerWickets || {}).length > 0;
}

function extractOfficialSettlementFirstInningsTotal(bundle, snapshot) {
  const innings = asArray(bundle?.innings);
  const inningsOne =
    innings.find((entry) => toOptionalInteger(entry?.InningsNo) === 1) || innings[0] || null;
  const extras = asArray(inningsOne?.Extras)[0] || {};
  const totalText = cleanNullableText(extras?.Total, 40);
  const totalFromText = totalText?.match(/^(\d+)/)?.[1] || null;
  const summary = bundle?.summary || {};
  const summaryText = cleanNullableText(
    summary?.["1Summary"] || summary?.FirstBattingSummary,
    40,
  );
  const summaryTotalFromText = summaryText?.match(/^(\d+)/)?.[1] || null;

  return (
    toOptionalInteger(extras?.FallScore) ??
    toOptionalInteger(totalFromText) ??
    toOptionalInteger(summary?.["1FallScore"]) ??
    toOptionalInteger(summaryTotalFromText) ??
    toOptionalInteger(snapshot?.raw?.["1FallScore"]) ??
    null
  );
}

function findWinningTeam(root, match, snapshot) {
  const candidates = [
    root?.winner,
    root?.winningTeam,
    root?.matchWinner,
    root?.Comments,
    root?.Commentss,
    root?.PointsComments,
    snapshot?.raw?.winner,
    snapshot?.raw?.winningTeam,
    snapshot?.raw?.matchWinner,
    snapshot?.raw?.Comments,
    snapshot?.raw?.Commentss,
    snapshot?.raw?.PointsComments,
    snapshot?.raw?.status,
    root?.status,
  ];

  for (const candidate of candidates) {
    const teamName = matchTeamFromText(candidate, match);
    if (teamName) {
      return teamName;
    }
  }

  const winningTeamId = cleanNullableText(
    root?.WinningTeamID || snapshot?.raw?.WinningTeamID,
    40,
  );
  const homeTeamId = cleanNullableText(
    root?.HomeTeamID || snapshot?.raw?.HomeTeamID,
    40,
  );
  const awayTeamId = cleanNullableText(
    root?.AwayTeamID || snapshot?.raw?.AwayTeamID,
    40,
  );
  const homeTeamName = matchTeamFromText(
    root?.HomeTeamName || snapshot?.raw?.HomeTeamName || root?.Team1 || snapshot?.raw?.Team1,
    match,
  );
  const awayTeamName = matchTeamFromText(
    root?.AwayTeamName || snapshot?.raw?.AwayTeamName || root?.Team2 || snapshot?.raw?.Team2,
    match,
  );

  if (winningTeamId && homeTeamId && winningTeamId === homeTeamId && homeTeamName) {
    return homeTeamName;
  }

  if (winningTeamId && awayTeamId && winningTeamId === awayTeamId && awayTeamName) {
    return awayTeamName;
  }

  return null;
}

function matchTeamFromText(value, match) {
  const text = cleanText(value, 160).toLowerCase();
  if (!text) {
    return null;
  }

  if (text.includes(cleanText(match.team_a, 80).toLowerCase())) {
    return match.team_a;
  }

  if (text.includes(cleanText(match.team_b, 80).toLowerCase())) {
    return match.team_b;
  }

  return null;
}

function normalizeResultScoreMap(scoreMap, match) {
  if (!scoreMap || typeof scoreMap !== "object") {
    return {};
  }

  const normalized = {};

  for (const [playerName, rawValue] of Object.entries(scoreMap)) {
    const key = resolvePlayerCanonicalKey(playerName, match);
    const value = Number(rawValue);
    if (!key || !Number.isFinite(value)) {
      continue;
    }

    normalized[key] = Math.max(normalized[key] || 0, value);
  }

  return normalized;
}

function resolvePlayerCanonicalKey(name, match) {
  const fallbackKey = normalizePlayerLookupKey(name);
  if (!fallbackKey) {
    return "";
  }

  const candidates = getMatchPlayerCandidates(match);
  if (!candidates.length) {
    return fallbackKey;
  }

  const directMatch = candidates.find((candidate) => candidate.key === fallbackKey);
  if (directMatch) {
    return directMatch.key;
  }

  const aliasKeys = buildPlayerAliasKeys(name);
  const aliasMatches = candidates.filter((candidate) =>
    intersectsAliasSet(aliasKeys, candidate.aliasKeys),
  );
  if (aliasMatches.length === 1) {
    return aliasMatches[0].key;
  }

  const tokenMatch = resolveUniqueTokenMatch(getComparablePlayerTokens(name), candidates);
  return tokenMatch || fallbackKey;
}

function getMatchPlayerCandidates(match) {
  const playingXi =
    match?.playing_xi && typeof match.playing_xi === "object"
      ? match.playing_xi
      : buildEmptyPlayingXi();
  const seen = new Set();
  const candidates = [];

  for (const player of [
    ...normalizePlayerList(playingXi.team_a, match?.team_a || "Team A"),
    ...normalizePlayerList(playingXi.team_b, match?.team_b || "Team B"),
  ]) {
    const canonicalKey = normalizeName(player.name);
    if (!canonicalKey || seen.has(canonicalKey)) {
      continue;
    }

    seen.add(canonicalKey);
    candidates.push({
      name: player.name,
      key: canonicalKey,
      tokens: tokenizePlayerName(player.name),
      aliasKeys: buildPlayerAliasKeys(player.name),
    });
  }

  return candidates;
}

function normalizePlayerList(players, fallbackTeam) {
  const seen = new Set();
  const normalizedPlayers = [];

  for (const entry of asArray(players)) {
    const player = normalizePlayerEntry(entry, fallbackTeam);
    if (!player) {
      continue;
    }

    const playerKey = normalizeName(player.name);
    if (!playerKey || seen.has(playerKey)) {
      continue;
    }

    seen.add(playerKey);
    normalizedPlayers.push(player);
  }

  return normalizedPlayers;
}

function normalizePlayerEntry(entry, fallbackTeam) {
  if (typeof entry === "string") {
    const name = cleanMatchPlayerName(entry);
    return name ? { name, team: fallbackTeam } : null;
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const name = cleanMatchPlayerName(
    entry?.name ||
      entry?.fullName ||
      entry?.playerName ||
      entry?.player ||
      entry?.PlayerName ||
      entry?.PlayerShortName ||
      "",
  );
  if (!name) {
    return null;
  }

  return {
    name,
    team: cleanText(
      entry?.teamName || entry?.team || entry?.team_name || entry?.TeamName || fallbackTeam || "",
      80,
    ),
  };
}

function cleanMatchPlayerName(value) {
  return cleanText(
    String(value || "")
      .replace(/\((?:c|wk|c\)\(wk|ip|rp|cs|c sub)\)/gi, " ")
      .replace(/[+*]/g, " ")
      .replace(/\s+/g, " "),
    80,
  );
}

function buildPlayerAliasKeys(name) {
  const aliases = new Set();
  const baseKey = normalizePlayerLookupKey(name);
  if (baseKey) {
    aliases.add(baseKey);
  }

  const tokens = getComparablePlayerTokens(name);
  if (!tokens.length) {
    return aliases;
  }

  const addParts = (parts) => {
    const normalizedParts = parts
      .map((part) => cleanText(part, 40).toLowerCase())
      .filter(Boolean);
    if (!normalizedParts.length) {
      return;
    }

    aliases.add(normalizedParts.join("-"));
    aliases.add(normalizedParts.join(""));
  };

  const withoutParticles = tokens.filter((token) => !PLAYER_NAME_PARTICLES.has(token));
  const withoutLeadingInitials = dropLeadingInitialTokens(tokens);
  const trimmedCore = dropLeadingInitialTokens(withoutParticles);

  addParts(tokens);
  addParts(withoutParticles);
  addParts(withoutLeadingInitials);
  addParts(trimmedCore);

  if (tokens.length > 1) {
    addParts([tokens[0][0], ...tokens.slice(1)]);
  }

  if (withoutParticles.length > 1) {
    addParts([withoutParticles[0][0], ...withoutParticles.slice(1)]);
  }

  const collapsedInitialsAlias = buildCollapsedInitialsAlias(tokens);
  if (collapsedInitialsAlias.length) {
    addParts(collapsedInitialsAlias);
  }

  const collapsedInitialsWithoutParticles = buildCollapsedInitialsAlias(withoutParticles);
  if (collapsedInitialsWithoutParticles.length) {
    addParts(collapsedInitialsWithoutParticles);
  }

  return aliases;
}

function buildCollapsedInitialsAlias(tokens) {
  if (tokens.length < 2) {
    return [];
  }

  const lastToken = tokens[tokens.length - 1];
  const leadingTokens = tokens.slice(0, -1).filter((token) => !PLAYER_NAME_PARTICLES.has(token));
  if (!leadingTokens.length || !leadingTokens.every((token) => token.length <= 2)) {
    return [];
  }

  const initials = leadingTokens.map((token) => token[0]).join("");
  return initials ? [initials, lastToken] : [];
}

function dropLeadingInitialTokens(tokens) {
  let index = 0;
  while (index < tokens.length - 1 && tokens[index].length <= 2) {
    index += 1;
  }

  return tokens.slice(index);
}

function tokenizePlayerName(value) {
  const normalized = cleanMatchPlayerName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim();

  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function getComparablePlayerTokens(value) {
  return tokenizePlayerName(value).filter((token) => !PLAYER_NAME_IGNORED_TAGS.has(token));
}

function normalizePlayerLookupKey(value) {
  return getComparablePlayerTokens(value).join("-");
}

function intersectsAliasSet(left, right) {
  if (!left?.size || !right?.size) {
    return false;
  }

  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }

  return false;
}

function resolveUniqueTokenMatch(tokens, candidates) {
  if (!tokens.length || !candidates.length) {
    return null;
  }

  const surname = tokens[tokens.length - 1];
  if (!surname || surname.length < 3) {
    return null;
  }

  let matches = candidates.filter((candidate) => {
    const candidateSurname = candidate.tokens[candidate.tokens.length - 1];
    return candidateSurname === surname;
  });
  if (!matches.length) {
    return null;
  }

  const firstToken = tokens[0];
  if (firstToken && firstToken !== surname) {
    const firstInitial = firstToken[0];
    const refined = matches.filter((candidate) => {
      const candidateFirst =
        candidate.tokens.find((token) => token.length > 1) || candidate.tokens[0];
      return (
        candidate.tokens.includes(firstToken) ||
        candidateFirst === firstToken ||
        candidateFirst?.startsWith(firstInitial)
      );
    });

    if (refined.length === 1) {
      return refined[0].key;
    }

    if (refined.length) {
      matches = refined;
    }
  }

  return matches.length === 1 ? matches[0].key : null;
}

function extractOfficialBallsFromInnings(innings) {
  if (!innings || typeof innings !== "object") {
    return null;
  }

  const extras = asArray(innings?.Extras)[0] || {};
  return oversToBalls(
    extras?.FallOvers || extras?.Overs || innings?.FallOvers || innings?.Overs || "",
  );
}

function extractOfficialOversText(innings, currentInningsBall) {
  const extras = asArray(innings?.Extras)[0] || {};
  const oversText = cleanNullableText(
    extras?.FallOvers || extras?.Overs || innings?.FallOvers || innings?.Overs,
    12,
  );

  if (oversText) {
    return oversText;
  }

  if (currentInningsBall !== null) {
    return formatBallsAsOvers(currentInningsBall);
  }

  return null;
}

function computeOfficialMatchStatus(rawMatch, currentInningsBall) {
  const statusText = cleanText(
    rawMatch?.MatchStatus || rawMatch?.Comments || rawMatch?.Commentss || "",
    240,
  ).toLowerCase();

  if (/\bcancelled\b|\babandoned\b|\bno result\b/.test(statusText)) {
    return "cancelled";
  }

  if (/^post$|\bwon by\b|\bresult\b|\bcompleted\b/.test(statusText)) {
    return "completed";
  }

  if (/^live$/.test(statusText) || currentInningsBall !== null) {
    return currentInningsBall !== null && currentInningsBall >= SCORE_LOCK_BALL
      ? "locked"
      : "live";
  }

  return "scheduled";
}

function oversToBalls(oversValue) {
  const rawText = String(oversValue || "").trim();
  if (!rawText) {
    return null;
  }

  const match = rawText.match(/(\d+)(?:\.(\d+))?/);
  if (!match) {
    return null;
  }

  const overs = Number.parseInt(match[1], 10);
  const balls = Number.parseInt((match[2] || "0").slice(0, 1) || "0", 10);

  if (Number.isNaN(overs) || Number.isNaN(balls) || balls > 5) {
    return null;
  }

  return overs * 6 + balls;
}

function formatBallsAsOvers(ballCount) {
  const safeBallCount = Math.max(Number(ballCount) || 0, 0);
  const overs = Math.floor(safeBallCount / 6);
  const balls = safeBallCount % 6;
  return `${overs}.${balls}`;
}

function normalizeName(value) {
  return cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanNullableText(value, maxLength) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function toOptionalInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildEmptyPlayingXi() {
  return {
    team_a: [],
    team_b: [],
  };
}

async function supabaseRequest(
  supabaseUrl,
  supabaseServiceRoleKey,
  path,
  { method = "GET", params = {}, headers = {}, body } = {},
) {
  const url = new URL(
    `/rest/v1/${String(path || "").replace(/^\/+/, "")}`,
    normalizeSupabaseUrl(supabaseUrl),
  );

  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  const requestHeaders = {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(url.toString(), {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(
      cleanText(text || `Supabase ${method} ${path} failed with ${response.status}.`, 400),
    );
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function normalizeSupabaseUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  return text;
}

module.exports = {
  syncActiveMatches,
};
