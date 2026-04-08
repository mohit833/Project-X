import { APP_CONFIG } from "./config.js";

const root = document.getElementById("app");
const THEME_STORAGE_KEY = "ipl-theme-mode-v2";
const MATCH_ROUTE_SECTIONS = new Set(["fixtures", "centre", "picks", "admin"]);
const PRIMARY_ROUTE_PAGES = new Set(["home", "current", "matches", "standings", "league", "account"]);
const MATCH_CENTRE_PANELS = [
  { key: "prediction", label: "Predict", panelId: "prediction-panel" },
  { key: "picks", label: "Picks", panelId: "picks-board-panel" },
  { key: "squads", label: "Squads", panelId: "squad-panel" },
  { key: "result", label: "Result", panelId: "result-panel", requiresResult: true },
];
const TEAM_BRANDS = {
  "chennai-super-kings": {
    short: "CSK",
    logo: "https://scores.iplt20.com/ipl/teamlogos/CSK.png",
    primary: "#f7b718",
    secondary: "#184ea1",
    accent: "#ffedb3",
  },
  "delhi-capitals": {
    short: "DC",
    logo: "https://scores.iplt20.com/ipl/teamlogos/DC.png",
    primary: "#1457c1",
    secondary: "#ef3e36",
    accent: "#a8d4ff",
  },
  "gujarat-titans": {
    short: "GT",
    logo: "https://scores.iplt20.com/ipl/teamlogos/GT.png",
    primary: "#1d2747",
    secondary: "#d6ad5c",
    accent: "#91a6dd",
  },
  "kolkata-knight-riders": {
    short: "KKR",
    logo: "https://scores.iplt20.com/ipl/teamlogos/KKR.png",
    primary: "#48236f",
    secondary: "#d4ad47",
    accent: "#c8a7ff",
  },
  "lucknow-super-giants": {
    short: "LSG",
    logo: "https://scores.iplt20.com/ipl/teamlogos/LSG.png",
    primary: "#07a7e3",
    secondary: "#ff8f3d",
    accent: "#9de8ff",
  },
  "mumbai-indians": {
    short: "MI",
    logo: "https://scores.iplt20.com/ipl/teamlogos/MI.png",
    primary: "#005da8",
    secondary: "#d6a437",
    accent: "#8ce1ff",
  },
  "punjab-kings": {
    short: "PBKS",
    logo: "https://scores.iplt20.com/ipl/teamlogos/PBKS.png",
    primary: "#d71920",
    secondary: "#d8d8d8",
    accent: "#ffb0b3",
  },
  "rajasthan-royals": {
    short: "RR",
    logo: "https://scores.iplt20.com/ipl/teamlogos/RR.png",
    primary: "#eb1c8d",
    secondary: "#1b4ca1",
    accent: "#ffc1e6",
  },
  "royal-challengers-bengaluru": {
    short: "RCB",
    logo: "https://scores.iplt20.com/ipl/teamlogos/RCB.png",
    primary: "#c22033",
    secondary: "#111111",
    accent: "#ffb2c2",
  },
  "sunrisers-hyderabad": {
    short: "SRH",
    logo: "https://scores.iplt20.com/ipl/teamlogos/SRH.png",
    primary: "#f37021",
    secondary: "#2b0f0b",
    accent: "#ffd0a8",
  },
};
const TEAM_BRAND_ALIASES = {
  "royal-challengers-bangalore": "royal-challengers-bengaluru",
};
const IPL_OFFICIAL_TEAM_SITE_ORIGIN = "https://www.iplt20.com";
const IPL_OFFICIAL_PLAYER_IMAGE_BASE_URL = "https://scores.iplt20.com/ipl/playerimages/";

const state = {
  appName: APP_CONFIG.APP_NAME || "Indian Prediction League",
  demoMode:
    Boolean(APP_CONFIG.DEMO_MODE) ||
    !APP_CONFIG.SUPABASE_URL ||
    !APP_CONFIG.SUPABASE_ANON_KEY,
  client: null,
  session: null,
  user: null,
  profile: null,
  memberships: [],
  activeLeagueId: null,
  matches: [],
  members: [],
  predictions: [],
  pointAdjustments: [],
  leaderboard: [],
  notice: null,
  loading: false,
  realtimeChannel: null,
  reloadTimer: null,
  leagueRefreshTimer: null,
  leagueRefreshBusy: false,
  lastLeagueRefreshKickAt: 0,
  autoSyncTimer: null,
  autoSyncBusy: false,
  lastAutoSyncKickAt: 0,
  lastForegroundRefreshAt: 0,
  probingMatchIds: new Set(),
  matchStatusProbeTimes: {},
  providerFixtures: [],
  loadingProviderFixtures: false,
  syncingMatchIds: new Set(),
  settlingMatchIds: new Set(),
  cancellingMatchIds: new Set(),
  lastPredictionConflictKey: null,
  predictionDrafts: {},
  teamSquads: {},
  teamSquadRetryAfter: {},
  loadingTeamSquads: new Set(),
  pendingPhoneAuth: readPendingPhoneAuthState(),
  endingLeagueId: null,
  route: readRouteState(),
  theme: readStoredTheme(),
  selectedMatchId: null,
  predictionScorecardMatchId: null,
  playerPicker: null,
  activeMatchCentrePanel: "prediction",
  fixtureFilters: {
    team: "all",
    status: "scheduled",
    todayOnly: false,
    scorecardOnly: false,
  },
  installPromptEvent: null,
  isStandalone:
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true,
};

const DEMO_USER_ID = "demo-user";
const DEMO_LEAGUE_ID = "demo-league";
const MIN_OFFICIAL_TEAM_SQUAD_SIZE = 11;
const LEAGUE_MATCH_TIME_ZONE = "Asia/Kolkata";
const TEAM_SQUAD_RETRY_COOLDOWN_MS = 2 * 60 * 1000;
const LEAGUE_REFRESH_THROTTLE_MS = 10 * 60 * 1000;
const AUTO_SYNC_RESUME_THROTTLE_MS = 10 * 60 * 1000;
const MATCH_STATUS_PROBE_STALE_MS = 10 * 60 * 1000;
const MATCH_STATUS_PROBE_THROTTLE_MS = 10 * 60 * 1000;
const FOREGROUND_REFRESH_THROTTLE_MS = 45 * 1000;
const DEMO_MATCHES = [
  {
    id: "match-1",
    league_id: DEMO_LEAGUE_ID,
    title: "CSK vs MI",
    team_a: "Chennai Super Kings",
    team_b: "Mumbai Indians",
    venue: "Chepauk",
    starts_at: "2026-03-28T14:00:00.000Z",
    playing_xi_announced_at: "2026-03-28T13:25:00.000Z",
    picks_deadline_at: "2026-03-28T14:20:00.000Z",
    score_deadline_at: "2026-03-28T14:42:00.000Z",
    innings_started_at: "2026-03-28T14:00:00.000Z",
    provider: "cricapi",
    external_match_id: "demo-match-1",
    series_name: "Indian Premier League",
    current_innings_ball: 16,
    current_over_display: "2.4",
    auto_sync_enabled: true,
    last_synced_at: "2026-03-28T14:08:00.000Z",
    playing_xi: {
      team_a: [
        { name: "Ruturaj Gaikwad" },
        { name: "Rachin Ravindra" },
        { name: "Shivam Dube" },
        { name: "MS Dhoni" },
      ],
      team_b: [
        { name: "Rohit Sharma" },
        { name: "Suryakumar Yadav" },
        { name: "Tilak Varma" },
        { name: "Jasprit Bumrah" },
      ],
    },
    status: "live",
    notes:
      "Live demo sync is using provider data for the match clock, squad sync, and scoring.",
    match_results: null,
  },
  {
    id: "match-2",
    league_id: DEMO_LEAGUE_ID,
    title: "RCB vs KKR",
    team_a: "Royal Challengers Bengaluru",
    team_b: "Kolkata Knight Riders",
    venue: "Bengaluru",
    starts_at: "2026-03-26T14:00:00.000Z",
    playing_xi_announced_at: "2026-03-26T13:26:00.000Z",
    picks_deadline_at: "2026-03-26T14:19:00.000Z",
    score_deadline_at: "2026-03-26T14:41:00.000Z",
    innings_started_at: "2026-03-26T14:00:00.000Z",
    provider: "cricapi",
    external_match_id: "demo-match-2",
    series_name: "Indian Premier League",
    current_innings_ball: 120,
    current_over_display: "20.0",
    auto_sync_enabled: false,
    last_synced_at: "2026-03-26T18:00:00.000Z",
    playing_xi: {
      team_a: [
        { name: "Virat Kohli" },
        { name: "Phil Salt" },
        { name: "Rajat Patidar" },
        { name: "Yash Dayal" },
      ],
      team_b: [
        { name: "Ajinkya Rahane" },
        { name: "Rinku Singh" },
        { name: "Varun Chakravarthy" },
        { name: "Sunil Narine" },
      ],
    },
    status: "completed",
    notes: "Completed sample match.",
    match_results: {
      winner_team: "Royal Challengers Bengaluru",
      first_innings_total: 188,
      batsman_runs: {
        "virat-kohli": 72,
        "ajinkya-rahane": 29,
        "phil-salt": 18,
      },
      bowler_wickets: {
        "jasprit-bumrah": 2,
        "varun-chakravarthy": 3,
        "khaleel-ahmed": 1,
      },
      notes: "Demo result data.",
    },
  },
];

const DEMO_MEMBERS = [
  {
    id: "member-1",
    league_id: DEMO_LEAGUE_ID,
    user_id: DEMO_USER_ID,
    display_name: "Mohit",
    role: "admin",
    is_active: true,
    joined_at: "2026-03-20T08:00:00.000Z",
  },
  {
    id: "member-2",
    league_id: DEMO_LEAGUE_ID,
    user_id: "friend-1",
    display_name: "Pranav",
    role: "member",
    is_active: true,
    joined_at: "2026-03-20T08:10:00.000Z",
  },
  {
    id: "member-3",
    league_id: DEMO_LEAGUE_ID,
    user_id: "friend-2",
    display_name: "Aishu",
    role: "member",
    is_active: true,
    joined_at: "2026-03-20T08:15:00.000Z",
  },
];

const DEMO_PREDICTIONS = [
  {
    id: "prediction-1",
    league_id: DEMO_LEAGUE_ID,
    match_id: "match-1",
    user_id: DEMO_USER_ID,
    batsman_name: "Ruturaj Gaikwad",
    bowler_name: "Jasprit Bumrah",
    team_pick: "Mumbai Indians",
    predicted_score: 181,
    core_locked_due_to_pre_xi: false,
    core_submitted_at: "2026-03-28T14:04:00.000Z",
    score_submitted_at: "2026-03-28T14:18:00.000Z",
    league_members: { display_name: "Mohit" },
  },
  {
    id: "prediction-2",
    league_id: DEMO_LEAGUE_ID,
    match_id: "match-1",
    user_id: "friend-1",
    batsman_name: "Suryakumar Yadav",
    bowler_name: "Khaleel Ahmed",
    team_pick: "Chennai Super Kings",
    predicted_score: 176,
    core_locked_due_to_pre_xi: true,
    core_submitted_at: "2026-03-28T13:17:00.000Z",
    score_submitted_at: "2026-03-28T14:12:00.000Z",
    league_members: { display_name: "Pranav" },
  },
  {
    id: "prediction-3",
    league_id: DEMO_LEAGUE_ID,
    match_id: "match-1",
    user_id: "friend-2",
    batsman_name: "Rohit Sharma",
    bowler_name: "Matheesha Pathirana",
    team_pick: "Mumbai Indians",
    predicted_score: 184,
    core_locked_due_to_pre_xi: false,
    core_submitted_at: "2026-03-28T14:06:00.000Z",
    score_submitted_at: "2026-03-28T14:19:00.000Z",
    league_members: { display_name: "Aishu" },
  },
  {
    id: "prediction-4",
    league_id: DEMO_LEAGUE_ID,
    match_id: "match-2",
    user_id: DEMO_USER_ID,
    batsman_name: "Virat Kohli",
    bowler_name: "Varun Chakravarthy",
    team_pick: "Royal Challengers Bengaluru",
    predicted_score: 188,
    core_locked_due_to_pre_xi: false,
    core_submitted_at: "2026-03-26T14:02:00.000Z",
    score_submitted_at: "2026-03-26T14:15:00.000Z",
    league_members: { display_name: "Mohit" },
  },
  {
    id: "prediction-5",
    league_id: DEMO_LEAGUE_ID,
    match_id: "match-2",
    user_id: "friend-1",
    batsman_name: "Ajinkya Rahane",
    bowler_name: "Khaleel Ahmed",
    team_pick: "Royal Challengers Bengaluru",
    predicted_score: 179,
    core_locked_due_to_pre_xi: false,
    core_submitted_at: "2026-03-26T14:04:00.000Z",
    score_submitted_at: "2026-03-26T14:17:00.000Z",
    league_members: { display_name: "Pranav" },
  },
  {
    id: "prediction-6",
    league_id: DEMO_LEAGUE_ID,
    match_id: "match-2",
    user_id: "friend-2",
    batsman_name: "Phil Salt",
    bowler_name: "Jasprit Bumrah",
    team_pick: "Kolkata Knight Riders",
    predicted_score: 191,
    core_locked_due_to_pre_xi: false,
    core_submitted_at: "2026-03-26T14:05:00.000Z",
    score_submitted_at: "2026-03-26T14:19:00.000Z",
    league_members: { display_name: "Aishu" },
  },
];

const CORE_LOCK_BALL = 19;
const SCORE_LOCK_BALL = 43;
const SQUAD_SYNC_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;
const PHONE_AUTH_STORAGE_KEY = "ipl-phone-auth-pending";
const OFFICIAL_IPL_TEAM_SLUGS = {
  "chennai-super-kings": "chennai-super-kings",
  csk: "chennai-super-kings",
  "delhi-capitals": "delhi-capitals",
  dc: "delhi-capitals",
  "gujarat-titans": "gujarat-titans",
  gt: "gujarat-titans",
  "kolkata-knight-riders": "kolkata-knight-riders",
  kkr: "kolkata-knight-riders",
  "lucknow-super-giants": "lucknow-super-giants",
  lsg: "lucknow-super-giants",
  "mumbai-indians": "mumbai-indians",
  mi: "mumbai-indians",
  "punjab-kings": "punjab-kings",
  pbks: "punjab-kings",
  "rajasthan-royals": "rajasthan-royals",
  rr: "rajasthan-royals",
  "royal-challengers-bengaluru": "royal-challengers-bengaluru",
  "royal-challengers-bangalore": "royal-challengers-bengaluru",
  rcb: "royal-challengers-bengaluru",
  "sunrisers-hyderabad": "sunrisers-hyderabad",
  srh: "sunrisers-hyderabad",
};
const IPL_OFFICIAL_COMPETITION_URL = "https://scores.iplt20.com/ipl/mc/competition.js";
const IPL_OFFICIAL_DEFAULT_FEED_BASE_URL = "https://scores.iplt20.com/ipl/feeds";

function readPendingPhoneAuthState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PHONE_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const phone = normalizePhoneNumber(parsed?.phone || "");
    const displayName = cleanNullableText(parsed?.display_name, 40);
    if (!phone) {
      return null;
    }

    return {
      phone,
      display_name: displayName || "",
    };
  } catch (_error) {
    return null;
  }
}

function persistPendingPhoneAuthState(phone, displayName = "") {
  const normalizedPhone = normalizePhoneNumber(phone);
  const cleanedName = cleanNullableText(displayName, 40) || "";
  state.pendingPhoneAuth = normalizedPhone
    ? { phone: normalizedPhone, display_name: cleanedName }
    : null;

  if (typeof window === "undefined") {
    return;
  }

  if (!normalizedPhone) {
    window.localStorage.removeItem(PHONE_AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    PHONE_AUTH_STORAGE_KEY,
    JSON.stringify({
      phone: normalizedPhone,
      display_name: cleanedName,
    }),
  );
}

function clearPendingPhoneAuthState() {
  state.pendingPhoneAuth = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PHONE_AUTH_STORAGE_KEY);
  }
}

document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("input", handleInput);
document.addEventListener("keydown", handleKeyDown);
document.addEventListener("visibilitychange", handleAutoSyncVisibilityChange);
window.addEventListener("hashchange", handleHashChange);
window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
window.addEventListener("appinstalled", handleAppInstalled);
window.addEventListener("focus", handleAutoSyncResume);
window.addEventListener("pageshow", handleAutoSyncResume);
window.addEventListener("online", handleAutoSyncResume);

registerServiceWorker();
applyTheme();

init().catch((error) => {
  console.error(error);
  flash(error.message || "Something went wrong while starting the app.", "error");
});

async function init() {
  if (state.demoMode) {
    loadDemoState();
    render();
    return;
  }

  render();

  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2.49.4"
  );

  state.client = createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  const recoveredSession = await recoverSessionFromUrl();
  let session = recoveredSession;

  if (!session) {
    ({
      data: { session },
    } = await state.client.auth.getSession());
  }

  state.session = session;
  state.user = session?.user ?? null;
  if (state.user) {
    clearPendingPhoneAuthState();
  }

  state.client.auth.onAuthStateChange((_event, sessionData) => {
    state.session = sessionData;
    state.user = sessionData?.user ?? null;
    state.profile = null;
    teardownRealtime();

    if (!state.user) {
      state.memberships = [];
      state.activeLeagueId = null;
      state.matches = [];
      state.members = [];
      state.predictions = [];
      state.leaderboard = [];
      state.providerFixtures = [];
      teardownAutoSync();
      render();
      return;
    }

    clearPendingPhoneAuthState();
    render();
    window.setTimeout(async () => {
      try {
        await ensureProfile();
        await loadMemberships();
        await loadLeagueBundle();
        render();
      } catch (error) {
        console.error(error);
        flash(error.message || "Unable to refresh your league data.", "error");
      }
    }, 0);
  });

  if (state.user) {
    render();
    try {
      await ensureProfile();
      await loadMemberships();
      await loadLeagueBundle();
    } catch (error) {
      console.error(error);
      flash(error.message || "Signed in, but we could not finish loading your league data.", "error");
    }
  }

  render();
}

async function recoverSessionFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const authError =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error") ||
    new URLSearchParams(url.hash.replace(/^#/, "")).get("error_description") ||
    new URLSearchParams(url.hash.replace(/^#/, "")).get("error");
  if (authError) {
    clearAuthCallbackParams(url);
    throw new Error(decodeURIComponent(authError.replace(/\+/g, " ")));
  }

  const authCode = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const authType = url.searchParams.get("type");
  const rawHash = url.hash.replace(/^#/, "");
  const callbackHash = rawHash.includes("#") ? rawHash.split("#").pop() : rawHash;
  const hashParams = new URLSearchParams(callbackHash);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (!authCode && !tokenHash && !(accessToken && refreshToken)) {
    return null;
  }

  if (accessToken && refreshToken) {
    const { data, error } = await state.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      throw error;
    }

    clearAuthCallbackParams(url);
    return data?.session ?? null;
  }

  if (authCode) {
    const { data, error } = await state.client.auth.exchangeCodeForSession(authCode);
    if (error) {
      throw error;
    }

    clearAuthCallbackParams(url);
    return data?.session ?? null;
  }

  if (tokenHash && authType) {
    const { data, error } = await state.client.auth.verifyOtp({
      token_hash: tokenHash,
      type: authType,
    });
    if (error) {
      throw error;
    }

    clearAuthCallbackParams(url);
    return data?.session ?? null;
  }

  return null;
}

function clearAuthCallbackParams(url) {
  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.searchParams.delete("next");
  url.hash = "";
  window.history.replaceState({}, document.title, url.toString());
}

function loadDemoState() {
  const demoMatches = DEMO_MATCHES.map((match) => normalizeMatchRecord(match));
  state.session = {
    user: { id: DEMO_USER_ID, email: "demo@league.local" },
  };
  state.user = state.session.user;
  state.profile = {
    display_name: "Mohit",
    email: "demo@league.local",
  };
  state.memberships = [
    {
      id: "member-1",
      league_id: DEMO_LEAGUE_ID,
      display_name: "Mohit",
      role: "admin",
      joined_at: "2026-03-20T08:00:00.000Z",
      leagues: {
        id: DEMO_LEAGUE_ID,
        name: "Friends Super League",
        season: "IPL 2026",
        invite_code: "PLAYIPL",
      },
    },
  ];
  state.activeLeagueId = DEMO_LEAGUE_ID;
  state.matches = demoMatches;
  state.members = DEMO_MEMBERS;
  state.predictions = DEMO_PREDICTIONS;
  state.pointAdjustments = [];
  state.leaderboard = buildLeaderboardFromMatches(
    DEMO_MEMBERS,
    DEMO_PREDICTIONS,
    demoMatches,
    state.pointAdjustments,
  );
  syncRouteSelection();
}

async function ensureProfile() {
  const pendingName = window.localStorage.getItem("ipl-pending-display-name");
  const fallbackName =
    pendingName ||
    state.user?.user_metadata?.display_name ||
    state.user?.user_metadata?.full_name ||
    (state.user?.phone ? `Player ${state.user.phone.slice(-4)}` : "") ||
    state.user?.email?.split("@")[0] ||
    "Player";

  const displayName = cleanText(fallbackName, 40);
  const avatarUrl = cleanNullableText(getUserAvatarUrl(state.user), 1000);

  const profilePayload = {
    id: state.user.id,
    display_name: displayName,
    email: state.user.email || null,
    avatar_url: avatarUrl,
  };

  let { error } = await state.client
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (error && /avatar_url/i.test(`${error.message || ""} ${error.details || ""}`)) {
    ({ error } = await state.client
      .from("profiles")
      .upsert(
        {
          id: state.user.id,
          display_name: displayName,
          email: state.user.email || null,
        },
        { onConflict: "id" },
      ));
  }

  if (error) {
    throw error;
  }

  const { data, error: profileError } = await state.client
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  state.profile = data;

  if (pendingName !== null) {
    window.localStorage.removeItem("ipl-pending-display-name");
  }
}

async function loadMemberships() {
  const { data: membershipRows, error } = await state.client
    .from("league_members")
    .select("id, league_id, display_name, role, is_active, joined_at")
    .eq("user_id", state.user.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  const memberships = membershipRows || [];
  const leagueIds = [...new Set(memberships.map((membership) => membership.league_id).filter(Boolean))];
  const fallbackSeason =
    cleanText(getActiveLeague()?.season || APP_CONFIG.DEFAULT_SEASON || "IPL 2026", 40) ||
    "IPL 2026";

  let leaguesById = new Map();
  if (leagueIds.length) {
    const { data: leaguesData, error: leaguesError } = await state.client
      .from("leagues")
      .select("id, name, season, invite_code, status, created_by, created_at")
      .in("id", leagueIds);

    if (leaguesError) {
      console.warn("League details lookup failed, falling back to membership-only cards.", leaguesError);
    } else {
      leaguesById = new Map((leaguesData || []).map((league) => [league.id, league]));
    }
  }

  state.memberships = memberships.map((membership) => ({
    ...membership,
    leagues:
      leaguesById.get(membership.league_id) ||
      membership.leagues ||
      {
        id: membership.league_id,
        name: "Joined league",
        season: fallbackSeason,
        invite_code: "",
        status: "active",
        created_by: null,
        created_at: membership.joined_at,
      },
  }));

  if (!state.memberships.length) {
    state.activeLeagueId = null;
    state.matches = [];
    state.members = [];
    state.predictions = [];
    state.pointAdjustments = [];
    state.leaderboard = [];
    state.providerFixtures = [];
    teardownRealtime();
    teardownLeagueRefresh();
    teardownAutoSync();
    return;
  }

  const stillValid = state.memberships.some(
    (membership) => membership.league_id === state.activeLeagueId,
  );
  const preferredMembership =
    state.memberships.find((membership) => membership.leagues?.status === "active") ||
    state.memberships[0];

  state.activeLeagueId = stillValid
    ? state.activeLeagueId
    : preferredMembership?.league_id || null;
}

async function loadLeagueBundle() {
  if (!state.activeLeagueId) {
    render();
    return;
  }

  const leagueId = state.activeLeagueId;

  const [matchesResult, membersResult, predictionsResult, adjustmentsResult] =
    await Promise.all([
      state.client
        .from("matches")
        .select("*, match_results(*)")
        .eq("league_id", leagueId)
        .order("starts_at", { ascending: true }),
      state.client
        .from("league_members")
        .select("id, league_id, user_id, display_name, role, is_active, joined_at")
        .eq("league_id", leagueId)
        .eq("is_active", true)
        .order("joined_at", { ascending: true }),
      state.client
        .from("predictions")
        .select(
          "id, league_id, match_id, user_id, batsman_name, bowler_name, team_pick, predicted_score, core_locked_due_to_pre_xi, core_submitted_at, score_submitted_at, created_at, updated_at, league_members(display_name)",
        )
        .eq("league_id", leagueId)
        .order("created_at", { ascending: true }),
      state.client
        .from("manual_point_adjustments")
        .select("id, league_id, user_id, points_delta, reason, created_by, created_at")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: true }),
    ]);

  if (matchesResult.error) {
    throw matchesResult.error;
  }

  if (membersResult.error) {
    throw membersResult.error;
  }

  if (predictionsResult.error) {
    throw predictionsResult.error;
  }

  const adjustmentSupportMissing =
    adjustmentsResult.error &&
    /manual_point_adjustments/i.test(
      `${adjustmentsResult.error.message || ""} ${adjustmentsResult.error.details || ""}`,
    );

  if (adjustmentsResult.error && !adjustmentSupportMissing) {
    throw adjustmentsResult.error;
  }

  const memberRows = membersResult.data || [];
  const memberUserIds = Array.from(
    new Set(memberRows.map((member) => member.user_id).filter(Boolean)),
  );
  let memberProfiles = [];

  if (memberUserIds.length) {
    const profilesResult = await state.client
      .from("profiles")
      .select("id, avatar_url")
      .in("id", memberUserIds);

    const avatarSupportMissing =
      profilesResult.error &&
      /avatar_url/i.test(
        `${profilesResult.error.message || ""} ${profilesResult.error.details || ""}`,
      );

    if (profilesResult.error && !avatarSupportMissing) {
      throw profilesResult.error;
    }

    memberProfiles = avatarSupportMissing ? [] : profilesResult.data || [];
  }

  const avatarUrlByUserId = new Map(
    memberProfiles.map((profile) => [profile.id, cleanNullableText(profile.avatar_url, 1000)]),
  );

  state.matches = (matchesResult.data || []).map((match) => normalizeMatchRecord(match));
  state.members = memberRows.map((member) => ({
    ...member,
    avatar_url:
      avatarUrlByUserId.get(member.user_id) ||
      (member.user_id === state.user?.id ? cleanNullableText(getUserAvatarUrl(state.user), 1000) : null),
  }));
  state.predictions = predictionsResult.data || [];
  state.pointAdjustments = adjustmentSupportMissing ? [] : adjustmentsResult.data || [];
  const validMatchIds = new Set(state.matches.map((match) => match.id));
  for (const matchId of Object.keys(state.matchStatusProbeTimes)) {
    if (!validMatchIds.has(matchId)) {
      delete state.matchStatusProbeTimes[matchId];
    }
  }
  for (const matchId of Object.keys(state.predictionDrafts)) {
    if (!validMatchIds.has(matchId)) {
      delete state.predictionDrafts[matchId];
    }
  }
  for (const matchId of Array.from(state.probingMatchIds)) {
    if (!validMatchIds.has(matchId)) {
      state.probingMatchIds.delete(matchId);
    }
  }
  if (state.predictionScorecardMatchId && !validMatchIds.has(state.predictionScorecardMatchId)) {
    state.predictionScorecardMatchId = null;
  }
  if (state.playerPicker?.matchId && !validMatchIds.has(state.playerPicker.matchId)) {
    state.playerPicker = null;
  }
  state.leaderboard = buildLeaderboardFromMatches(
    state.members,
    state.predictions,
    state.matches,
    state.pointAdjustments,
  );
  syncRouteSelection();

  if (!state.matches.length) {
    teardownRealtime();
    teardownLeagueRefresh();
    teardownAutoSync();
    render();
    return;
  }

  setupRealtime(leagueId);
  setupLeagueRefresh();
  setupAutoSync();
}

function readStoredTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return "light";
}

function persistTheme() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, state.theme);
}

function applyTheme() {
  if (typeof document === "undefined") {
    return;
  }

  document.body.dataset.theme = state.theme;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.colorScheme = state.theme;

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", state.theme === "light" ? "#eef2ff" : "#091d52");
  }
}

function isAuthCallbackHash(rawHash) {
  return /(?:access_token|refresh_token|error_description|token_hash)=/.test(rawHash);
}

function normalizeRouteState(route = {}) {
  let page = cleanText(route.page || "home", 30).toLowerCase();
  const legacyPageMap = {
    dashboard: "league",
    setup: "account",
  };
  page = legacyPageMap[page] || page;

  if (!PRIMARY_ROUTE_PAGES.has(page)) {
    page = "home";
  }

  let section = cleanText(route.section || "", 20).toLowerCase();
  if (page !== "matches" || !MATCH_ROUTE_SECTIONS.has(section)) {
    section = page === "matches" ? "fixtures" : "";
  }

  const matchId = String(route.matchId || "").trim() || null;
  return { page, section, matchId };
}

function readRouteState() {
  if (typeof window === "undefined") {
    return normalizeRouteState();
  }

  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash || isAuthCallbackHash(rawHash)) {
    return normalizeRouteState();
  }

  const normalizedHash = rawHash.startsWith("/") ? rawHash.slice(1) : rawHash;
  const [pathPart, queryPart = ""] = normalizedHash.split("?");
  const segments = pathPart
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const params = new URLSearchParams(queryPart);
  const page = segments[0] || "home";
  const section = segments[1] || "";
  const matchId = params.get("match") || segments[2] || null;

  return normalizeRouteState({ page, section, matchId });
}

function buildRouteHref(route = {}) {
  const normalized = normalizeRouteState(route);
  const segments = [normalized.page];
  if (normalized.page === "matches") {
    segments.push(normalized.section || "fixtures");
  }

  const params = new URLSearchParams();
  if (normalized.matchId) {
    params.set("match", normalized.matchId);
  }

  const query = params.toString();
  return `#/${segments.join("/")}${query ? `?${query}` : ""}`;
}

function navigateToRoute(route, { scrollToTop = true } = {}) {
  const nextRoute = normalizeRouteState({
    ...state.route,
    ...route,
  });
  const nextHash = buildRouteHref(nextRoute);

  state.route = nextRoute;
  state.predictionScorecardMatchId = null;
  state.playerPicker = null;
  if (nextRoute.matchId) {
    state.selectedMatchId = nextRoute.matchId;
  }

  if (window.location.hash === nextHash) {
    syncRouteSelection();
    render();
    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  window.location.hash = nextHash;
}

function handleHashChange() {
  state.route = readRouteState();
  state.predictionScorecardMatchId = null;
  state.playerPicker = null;
  syncRouteSelection();
  render();
}

function syncRouteSelection() {
  const previousMatchId = state.selectedMatchId;
  const requestedMatchId = state.route?.matchId;
  if (requestedMatchId && state.matches.some((match) => match.id === requestedMatchId)) {
    state.selectedMatchId = requestedMatchId;
    if (state.selectedMatchId !== previousMatchId) {
      state.activeMatchCentrePanel = "prediction";
    }
    return;
  }

  if (state.route?.page === "current") {
    state.selectedMatchId = getCurrentActionMatchId(state.matches);
    if (state.selectedMatchId !== previousMatchId) {
      state.activeMatchCentrePanel = "prediction";
    }
    return;
  }

  if (state.selectedMatchId && state.matches.some((match) => match.id === state.selectedMatchId)) {
    return;
  }

  state.selectedMatchId = chooseDefaultMatchId(state.matches);
  if (state.selectedMatchId !== previousMatchId) {
    state.activeMatchCentrePanel = "prediction";
  }
}

function getCurrentRoute() {
  return normalizeRouteState(state.route);
}

function setupRealtime(leagueId) {
  if (!state.client) {
    return;
  }

  const activeChannelName = `league-${leagueId}`;

  if (state.realtimeChannel?.topic === activeChannelName) {
    return;
  }

  teardownRealtime();

  state.realtimeChannel = state.client
    .channel(activeChannelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "matches",
        filter: `league_id=eq.${leagueId}`,
      },
      () => scheduleLeagueReload(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "predictions",
        filter: `league_id=eq.${leagueId}`,
      },
      () => scheduleLeagueReload(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "league_members",
        filter: `league_id=eq.${leagueId}`,
      },
      () => scheduleLeagueReload(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "match_results",
      },
      () => scheduleLeagueReload(),
    )
    .subscribe();
}

function teardownRealtime() {
  if (state.reloadTimer) {
    window.clearTimeout(state.reloadTimer);
    state.reloadTimer = null;
  }

  if (state.realtimeChannel && state.client) {
    state.client.removeChannel(state.realtimeChannel);
  }

  state.realtimeChannel = null;
}

function setupAutoSync() {
  const shouldKickImmediately = !state.autoSyncTimer;
  teardownAutoSync();

  if (!state.user || currentMembership()?.role !== "admin" || state.demoMode) {
    return;
  }

  const trackedMatches = state.matches.filter(shouldAutoSyncMatch);
  if (!trackedMatches.length) {
    return;
  }

  const intervalMs = getSyncPollingIntervalMs();
  if (shouldKickImmediately) {
    requestAutoSync({ force: true });
  }
  state.autoSyncTimer = window.setInterval(() => {
    requestAutoSync();
  }, intervalMs);
}

function setupLeagueRefresh() {
  teardownLeagueRefresh();

  if (!state.user || !state.activeLeagueId || state.demoMode) {
    return;
  }

  const intervalMs = getSyncPollingIntervalMs();
  state.leagueRefreshTimer = window.setInterval(() => {
    requestLeagueRefresh();
  }, intervalMs);
}

function teardownLeagueRefresh() {
  if (state.leagueRefreshTimer) {
    window.clearInterval(state.leagueRefreshTimer);
    state.leagueRefreshTimer = null;
  }

  state.leagueRefreshBusy = false;
}

function teardownAutoSync() {
  if (state.autoSyncTimer) {
    window.clearInterval(state.autoSyncTimer);
    state.autoSyncTimer = null;
  }
}

function canAutoSyncMatches() {
  if (!state.user || currentMembership()?.role !== "admin" || state.demoMode) {
    return false;
  }

  return state.matches.some(shouldAutoSyncMatch);
}

function canRefreshLeagueBundle() {
  return Boolean(state.user && state.activeLeagueId && !state.demoMode && state.client);
}

function getSyncPollingIntervalMs() {
  return Math.max(Number(APP_CONFIG.AUTO_SYNC_INTERVAL_MS) || 10 * 60 * 1000, 10 * 60 * 1000);
}

function requestLeagueRefresh({ force = false } = {}) {
  if (!canRefreshLeagueBundle() || state.leagueRefreshBusy) {
    return;
  }

  if (isPredictionFormActive()) {
    return;
  }

  const now = Date.now();
  if (!force && now - state.lastLeagueRefreshKickAt < LEAGUE_REFRESH_THROTTLE_MS) {
    return;
  }

  state.lastLeagueRefreshKickAt = now;
  state.leagueRefreshBusy = true;

  loadLeagueBundle()
    .then(() => {
      render();
    })
    .catch((error) => {
      console.error(error);
    })
    .finally(() => {
      state.leagueRefreshBusy = false;
    });
}

function requestAutoSync({ force = false } = {}) {
  if (!canAutoSyncMatches() || state.autoSyncBusy) {
    return;
  }

  if (isPredictionFormActive()) {
    return;
  }

  const now = Date.now();
  if (!force && now - state.lastAutoSyncKickAt < AUTO_SYNC_RESUME_THROTTLE_MS) {
    return;
  }

  state.lastAutoSyncKickAt = now;
  syncTrackedMatches({ quiet: true }).catch((error) => {
    console.error(error);
  });
}

function handleAutoSyncVisibilityChange() {
  if (document.hidden) {
    return;
  }

  requestForegroundRefresh();
}

function handleAutoSyncResume() {
  requestForegroundRefresh();
}

function requestForegroundRefresh() {
  if (document.hidden || isPredictionFormActive() || state.playerPicker) {
    return;
  }

  const now = Date.now();
  if (now - state.lastForegroundRefreshAt < FOREGROUND_REFRESH_THROTTLE_MS) {
    return;
  }

  state.lastForegroundRefreshAt = now;
  requestLeagueRefresh();
  requestAutoSync();
}

function shouldProbeVisibleMatch(match) {
  if (!match?.id || !match?.external_match_id || getMatchResult(match)) {
    return false;
  }

  if (state.syncingMatchIds.has(match.id) || state.probingMatchIds.has(match.id)) {
    return false;
  }

  const status = computeMatchStatus(match);
  if (!["live", "locked", "finalizing"].includes(status)) {
    return false;
  }

  const lastProbeAt = state.matchStatusProbeTimes[match.id] || 0;
  if (Date.now() - lastProbeAt < MATCH_STATUS_PROBE_THROTTLE_MS) {
    return false;
  }

  const lastSyncedAt = match?.last_synced_at ? new Date(match.last_synced_at).getTime() : 0;
  if (!lastSyncedAt || Number.isNaN(lastSyncedAt)) {
    return true;
  }

  return Date.now() - lastSyncedAt >= MATCH_STATUS_PROBE_STALE_MS;
}

async function maybeProbeVisibleMatchState() {
  const route = getCurrentRoute();
  if (!["home", "current", "matches", "league"].includes(route.page)) {
    return;
  }

  const match = getSelectedMatch();
  if (!shouldProbeVisibleMatch(match)) {
    return;
  }

  await probeVisibleMatchState(match);
}

async function probeVisibleMatchState(match) {
  if (!match?.id || !match?.external_match_id) {
    return;
  }

  state.probingMatchIds.add(match.id);
  state.matchStatusProbeTimes[match.id] = Date.now();

  try {
    const snapshot = await fetchProviderMatchSnapshot(match.external_match_id, match);
    const persistedStatus = computePersistedProviderStatus(snapshot, match, false);
    const normalizedSnapshot = normalizeMatchRecord({
      ...match,
      status: persistedStatus,
      current_innings_ball:
        snapshot?.current_innings_ball ?? match.current_innings_ball ?? null,
      current_over_display:
        cleanNullableText(snapshot?.current_over_display, 20) || match.current_over_display || null,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
    });

    const hasMeaningfulChange =
      computeMatchStatus(normalizedSnapshot) !== computeMatchStatus(match) ||
      normalizedSnapshot.current_innings_ball !== match.current_innings_ball ||
      normalizedSnapshot.current_over_display !== match.current_over_display;

    if (!hasMeaningfulChange) {
      return;
    }

    if (currentMembership()?.role === "admin") {
      await syncMatchFromProvider(match, {
        quiet: true,
        background: true,
        flashSuccess: false,
      });
      return;
    }

    state.matches = state.matches.map((entry) =>
      entry.id === match.id ? normalizedSnapshot : entry,
    );
    state.leaderboard = buildLeaderboardFromMatches(
      state.members,
      state.predictions,
      state.matches,
      state.pointAdjustments,
    );
    render();
  } catch (error) {
    console.warn("Visible match status probe failed", error);
  } finally {
    state.probingMatchIds.delete(match.id);
  }
}

function scheduleLeagueReload() {
  if (!state.client || !state.activeLeagueId) {
    return;
  }

  if (state.reloadTimer) {
    window.clearTimeout(state.reloadTimer);
  }

  state.reloadTimer = window.setTimeout(async () => {
    try {
      await loadLeagueBundle();
      render();
    } catch (error) {
      console.error(error);
      flash(error.message || "Live refresh failed.", "error");
    }
  }, 600);
}

function render() {
  applyTheme();
  const route = getCurrentRoute();
  const routeMeta = getRouteMeta(route);

  root.innerHTML = `
    <div class="app-shell">
      <header class="site-header">
        <div class="page-shell site-header-inner">
          <div class="site-brand">
            <div class="site-brand-mark">IPL</div>
            <div class="site-brand-copy">
              <h1>${escapeHtml(state.appName)}</h1>
            </div>
          </div>

          <nav class="primary-nav" aria-label="Primary">
            ${renderPrimaryNav(route)}
          </nav>

          <div class="site-actions">
            <button
              class="theme-toggle"
              type="button"
              data-action="toggle-theme"
              aria-label="${escapeAttribute(state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode")}"
              title="${escapeAttribute(state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode")}"
            >
              <span class="theme-toggle-icon" aria-hidden="true">${state.theme === "dark" ? "☀" : "☾"}</span>
            </button>
            ${
              state.installPromptEvent && !state.isStandalone
                ? `<button class="ghost-btn" type="button" data-action="install-app">Install app</button>`
                : ""
            }
            ${
              state.user
                ? `
                  ${
                    state.demoMode
                      ? ""
                      : `<button class="ghost-btn" type="button" data-action="sign-out">Sign out</button>`
                  }
                `
                : `<a class="btn" href="${buildRouteHref({ page: "account" })}">Open account</a>`
            }
          </div>
        </div>
      </header>

      <section class="page-masthead page-masthead-${escapeAttribute(route.page)}">
        <div class="page-shell page-masthead-inner">
          <div class="page-breadcrumbs">${renderBreadcrumbs(routeMeta)}</div>
          <div class="page-masthead-copy">
            <span class="page-kicker">${escapeHtml(routeMeta.kicker)}</span>
            <h2>${escapeHtml(routeMeta.title)}</h2>
          </div>
          ${route.page === "matches" ? renderMatchesSectionTabs(route) : ""}
        </div>
      </section>

      <main class="page-shell route-main">
        ${renderNotice()}
        ${renderRouteContent(route)}
      </main>
      ${renderMobilePrimaryNav(route)}
      ${renderPredictionScorecardDialog()}
      ${renderPlayerPickerDialog()}
    </div>
  `;

  void ensureOfficialTeamSquadsForMatches(state.matches);
  void maybeProbeVisibleMatchState();
}

function getUtilityLabel() {
  if (state.demoMode) {
    return "Demo mode";
  }

  return getActiveLeague()?.season || APP_CONFIG.DEFAULT_SEASON || "IPL 2026";
}

function getUtilityMessage() {
  if (!state.user) {
    return "Sign in once, then move through your league like a proper tournament site.";
  }

  if (!state.activeLeagueId) {
    return "Create a league or join with an invite code to unlock fixtures, picks, and standings.";
  }

  return `${state.matches.length} fixtures tracked, ${state.members.length} members active, and ${getCompletedMatchCount()} completed results.`;
}

function renderPrimaryNav(route) {
  const items = getPrimaryNavItems();

  return items
    .map((item) => {
      const active = isPrimaryNavItemActive(route, item);
      return `
        <a class="primary-nav-link ${active ? "active" : ""}" href="${buildRouteHref(item.route)}">
          ${escapeHtml(item.label)}
        </a>
      `;
    })
    .join("");
}

function renderMobilePrimaryNav(route) {
  const items = getPrimaryNavItems();

  return `
    <div class="mobile-dock-shell">
      <div class="mobile-dock-spacer" aria-hidden="true"></div>
      <nav class="mobile-dock" aria-label="Primary">
        ${items
          .map((item) => {
            const active = isPrimaryNavItemActive(route, item);
            return `
              <a class="mobile-dock-link ${active ? "active" : ""}" href="${buildRouteHref(item.route)}">
                <span>${escapeHtml(item.shortLabel || item.label)}</span>
              </a>
            `;
          })
          .join("")}
      </nav>
    </div>
  `;
}

function getPrimaryNavItems() {
  const isAdmin = currentMembership()?.role === "admin";

  return [
    { label: "Home", shortLabel: "Home", route: { page: "home" } },
    { label: "Current Match", shortLabel: "Current", route: { page: "current" } },
    { label: "Fixtures", shortLabel: "Fixtures", route: { page: "matches", section: "fixtures" } },
    { label: "Leaderboard", shortLabel: "Leaders", route: { page: "standings" } },
    {
      label: isAdmin ? "Admin" : "Profile",
      shortLabel: isAdmin ? "Admin" : "Profile",
      route: { page: "account" },
    },
  ];
}

function isPrimaryNavItemActive(route, item) {
  if (item.route.page === "matches") {
    return route.page === "matches";
  }

  return route.page === item.route.page;
}

function getMatchesRouteSection(section) {
  return section === "fixtures" ? "fixtures" : "centre";
}

function getRouteMeta(route) {
  const selectedMatch = getSelectedMatch();
  const isAdmin = currentMembership()?.role === "admin";
  const routeKey =
    route.page === "matches"
      ? `matches-${getMatchesRouteSection(route.section || "fixtures")}`
      : route.page;
  const meta = {
    home: {
      kicker: "Home",
      title: "League Home",
      description: "Jump between live fixtures, score calls, standings, and admin control without losing the flow.",
      breadcrumbs: ["Home"],
    },
    current: {
      kicker: "Current Match",
      title: "Current Match",
      description: "This page follows the next fixture that still needs your attention, so you never have to hunt for the right match on mobile.",
      breadcrumbs: ["Home", "Current Match"],
    },
    "matches-fixtures": {
      kicker: "Matches",
      title: "Fixtures",
      description: "Browse every league fixture in a cleaner tournament-style timeline with filters and direct match-centre access.",
      breadcrumbs: ["Home", "Matches", "Fixtures"],
    },
    "matches-centre": {
      kicker: "Matches",
      title: "Match Centre",
      description: selectedMatch
        ? `${selectedMatch.title || `${selectedMatch.team_a} vs ${selectedMatch.team_b}`} · ${selectedMatch.venue || "Venue TBD"}`
        : "Open one match at a time for picks, live lock windows, squad checks, and result status.",
      breadcrumbs: ["Home", "Matches", "Match Centre"],
    },
    "matches-admin": {
      kicker: "Matches",
      title: "Admin Console",
      description: "Sync the official fixture feed, override live clocks, and settle results from one creator view.",
      breadcrumbs: ["Home", "Matches", "Admin Console"],
    },
    standings: {
      kicker: "Standings",
      title: "Points Table",
      description: "Track the season race, member totals, and scoring rules in one place.",
      breadcrumbs: ["Home", "Standings"],
    },
    league: {
      kicker: "League",
      title: "League Room",
      description: "The full control centre for invite codes, fixtures, members, scoring, and creator tools.",
      breadcrumbs: ["Home", "League"],
    },
    account: {
      kicker: isAdmin ? "Admin" : "Account",
      title: isAdmin ? "Admin & Profile" : "Profile & Access",
      description: isAdmin
        ? "Your profile stays here, along with quick links into the recovery and league-control tools."
        : "Manage sign-in, display name, and league access from one dedicated page.",
      breadcrumbs: ["Home", isAdmin ? "Admin" : "Account"],
    },
  }[routeKey];

  return meta || {
    kicker: "Home",
    title: "League Home",
    description: "Your IPL prediction room is ready.",
    breadcrumbs: ["Home"],
  };
}

function renderBreadcrumbs(routeMeta) {
  return routeMeta.breadcrumbs
    .map((crumb, index) => {
      const isLast = index === routeMeta.breadcrumbs.length - 1;
      return `<span class="breadcrumb-item ${isLast ? "active" : ""}">${escapeHtml(crumb)}</span>`;
    })
    .join('<span class="breadcrumb-separator">/</span>');
}

function renderMatchesSectionTabs(route) {
  const activeSection = getMatchesRouteSection(route.section);
  const matchId = getSelectedMatch()?.id || route.matchId || "";
  const sections = [
    { key: "fixtures", label: "Fixtures" },
    { key: "centre", label: "Match Centre" },
  ];

  return `
    <div class="page-tabs">
      ${sections
        .map((section) => `
          <a
            class="page-tab ${activeSection === section.key ? "active" : ""}"
            href="${buildRouteHref({ page: "matches", section: section.key, matchId })}"
          >
            ${escapeHtml(section.label)}
          </a>
        `)
        .join("")}
    </div>
  `;
}

function renderRouteContent(route) {
  switch (route.page) {
    case "current":
      return renderCurrentMatchPage();
    case "matches":
      return renderMatchesPage(route);
    case "standings":
      return renderStandingsPage();
    case "league":
      return renderLeaguePage();
    case "account":
      return renderAccountPage();
    case "home":
    default:
      return renderHomePage();
  }
}

function renderNotice() {
  if (!state.notice) {
    return "";
  }

  const tone = state.notice.tone || "info";
  const noticeMeta = {
    info: { label: "Heads up", icon: "i" },
    success: { label: "Saved", icon: "✓" },
    warning: { label: "Heads up", icon: "!" },
    error: { label: "Check this", icon: "!" },
  }[tone] || { label: "Notice", icon: "i" };

  return `
    <div class="notice notice-${escapeHtml(tone)}">
      <span class="notice-mark">${escapeHtml(noticeMeta.icon)}</span>
      <div class="notice-copy">
        <strong>${escapeHtml(noticeMeta.label)}</strong>
        <span>${escapeHtml(state.notice.message)}</span>
      </div>
    </div>
  `;
}

function renderHero() {
  const leader = getLeagueWinner();
  const focusMatch = getLeagueFocusMatch();
  const leagueEnded = getActiveLeague()?.status === "archived";
  const heroHref = buildRouteHref({ page: state.activeLeagueId ? "league" : "account" });
  const heroCtaLabel = state.activeLeagueId ? "Enter league hub" : "Open account";

  return `
    <section class="hero">
      <div class="hero-grid">
        <div class="hero-story">
          <div class="eyebrow">IPL prediction room</div>
          <h2>One league link. Real match pressure. Zero group-chat chaos.</h2>
          <p>
            Bring your friends into one polished space for squad picks, score calls, lock windows, and bragging rights.
            The app handles the schedule, match engine, and leaderboard so the drama stays on the cricket.
          </p>
          <div class="hero-actions">
            <a class="btn" href="${heroHref}">${heroCtaLabel}</a>
            ${
              state.installPromptEvent && !state.isStandalone
                ? `<button class="ghost-btn" type="button" data-action="install-app">Install on phone</button>`
                : ""
            }
          </div>
          <div class="hero-stat-grid">
            <div class="hero-stat-card">
              <span>Player phase</span>
              <strong>Until 3.1 overs</strong>
            </div>
            <div class="hero-stat-card">
              <span>Score phase</span>
              <strong>3.1 to 7.1 overs</strong>
            </div>
            <div class="hero-stat-card">
              <span>Uniqueness</span>
              <strong>Pair + score only</strong>
            </div>
          </div>
        </div>
        <div class="hero-meta">
          <div class="glass-card hero-callout">
            <span class="panel-kicker">${escapeHtml(getHeroStatusLabel(focusMatch))}</span>
            <h3>${escapeHtml(focusMatch?.title || "Your league command room is ready")}</h3>
            <p>${escapeHtml(getLeaguePulseCopy(leagueEnded, leader, focusMatch))}</p>
            <div class="hero-spotlight">
              <span class="chip"><strong>Leader</strong>${escapeHtml(leader?.display_name || "Waiting")}</span>
              <span class="chip"><strong>Your leagues</strong>${escapeHtml(state.memberships.length || 0)}</span>
              <span class="chip"><strong>Matches tracked</strong>${escapeHtml(state.matches.length || 0)}</span>
            </div>
          </div>
          <div class="glass-card">
            <div class="section-head section-head-tight">
              <div>
                <h3>Scoring system</h3>
                <p>Clear enough to trust, tense enough to matter.</p>
              </div>
            </div>
            <div class="score-strip">
              <div class="score-pill"><span>Batsman</span><strong>Runs = points</strong></div>
              <div class="score-pill"><span>Bowler</span><strong>20 per wicket</strong></div>
              <div class="score-pill"><span>Exact total</span><strong>+10</strong></div>
              <div class="score-pill"><span>Match winner</span><strong>+50</strong></div>
            </div>
          </div>
          <div class="glass-card hero-playbook">
            <span class="panel-kicker">Match-day rhythm</span>
            <div class="playbook-list">
              <div class="playbook-item">
                <span>01</span>
                <div>
                  <strong>Pick your pair</strong>
                  <p>Choose one batsman, one bowler, and one winner from the official squad list.</p>
                </div>
              </div>
              <div class="playbook-item">
                <span>02</span>
                <div>
                  <strong>Let the overs clock decide</strong>
                  <p>The app locks player picks at 3.1 overs, then opens score prediction until 7.1.</p>
                </div>
              </div>
              <div class="playbook-item">
                <span>03</span>
                <div>
                  <strong>Watch the board shift</strong>
                  <p>Scores settle automatically and the table updates without anyone calculating by hand.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderHomePage() {
  return `
    <section class="route-stack">
      ${renderBroadcastHero()}
      ${
        state.activeLeagueId
          ? `
            <div class="route-stack">
              ${renderLeaderboardPanel("Top of the Table")}
              ${renderMembersPanel("League Squad")}
            </div>
          `
          : `
            <div class="profile-route-grid">
              <div class="profile-route-stack">
                ${renderAccountPanel()}
                ${renderPredictionWindowsPanel()}
              </div>
              <div class="profile-route-stack">
                ${renderLeagueAccessPanel()}
                ${renderScoringPanel()}
              </div>
            </div>
          `
      }
    </section>
  `;
}

function renderCurrentMatchPage() {
  if (!state.activeLeagueId) {
    return renderLeagueGate(
      "Current match unlocks after you join a league",
      "Once you are inside a league, this page follows the next fixture that still needs attention so mobile users can go straight to the right match.",
    );
  }

  const match = getCurrentActionMatch();
  const isAdmin = currentMembership()?.role === "admin";
  const leagueEnded = getActiveLeague()?.status === "archived";
  const prediction = getCurrentUserPrediction(match?.id);
  const headline = match
    ? `${match.team_a} vs ${match.team_b}`
    : "No current fixture yet";
  const reason = match ? getCurrentMatchReason(match, prediction) : "Sync fixtures to pin the right match here.";

  return `
    <section class="route-stack">
      <section class="broadcast-hero broadcast-hero-compact current-match-hero">
        <div class="broadcast-copy">
          <span class="panel-kicker">Current match</span>
          <h2>${escapeHtml(headline)}</h2>
          <p>${escapeHtml(reason)}</p>
          <div class="hero-actions">
            <a class="btn" href="${buildRouteHref({ page: "matches", section: match ? "centre" : "fixtures", matchId: match?.id || null })}">
              ${match ? "Open full match centre" : "Browse fixtures"}
            </a>
            <a class="ghost-btn" href="${buildRouteHref({ page: "standings" })}">Open leaderboard</a>
          </div>
          <div class="broadcast-meta-grid">
            <div class="broadcast-stat">
              <span>Window</span>
              <strong>${escapeHtml(match ? getCurrentMatchWindowLabel(match, prediction) : "Waiting")}</strong>
            </div>
            <div class="broadcast-stat">
              <span>Your points</span>
              <strong>${escapeHtml(getCurrentUserPoints())}</strong>
            </div>
            <div class="broadcast-stat">
              <span>Role</span>
              <strong>${escapeHtml(isAdmin ? "Admin" : "Member")}</strong>
            </div>
          </div>
        </div>
        <div class="broadcast-scoreboard">
          <div class="broadcast-scoreboard-head">
            <span class="tag tag-${match ? computeMatchStatus(match) : "scheduled"}">${escapeHtml(match ? labelizeStatus(computeMatchStatus(match)) : "Waiting")}</span>
            <span class="subtle">${escapeHtml(match ? formatDate(match.starts_at) : "Match queue loading")}</span>
          </div>
          <strong class="broadcast-title">${escapeHtml(match?.title || "Current match queue")}</strong>
          <div class="broadcast-detail-row">
            <span class="chip"><strong>Venue</strong>${escapeHtml(match?.venue || "Venue TBD")}</span>
            <span class="chip"><strong>Pick state</strong>${escapeHtml(match ? getCurrentMatchPickState(match, prediction) : "Waiting")}</span>
            <span class="chip"><strong>Role</strong>${escapeHtml(isAdmin ? "Admin" : "Member")}</span>
          </div>
        </div>
      </section>

      <div class="route-stack">
        ${
          match
            ? renderMatchDetail(match, prediction, isAdmin, leagueEnded)
            : `<section class="panel"><div class="empty-state">No actionable fixture is pinned yet. Browse the full fixture list to pick the match you want.</div></section>`
        }
      </div>
    </section>
  `;
}

function renderBroadcastHero() {
  const league = getActiveLeague();
  const focusMatch = getCurrentActionMatch();
  const leader = getLeagueWinner();
  const focusStatus = focusMatch ? labelizeStatus(computeMatchStatus(focusMatch)) : "Waiting";
  const focusTitle = focusMatch?.title || "Sync the league and the season card lands here";
  const focusVenue = focusMatch?.venue || "Venue to be confirmed";
  const currentMatchHref = buildRouteHref(
    focusMatch ? { page: "current" } : { page: "matches", section: "fixtures" },
  );
  const fixturesHref = buildRouteHref({
    page: "matches",
    section: "fixtures",
    matchId: focusMatch?.id || getSelectedMatch()?.id || null,
  });
  const isAdmin = currentMembership()?.role === "admin";
  const leagueEnded = league?.status === "archived";

  return `
    <section class="broadcast-hero">
      <div class="broadcast-copy">
        <span class="panel-kicker">${league ? "IPL League Live" : "Prediction League"}</span>
        <h2>${escapeHtml(league?.season || "IPL 2026")}</h2>
        <div class="hero-actions">
          <a class="btn" href="${currentMatchHref}">${focusMatch ? "Current match" : "Browse fixtures"}</a>
          <a class="ghost-btn" href="${fixturesHref}">View all fixtures</a>
          <a class="ghost-btn" href="${buildRouteHref({ page: "account" })}">
            ${isAdmin ? "League controls" : "Open profile"}
          </a>
        </div>
        ${
          league
            ? `
              <div class="broadcast-control-row">
                ${
                  leagueEnded
                    ? `<span class="chip broadcast-control-chip"><strong>Season</strong>Ended</span>`
                    : `
                      <button
                        class="ghost-btn broadcast-control-chip broadcast-copy-chip"
                        type="button"
                        data-action="copy-invite-code"
                        data-invite-code="${escapeAttribute(league.invite_code || "")}"
                        aria-label="Copy invite code"
                        title="Copy invite code"
                      >
                        <strong>Invite</strong>
                        <span>${escapeHtml(league.invite_code || "-")}</span>
                        <span class="broadcast-copy-icon" aria-hidden="true">⧉</span>
                      </button>
                    `
                }
                ${
                  isAdmin && !leagueEnded
                    ? `<button class="ghost-btn danger-btn" type="button" data-action="end-league" data-league-id="${league.id}" ${
                        state.endingLeagueId === league.id ? "disabled" : ""
                      }>${state.endingLeagueId === league.id ? "Ending..." : "End season"}</button>`
                    : ""
                }
              </div>
            `
            : ""
        }
      </div>
      <div class="broadcast-scoreboard">
        <div class="broadcast-scoreboard-head">
          <span class="tag tag-${focusMatch ? computeMatchStatus(focusMatch) : "scheduled"}">${escapeHtml(focusStatus)}</span>
          <span class="subtle">${escapeHtml(focusMatch ? formatDate(focusMatch.starts_at) : "League not synced yet")}</span>
        </div>
        <strong class="broadcast-title">${escapeHtml(focusTitle)}</strong>
        <div class="broadcast-clash">
          <div class="broadcast-team">
            ${renderTeamMark(focusMatch?.team_a || "Team A", "hero")}
            <strong>${escapeHtml(focusMatch?.team_a || "Team A")}</strong>
          </div>
          <div class="broadcast-versus">VS</div>
          <div class="broadcast-team">
            ${renderTeamMark(focusMatch?.team_b || "Team B", "hero")}
            <strong>${escapeHtml(focusMatch?.team_b || "Team B")}</strong>
          </div>
        </div>
        <div class="broadcast-detail-row">
          <span class="chip"><strong>Venue</strong>${escapeHtml(focusVenue)}</span>
          <span class="chip"><strong>Members</strong>${escapeHtml(state.members.length || 0)}</span>
          <span class="chip"><strong>Your points</strong>${escapeHtml(getCurrentUserPoints())}</span>
        </div>
      </div>
    </section>
  `;
}

function renderLeagueStudioPanel() {
  const league = getActiveLeague();
  const match = getSelectedMatch();
  const leader = getLeagueWinner();
  const isAdmin = currentMembership()?.role === "admin";
  const leagueEnded = league?.status === "archived";

  if (!league) {
    return "";
  }

  return `
    <section class="panel league-command-stage">
      <div class="league-command-head">
        <div>
          <span class="panel-kicker">${leagueEnded ? "Season archive" : "League hub"}</span>
          <h3>${escapeHtml(league.name || "League room")}</h3>
          <p>
            ${leagueEnded
              ? "The season is closed and preserved as the final archive."
              : "Invites, match focus, and the league pulse live here instead of inside a long scrolling dashboard."}
          </p>
        </div>
        <div class="league-command-actions">
          ${
            leagueEnded
              ? `<span class="tag tag-completed">Ended</span>`
              : `<span class="chip"><strong>Invite</strong>${escapeHtml(league.invite_code || "-")}</span>`
          }
          ${
            !leagueEnded
              ? `<button class="ghost-btn" type="button" data-action="copy-invite-code" data-invite-code="${escapeAttribute(league.invite_code || "")}">Copy invite</button>`
              : ""
          }
          <button class="ghost-btn" type="button" data-action="refresh-league">Refresh</button>
          ${
            isAdmin && !leagueEnded
              ? `<button class="ghost-btn" type="button" data-action="end-league" data-league-id="${league.id}" ${
                  state.endingLeagueId === league.id ? "disabled" : ""
                }>${state.endingLeagueId === league.id ? "Ending..." : "End season"}</button>`
              : ""
          }
        </div>
      </div>
      <div class="league-command-stats">
        <div class="broadcast-stat">
          <span>Season</span>
          <strong>${escapeHtml(league.season || "IPL 2026")}</strong>
        </div>
        <div class="broadcast-stat">
          <span>Completed</span>
          <strong>${escapeHtml(getCompletedMatchCount())}</strong>
        </div>
        <div class="broadcast-stat">
          <span>Leader</span>
          <strong>${escapeHtml(leader?.display_name || "Waiting")}</strong>
        </div>
      </div>
      <div class="league-context-grid">
        <div class="context-card">
          <span class="panel-kicker">Selected match</span>
          <strong>${escapeHtml(match?.title || "Choose a fixture from Matches")}</strong>
          <p>${escapeHtml(match ? `${formatDate(match.starts_at)} · ${match.venue || "Venue TBD"}` : "Open Fixtures or Match Centre to select the game you want to work on.")}</p>
        </div>
        <div class="context-card">
          <span class="panel-kicker">Your role</span>
          <strong>${escapeHtml(isAdmin ? "League Admin" : "League Member")}</strong>
          <p>${escapeHtml(isAdmin ? "You can sync official data, end the season, and settle results." : "You can post picks, track the table, and follow every fixture from the same shell.")}</p>
        </div>
      </div>
    </section>
  `;
}

function renderLeagueOverviewModule() {
  const league = getActiveLeague();
  const focusMatch = getCurrentActionMatch();
  const leader = getLeagueWinner();
  const leagueEnded = league?.status === "archived";

  if (!league) {
    return "";
  }

  return `
    <section class="panel route-overview-panel">
      <div class="section-head">
        <div>
          <span class="panel-kicker">${leagueEnded ? "Season complete" : "League overview"}</span>
          <h3>${escapeHtml(league.name || "League room")}</h3>
          <p>${
            leagueEnded
              ? "The season is archived. The standings stay visible, but picks and invites are frozen."
              : "Your invite code, live fixture count, and league pulse all live here."
          }</p>
        </div>
        <div class="route-overview-actions">
          ${
            leagueEnded
              ? `<span class="tag tag-completed">Ended</span>`
              : `<span class="chip"><strong>Invite</strong>${escapeHtml(league.invite_code || "-")}</span>`
          }
          <a class="ghost-btn" href="${buildRouteHref({ page: "league" })}">Open control centre</a>
        </div>
      </div>
      <div class="metric-grid">
        <div class="stat-card">
          <span>Members</span>
          <strong>${state.members.length}</strong>
        </div>
        <div class="stat-card">
          <span>Fixtures</span>
          <strong>${state.matches.length}</strong>
        </div>
        <div class="stat-card">
          <span>Your points</span>
          <strong>${getCurrentUserPoints()}</strong>
        </div>
        <div class="stat-card">
          <span>Completed</span>
          <strong>${getCompletedMatchCount()}</strong>
        </div>
      </div>
      <div class="league-callouts">
        <div class="mini-panel spotlight-panel">
          <span class="panel-kicker">League leader</span>
          <strong>${escapeHtml(leader?.display_name || "Waiting for first result")}</strong>
          <p>${leader ? `${escapeHtml(leader.total_points)} points across the season.` : "Points will land here once matches start settling."}</p>
        </div>
        <div class="mini-panel spotlight-panel">
          <span class="panel-kicker">${focusMatch ? "Focus fixture" : "Next up"}</span>
          <strong>${escapeHtml(focusMatch?.title || "No synced fixtures yet")}</strong>
          <p>${focusMatch ? `${escapeHtml(formatDate(focusMatch.starts_at))} · ${escapeHtml(focusMatch.venue || "Venue TBD")}` : "Sync the IPL season and the fixtures page will fill itself in."}</p>
        </div>
      </div>
    </section>
  `;
}

function renderCompactFixturePanel() {
  const matches = getCurrentMatchQueue(getCurrentActionMatch(), 4);

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>Current and upcoming</h3>
          <p>Quick access to the match you should care about now, plus the nearest fixtures after it.</p>
        </div>
        <a class="ghost-btn" href="${buildRouteHref({ page: "matches", section: "fixtures", matchId: getSelectedMatch()?.id })}">View all</a>
      </div>
      ${
        matches.length
          ? `<div class="mini-fixture-list">${matches.map((match) => renderMiniFixtureRow(match)).join("")}</div>`
          : `<div class="empty-state">Sync the IPL fixture list and the timeline will appear here.</div>`
      }
    </section>
  `;
}

function renderMiniFixtureRow(match) {
  const status = computeMatchStatus(match);

  return `
    <a class="mini-fixture-row" href="${buildRouteHref({ page: "matches", section: "centre", matchId: match.id })}">
      <div class="mini-fixture-copy">
        <div class="mini-fixture-clash">
          <span class="mini-fixture-team">
            ${renderTeamMark(match.team_a, "xs")}
            <strong>${escapeHtml(getTeamShortCode(match.team_a))}</strong>
          </span>
          <span class="mini-fixture-divider">vs</span>
          <span class="mini-fixture-team mini-fixture-team-away">
            ${renderTeamMark(match.team_b, "xs")}
            <strong>${escapeHtml(getTeamShortCode(match.team_b))}</strong>
          </span>
        </div>
        <div class="entry-meta">
          <span class="subtle">${escapeHtml(formatFixtureDayLabel(match.starts_at))}</span>
          <span class="subtle">${escapeHtml(match.venue || "Venue TBD")}</span>
        </div>
      </div>
      <span class="tag tag-${status}">${escapeHtml(labelizeStatus(status))}</span>
    </a>
  `;
}

function renderInlineNotice(tone, title, message) {
  const noticeMeta = {
    info: { icon: "i" },
    success: { icon: "✓" },
    warning: { icon: "!" },
    error: { icon: "!" },
  }[tone] || { icon: "i" };

  return `
    <div class="notice notice-${escapeHtml(tone)}">
      <span class="notice-mark">${escapeHtml(noticeMeta.icon)}</span>
      <div class="notice-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(message)}</span>
      </div>
    </div>
  `;
}

function renderMatchStateNotice(match, syncSummary, isAdmin) {
  const status = computeMatchStatus(match);

  if (status === "finalizing") {
    return renderInlineNotice(
      "warning",
      "Result finalizing",
      `${syncSummary.settlementDetail}${isAdmin ? " Use Sync now if this takes longer than expected." : ""}`,
    );
  }

  if (
    syncSummary.freshnessTone === "stale" &&
    ["live", "locked", "finalizing"].includes(status)
  ) {
    return renderInlineNotice(
      "warning",
      "Live feed looks stale",
      `${syncSummary.freshnessDetail}${isAdmin ? " You can use Sync now to force a refresh." : " Ask your admin to refresh if the clock still looks stuck."}`,
    );
  }

  return "";
}

function renderMatchesPage(route) {
  if (!state.activeLeagueId) {
    return renderLeagueGate(
      "Matches unlock after you join a league",
      "Create or join a league first, then this routed match hub will show fixtures, picks, and standings for that room.",
    );
  }

  const section = getMatchesRouteSection(route.section || "fixtures");
  const match = getSelectedMatch();
  const prediction = getCurrentUserPrediction(match?.id);
  const isAdmin = currentMembership()?.role === "admin";
  const leagueEnded = getActiveLeague()?.status === "archived";

  if (section === "fixtures") {
    return `
      <section class="route-stack">
        ${renderTodayFixturesStrip()}
        ${renderFixtureFilters()}
        ${renderFixtureTimeline()}
      </section>
    `;
  }

  return `
    <section class="route-stack">
      ${renderMatchSwitcherDeck(section)}
      ${
        section === "centre"
          ? match
            ? renderMatchDetail(match, prediction, isAdmin, leagueEnded)
            : `<section class="panel"><div class="empty-state">Choose a match to open the match centre.</div></section>`
          : `
              <section class="panel">
                <div class="section-head">
                  <div>
                    <h3>Admin tools moved</h3>
                    <p>All admin-only actions now live under the Admin/Profile route so the match experience stays focused on fixtures and match centre.</p>
                  </div>
                </div>
                <div class="split-line">
                  <a class="btn" href="${buildRouteHref({ page: "account" })}">${isAdmin ? "Open Admin/Profile" : "Open Profile"}</a>
                  <span class="subtle">${isAdmin ? "Sync, recovery, cancellation, and leaderboard edits now live there." : "Only admins can use that console."}</span>
                </div>
              </section>
            `
      }
    </section>
  `;
}

function renderMatchSwitcherDeck(section) {
  const selectedMatch = getSelectedMatch();

  return `
    <section class="panel match-switcher-deck">
      <div class="section-head">
        <div>
          <span class="panel-kicker">Quick switch</span>
          <h3>${escapeHtml(section === "centre" ? "Match command deck" : "Choose your fixture")}</h3>
          <p>${
            selectedMatch
              ? `Currently focused on ${selectedMatch.title || `${selectedMatch.team_a} vs ${selectedMatch.team_b}`}.`
              : "Choose one match and the rest of the page follows it."
          }</p>
        </div>
      </div>
      ${renderMatchRail(section, "horizontal")}
    </section>
  `;
}

function renderFixtureFilters() {
  const teamOptions = Array.from(
    new Set(state.matches.flatMap((match) => [match.team_a, match.team_b]).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
  const statusOptions = [
    { value: "scheduled", label: "Scheduled" },
    { value: "live", label: "Live" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "all", label: "All statuses" },
  ];

  return `
    <section class="fixture-toolbar">
      <div class="fixture-toolbar-main">
        <div class="fixture-filter-group">
          <label class="fixture-filter">
            <span>Team</span>
            <select id="fixture-team-filter">
              <option value="all">All teams</option>
              ${teamOptions
                .map(
                  (team) => `
                    <option value="${escapeAttribute(team)}" ${
                      state.fixtureFilters.team === team ? "selected" : ""
                    }>${escapeHtml(team)}</option>
                  `,
                )
                .join("")}
            </select>
          </label>
          <label class="fixture-filter">
            <span>Status</span>
            <select id="fixture-status-filter">
              ${statusOptions
                .map(
                  (statusOption) => `
                    <option value="${escapeAttribute(statusOption.value)}" ${
                      state.fixtureFilters.status === statusOption.value ? "selected" : ""
                    }>${escapeHtml(statusOption.label)}</option>
                  `,
                )
                .join("")}
            </select>
          </label>
        </div>
        <div class="fixture-quick-filters" aria-label="Fixture quick filters">
          <button
            class="fixture-filter-chip ${state.fixtureFilters.todayOnly ? "is-active" : ""}"
            type="button"
            data-action="toggle-fixture-filter-flag"
            data-flag="todayOnly"
            aria-pressed="${state.fixtureFilters.todayOnly ? "true" : "false"}"
          >
            Today only
          </button>
          <button
            class="fixture-filter-chip ${state.fixtureFilters.scorecardOnly ? "is-active" : ""}"
            type="button"
            data-action="toggle-fixture-filter-flag"
            data-flag="scorecardOnly"
            aria-pressed="${state.fixtureFilters.scorecardOnly ? "true" : "false"}"
          >
            Has scorecard
          </button>
        </div>
      </div>
      <div class="fixture-toolbar-actions">
        <button class="ghost-btn" type="button" data-action="clear-fixture-filters">Reset filters</button>
        <a class="btn" href="${buildRouteHref({ page: "matches", section: "centre", matchId: getSelectedMatch()?.id })}">Open match centre</a>
      </div>
    </section>
  `;
}

function renderTodayFixturesStrip() {
  const todayMatches = sortMatchesChronologically(state.matches).filter((match) => isTodayMatch(match));

  if (!todayMatches.length) {
    return "";
  }

  return `
    <section class="panel fixture-spotlight">
      <div class="section-head">
        <div>
          <span class="panel-kicker">Today first</span>
          <h3>${escapeHtml(todayMatches.length === 1 ? "Today’s match" : "Today’s matches")}</h3>
          <p>${escapeHtml(
            todayMatches.length === 1
              ? "Keep the live fixture closest to the filters so today’s action is always in front."
              : "Today has more than one fixture, so both are pinned here before the full season timeline.",
          )}</p>
        </div>
      </div>
      <div class="fixture-timeline fixture-spotlight-grid">
        ${todayMatches
          .map((match) => renderFixtureTimelineCard(match, { extraClass: "fixture-card-today" }))
          .join("")}
      </div>
    </section>
  `;
}

function getFilteredMatches() {
  return state.matches.filter((match) => {
    const computedStatus = computeFixtureFilterStatus(match);
    const hasPredictionScorecard = Boolean(getMatchResult(match));
    const teamMatch =
      state.fixtureFilters.team === "all" ||
      match.team_a === state.fixtureFilters.team ||
      match.team_b === state.fixtureFilters.team;
    const statusMatch =
      state.fixtureFilters.status === "all" || computedStatus === state.fixtureFilters.status;
    const todayMatch = !state.fixtureFilters.todayOnly || isTodayMatch(match);
    const scorecardMatch = !state.fixtureFilters.scorecardOnly || hasPredictionScorecard;
    return teamMatch && statusMatch && todayMatch && scorecardMatch;
  });
}

function computeFixtureFilterStatus(match) {
  const status = computeMatchStatus(match);
  if (status === "completed" || status === "cancelled") {
    return status;
  }

  if (["live", "locked", "finalizing"].includes(status)) {
    return "live";
  }

  return "scheduled";
}

function renderFixtureTimeline() {
  const matches = getFilteredMatches();

  return `
    <section class="fixture-timeline">
      ${
        matches.length
          ? matches
              .map((match) => renderFixtureTimelineCard(match))
              .join("")
          : `<section class="panel"><div class="empty-state">No fixtures match the selected filters yet.</div></section>`
      }
    </section>
  `;
}

function renderFixtureTimelineCard(match, { extraClass = "" } = {}) {
  const matchNumber = state.matches.findIndex((entry) => entry.id === match.id) + 1;
  const status = computeMatchStatus(match);
  const hasPredictionScorecard = Boolean(getMatchResult(match));
  const classes = ["fixture-card", `fixture-card-${status}`, cleanText(extraClass, 80)].filter(Boolean).join(" ");

  return `
    <article class="${escapeAttribute(classes)}">
      <div class="fixture-card-date">
        <span class="fixture-badge">Match ${escapeHtml(matchNumber || "-")}</span>
        <strong>${escapeHtml(formatFixtureDayLabel(match.starts_at))}</strong>
        <span>${escapeHtml(formatFixtureTimeLabel(match.starts_at))}</span>
      </div>
      <div class="fixture-card-line">
        <span></span>
      </div>
      <div class="fixture-card-main">
        <div class="fixture-card-headline">
          <span class="tag tag-${status}">${escapeHtml(labelizeStatus(status))}</span>
          <span class="fixture-venue">${escapeHtml(match.venue || "Venue TBD")}</span>
        </div>
        <div class="fixture-clash">
          ${renderFixtureTeamBlock(match.team_a)}
          <span class="fixture-versus">VS</span>
          ${renderFixtureTeamBlock(match.team_b)}
        </div>
      </div>
      <div class="fixture-card-actions">
        <button
          class="match-centre-btn"
          type="button"
          data-action="open-match-section"
          data-section="centre"
          data-match-id="${match.id}"
        >
          Match Centre
        </button>
        ${
          hasPredictionScorecard
            ? `
              <button
                class="ghost-btn fixture-scorecard-btn"
                type="button"
                data-action="open-prediction-scorecard"
                data-match-id="${match.id}"
              >
                Scorecard
              </button>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function renderFixtureTeamBlock(teamName) {
  return `
    <div class="fixture-team-block">
      ${renderTeamMark(teamName, "lg")}
      <div class="fixture-team-copy">
        <strong>${escapeHtml(teamName)}</strong>
        <span>${escapeHtml(getTeamShortCode(teamName))}</span>
      </div>
    </div>
  `;
}

function renderMatchRail(section, layout = "stack") {
  if (!state.matches.length) {
    return `<div class="empty-state">No fixtures are loaded yet.</div>`;
  }

  return `
    <div class="match-rail ${layout === "horizontal" ? "match-rail-horizontal" : ""}">
      ${state.matches
        .map(
          (match) => `
            <button
              class="match-rail-item ${match.id === getSelectedMatch()?.id ? "active" : ""}"
              type="button"
              data-action="open-match-section"
              data-section="${escapeAttribute(section)}"
              data-match-id="${match.id}"
            >
              <span class="match-rail-title">
                <span class="match-rail-clash">
                  <span class="mini-fixture-team">
                    ${renderTeamMark(match.team_a, "xs")}
                    <strong>${escapeHtml(getTeamShortCode(match.team_a))}</strong>
                  </span>
                  <span class="mini-fixture-divider">vs</span>
                  <span class="mini-fixture-team mini-fixture-team-away">
                    ${renderTeamMark(match.team_b, "xs")}
                    <strong>${escapeHtml(getTeamShortCode(match.team_b))}</strong>
                  </span>
                </span>
              </span>
              <span class="match-rail-meta">${escapeHtml(formatFixtureDayLabel(match.starts_at))} · ${escapeHtml(labelizeStatus(computeMatchStatus(match)))}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderMatchSummaryStrip(match) {
  if (!match) {
    return `
      <section class="panel">
        <div class="empty-state">No match selected yet. Pick one from the left-hand rail.</div>
      </section>
    `;
  }

  return `
    <section class="panel match-summary-strip">
      <div>
        <span class="panel-kicker">${escapeHtml(labelizeStatus(computeMatchStatus(match)))}</span>
        <h3>${escapeHtml(match.title || `${match.team_a} vs ${match.team_b}`)}</h3>
        <p>${escapeHtml(match.venue || "Venue TBD")} · ${escapeHtml(formatDate(match.starts_at))}</p>
      </div>
    </section>
  `;
}

function getActiveMatchCentrePanel(hasResult) {
  const availablePanels = MATCH_CENTRE_PANELS.filter(
    (panel) => !panel.requiresResult || hasResult,
  );

  return (
    availablePanels.find((panel) => panel.key === state.activeMatchCentrePanel)?.key ||
    availablePanels[0]?.key ||
    "prediction"
  );
}

function getMatchCentrePanelKeyFromId(panelId) {
  return (
    MATCH_CENTRE_PANELS.find((panel) => panel.panelId === panelId)?.key || "prediction"
  );
}

function renderMatchCentreQuickNav(match, isAdmin, hasResult) {
  const activePanel = getActiveMatchCentrePanel(hasResult);
  const tabs = MATCH_CENTRE_PANELS.filter(
    (panel) => !panel.requiresResult || hasResult,
  );

  return `
    <div class="match-centre-quick-nav" role="tablist" aria-label="Match centre sections">
      ${tabs
        .map(
          (panel) => `
            <button
              class="ghost-btn match-centre-tab ${activePanel === panel.key ? "active" : ""}"
              type="button"
              data-action="jump-match-panel"
              data-panel-id="${panel.panelId}"
              data-panel-key="${panel.key}"
              role="tab"
              aria-selected="${activePanel === panel.key ? "true" : "false"}"
            >
              ${escapeHtml(panel.label)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderPredictionSnapshot(match, prediction) {
  if (!prediction) {
    return `
      <div class="prediction-snapshot prediction-snapshot-empty">
        <div class="entry-item">
          <div>
            <strong>No prediction saved yet</strong>
            <span class="subtle">Choose your pair and winner first, then lock the score once it opens.</span>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="prediction-snapshot">
      <div class="selection-overview-grid">
        <div class="selection-pulse-card">
          <span class="panel-kicker">Batsman</span>
          <div class="identity-stack">
            ${renderPlayerAvatar(match, prediction.batsman_name, { size: "md" })}
            <div class="identity-copy">
              <strong>${escapeHtml(prediction.batsman_name || "Batsman not set")}</strong>
              <span class="subtle">Top run pick</span>
            </div>
          </div>
        </div>
        <div class="selection-pulse-card">
          <span class="panel-kicker">Bowler</span>
          <div class="identity-stack">
            ${renderPlayerAvatar(match, prediction.bowler_name, { size: "md" })}
            <div class="identity-copy">
              <strong>${escapeHtml(prediction.bowler_name || "Bowler not set")}</strong>
              <span class="subtle">Wicket pick</span>
            </div>
          </div>
        </div>
        <div class="selection-pulse-card">
          <span class="panel-kicker">Winner</span>
          <div class="identity-stack">
            ${renderTeamMark(prediction.team_pick || match?.team_a || "", "sm")}
            <div class="identity-copy">
              <strong>${escapeHtml(prediction.team_pick || "Winner not set")}</strong>
              <span class="subtle">Team pick</span>
            </div>
          </div>
        </div>
        <div class="selection-pulse-card">
          <span class="panel-kicker">Score call</span>
          <div class="identity-copy">
            <strong>${escapeHtml(
              prediction.predicted_score !== null && prediction.predicted_score !== undefined
                ? prediction.predicted_score
                : "Score not set",
            )}</strong>
            <span class="subtle">${
              prediction.score_submitted_at
                ? `Submitted ${escapeHtml(formatDate(prediction.score_submitted_at))}`
                : "Waiting for score phase"
            }</span>
          </div>
        </div>
      </div>
      <div class="chip-list">
        ${
          prediction.core_locked_due_to_pre_xi
            ? `<span class="chip"><strong>Before XI</strong>Saved before team news</span>`
            : ""
        }
        ${
          prediction.core_submitted_at
            ? `<span class="chip"><strong>Core saved</strong>${escapeHtml(
                formatDate(prediction.core_submitted_at),
              )}</span>`
            : ""
        }
        ${
          prediction.score_submitted_at
            ? `<span class="chip"><strong>Score saved</strong>${escapeHtml(
                formatDate(prediction.score_submitted_at),
              )}</span>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderPicksBoardPanel(match) {
  if (!match) {
    return `<section class="panel"><div class="empty-state">Choose a match to review the picks board.</div></section>`;
  }

  const entries = getPredictionsForMatch(match.id);
  const prediction = getCurrentUserPrediction(match.id);
  const matchResult = getMatchResult(match);

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>Picks board</h3>
          <p>Every submitted pair, winner call, and score entry for ${escapeHtml(match.title || `${match.team_a} vs ${match.team_b}`)}.</p>
        </div>
      </div>
      <div class="chip-list">
        <span class="chip"><strong>Your picks</strong>${prediction ? "Saved" : "Not submitted"}</span>
        <span class="chip"><strong>Total entries</strong>${entries.length}</span>
        <span class="chip"><strong>Result</strong>${matchResult ? "Settled" : "Pending"}</span>
      </div>
      ${
        entries.length
          ? `<div class="entry-list picks-board-list">${entries.map((entry) => renderPredictionRow(entry)).join("")}</div>`
          : `<div class="empty-state">No one has posted picks for this match yet.</div>`
      }
    </section>
  `;
}

function renderStandingsPage() {
  if (!state.activeLeagueId) {
    return renderLeagueGate(
      "Standings appear once you join a league",
      "Join or create a league first, then the points table will stay available as its own routed page.",
    );
  }

  return `
    <section class="route-stack">
      ${renderLeagueOverviewModule()}
      <div class="route-grid route-grid-standings">
        ${renderLeaderboardPanel("Season Table")}
        ${renderScoringPanel()}
      </div>
    </section>
  `;
}

function renderLeaguePage() {
  if (!state.activeLeagueId) {
    return renderLeagueGate(
      "Create or join a league",
      "Once you are inside a league, this page becomes your full tournament control centre.",
    );
  }

  const match = getSelectedMatch();
  const prediction = getCurrentUserPrediction(match?.id);
  const isAdmin = currentMembership()?.role === "admin";
  const leagueEnded = getActiveLeague()?.status === "archived";

  return `
    <section class="route-stack">
      ${renderLeagueStudioPanel()}
      <div class="league-hub-grid">
        <div class="route-stack">
          ${renderMatchSummaryStrip(match)}
          ${
            match
              ? renderMatchDetail(match, prediction, isAdmin, leagueEnded)
              : `<section class="panel"><div class="empty-state">Open a fixture from Matches to bring it into the league hub.</div></section>`
          }
        </div>
        <div class="route-stack">
          ${renderLeaderboardPanel("League Table")}
          ${renderMembersPanel("League Squad")}
        </div>
      </div>
    </section>
  `;
}

function renderAccountPage() {
  const isAdmin = currentMembership()?.role === "admin";
  const actionMatch = getCurrentActionMatch();
  const adminMatch =
    getSelectedMatch() || actionMatch || sortMatchesChronologically(state.matches)[0] || null;
  const leagueEnded = getActiveLeague()?.status === "archived";

  return `
    <section class="route-stack">
      <section class="broadcast-hero broadcast-hero-compact">
        <div class="broadcast-copy">
          <span class="panel-kicker">${isAdmin ? "Admin & profile" : "Profile & access"}</span>
          <h2>${isAdmin ? "Run the league and still keep your own profile close." : "One place for identity, league entry, and matchday rules."}</h2>
          <p>
            ${
              isAdmin
                ? "Your account route now doubles as the admin doorway, so recovery, sync, and league profile all stay under the same top-level nav item."
                : "Sign in, set your display name, join your league, and understand the scoring windows without seeing deployment instructions."
            }
          </p>
          <div class="hero-actions">
            <a class="btn" href="${buildRouteHref(actionMatch ? { page: "current" } : { page: state.activeLeagueId ? "matches" : "account", section: "fixtures", matchId: getSelectedMatch()?.id })}">
              ${actionMatch ? "Open current match" : state.activeLeagueId ? "Open fixtures" : "Stay here"}
            </a>
            <a class="ghost-btn" href="${buildRouteHref({ page: "standings" })}">View leaderboard</a>
          </div>
        </div>
        <div class="broadcast-scoreboard">
          <div class="broadcast-scoreboard-head">
            <span class="tag tag-scheduled">${isAdmin ? "Admin" : "Account"}</span>
            <span class="subtle">${escapeHtml(state.user ? "Signed in" : "Not signed in")}</span>
          </div>
          <div class="identity-stack">
            ${renderMemberAvatar(
              state.profile?.display_name || getUserIdentityLabel() || "Player profile",
              "md",
              "",
              state.profile?.avatar_url || getUserAvatarUrl(state.user),
            )}
            <div class="identity-copy">
              <strong class="broadcast-title">${escapeHtml(state.profile?.display_name || getUserIdentityLabel() || "Player profile")}</strong>
              <span class="subtle">${escapeHtml(getUserIdentityLabel() || "League identity")}</span>
            </div>
          </div>
          <div class="broadcast-detail-row">
            <span class="chip"><strong>Leagues</strong>${escapeHtml(state.memberships.length || 0)}</span>
            <span class="chip"><strong>Status</strong>${escapeHtml(state.user ? "Ready" : "Needs sign-in")}</span>
            <span class="chip"><strong>Theme</strong>${escapeHtml(state.theme)}</span>
            <span class="chip"><strong>Role</strong>${escapeHtml(isAdmin ? "Admin" : "Member")}</span>
          </div>
        </div>
      </section>
      <div class="profile-route-grid">
        <div class="profile-route-stack">
        ${renderAccountPanel()}
        ${renderPredictionWindowsPanel()}
        </div>
      <div class="profile-route-stack">
        ${renderLeagueAccessPanel()}
        ${renderScoringPanel()}
      </div>
      </div>
      ${isAdmin ? renderAdminConsoleWorkspace(adminMatch, leagueEnded) : ""}
    </section>
  `;
}

function renderAdminConsoleWorkspace(match, leagueEnded) {
  if (!state.activeLeagueId) {
    return "";
  }

  return `
    <section class="route-stack">
      <section class="panel match-switcher-deck">
        <div class="section-head">
          <div>
            <span class="panel-kicker">Admin only</span>
            <h3>Admin console</h3>
            <p>Sync, recovery, cancellation, and leaderboard edits all live here now so the rest of the app stays cleaner for matchday users.</p>
          </div>
        </div>
        ${
          state.matches.length
            ? `
              <div class="match-rail match-rail-horizontal">
                ${state.matches
                  .map(
                    (fixture) => `
                      <button
                        class="match-rail-item ${fixture.id === match?.id ? "active" : ""}"
                        type="button"
                        data-action="select-match"
                        data-match-id="${fixture.id}"
                      >
                        <span class="match-rail-title">
                          <span class="match-rail-clash">
                            <span class="mini-fixture-team">
                              ${renderTeamMark(fixture.team_a, "xs")}
                              <strong>${escapeHtml(getTeamShortCode(fixture.team_a))}</strong>
                            </span>
                            <span class="mini-fixture-divider">vs</span>
                            <span class="mini-fixture-team mini-fixture-team-away">
                              ${renderTeamMark(fixture.team_b, "xs")}
                              <strong>${escapeHtml(getTeamShortCode(fixture.team_b))}</strong>
                            </span>
                          </span>
                        </span>
                        <span class="match-rail-meta">${escapeHtml(formatFixtureDayLabel(fixture.starts_at))} · ${escapeHtml(labelizeStatus(computeMatchStatus(fixture)))}</span>
                      </button>
                    `,
                  )
                  .join("")}
              </div>
            `
            : `<div class="empty-state">Sync the IPL schedule first to unlock match-specific admin tools.</div>`
        }
      </section>
      ${
        match
          ? renderMatchSummaryStrip(match)
          : `<section class="panel"><div class="empty-state">Choose a fixture above to open the admin console for that match.</div></section>`
      }
      ${
        leagueEnded
          ? `<section class="panel"><div class="empty-state">This league is archived, so admin controls are frozen and the room now acts as the final record.</div></section>`
          : renderAdminTools(match)
      }
    </section>
  `;
}

function renderLeagueGate(title, description) {
  return `
    <section class="route-stack">
      <section class="panel">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
          </div>
        </div>
      </section>
      ${renderAccountPage()}
    </section>
  `;
}

function renderLeaderboardPanel(title = "Leaderboard") {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>Season totals across every completed match in the active league.</p>
        </div>
      </div>
      ${
        state.leaderboard.length
          ? `<div class="leaderboard-list">${state.leaderboard
              .map((entry, index) => renderLeaderboardRow(entry, index))
              .join("")}</div>`
          : `<div class="empty-state">Points appear after the first scored match.</div>`
      }
    </section>
  `;
}

function renderMembersPanel(title = "Players") {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>Everyone active in the current league.</p>
        </div>
      </div>
      ${
        state.members.length
          ? `<div class="member-list">${state.members
              .map(
                (member) => `
                  <div class="member-item">
                    <div class="identity-stack">
                      ${renderMemberAvatar(member.display_name, "sm", "", member.avatar_url || "")}
                      <div class="identity-copy">
                        <strong>${escapeHtml(member.display_name)}</strong>
                        <span class="subtle">Joined ${escapeHtml(formatDate(member.joined_at, "date"))}</span>
                      </div>
                    </div>
                    <span class="tag ${member.role === "admin" ? "tag-admin" : "tag-member"}">${escapeHtml(member.role)}</span>
                  </div>
                `,
              )
              .join("")}</div>`
          : `<div class="empty-state">No members are active in this league yet.</div>`
      }
    </section>
  `;
}

function renderScoringPanel() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>Scoring system</h3>
          <p>The exact same rules, just presented in a cleaner route.</p>
        </div>
      </div>
      <div class="score-strip">
        <div class="score-pill"><span>Batsman</span><strong>Runs = points</strong></div>
        <div class="score-pill"><span>Bowler</span><strong>20 per wicket</strong></div>
        <div class="score-pill"><span>Exact total</span><strong>+10</strong></div>
        <div class="score-pill"><span>Winning team</span><strong>+50</strong></div>
      </div>
    </section>
  `;
}

function renderPredictionWindowsPanel() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>Prediction windows</h3>
          <p>The game flow, without the clutter.</p>
        </div>
      </div>
      <div class="rules-grid">
        <div class="context-card">
          <span class="panel-kicker">Phase 1</span>
          <strong>Core picks</strong>
          <p>One batsman, one bowler, one winner. These lock at 3.1 overs.</p>
        </div>
        <div class="context-card">
          <span class="panel-kicker">Phase 2</span>
          <strong>Exact total</strong>
          <p>First-innings score calls stay open until 7.1 overs.</p>
        </div>
        <div class="context-card">
          <span class="panel-kicker">Phase 3</span>
          <strong>Settle & table</strong>
          <p>Results land, points recalculate, and the league table updates.</p>
        </div>
      </div>
    </section>
  `;
}

function formatFixtureDayLabel(value) {
  if (!value) {
    return "DATE TBD";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "DATE TBD";
  }

  const parts = new Intl.DateTimeFormat(undefined, {
    month: "short",
    weekday: "short",
    day: "numeric",
  }).formatToParts(date);

  const month = parts.find((part) => part.type === "month")?.value || "";
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${month}, ${weekday} ${day}`.toUpperCase();
}

function formatFixtureTimeLabel(value) {
  if (!value) {
    return "Time TBD";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Time TBD";
  }

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const zone =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value || "";
  return `${time} ${zone}`.trim();
}

function getMatchStartTimestamp(match) {
  if (!match?.starts_at) {
    return null;
  }

  const startsAt = new Date(match.starts_at).getTime();
  return Number.isNaN(startsAt) ? null : startsAt;
}

function getDayKey(value, timeZone = LEAGUE_MATCH_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function isTodayMatch(match, referenceTime = Date.now()) {
  const startsAt = getMatchStartTimestamp(match);
  if (startsAt === null) {
    return false;
  }

  return getDayKey(startsAt) === getDayKey(referenceTime);
}

function hasScorePrediction(prediction) {
  return (
    prediction?.predicted_score !== null &&
    prediction?.predicted_score !== undefined &&
    prediction?.predicted_score !== ""
  );
}

function doesMatchNeedUserAction(match, prediction = getCurrentUserPrediction(match?.id)) {
  if (!match) {
    return false;
  }

  const status = computeMatchStatus(match);
  if (status === "cancelled" || isFinishedMatchStatus(status)) {
    return false;
  }

  const liveWindow = getLiveWindowState(match, prediction);
  if (liveWindow.coreWindowOpen && !hasCorePrediction(prediction)) {
    return true;
  }

  if (liveWindow.scoreWindowOpen && !hasScorePrediction(prediction)) {
    return true;
  }

  return false;
}

function isCurrentMatchCandidate(match, prediction = getCurrentUserPrediction(match?.id)) {
  if (!match) {
    return false;
  }

  const status = computeMatchStatus(match);
  if (status === "completed" || status === "finalizing" || status === "cancelled") {
    return false;
  }

  const liveWindow = getLiveWindowState(match, prediction);
  return !liveWindow.scoreLocked;
}

function sortMatchesChronologically(matches = state.matches) {
  return [...matches].sort((left, right) => {
    const leftStartsAt = getMatchStartTimestamp(left);
    const rightStartsAt = getMatchStartTimestamp(right);

    if (leftStartsAt === null && rightStartsAt === null) {
      return String(left.id).localeCompare(String(right.id));
    }

    if (leftStartsAt === null) {
      return 1;
    }

    if (rightStartsAt === null) {
      return -1;
    }

    return leftStartsAt - rightStartsAt || String(left.id).localeCompare(String(right.id));
  });
}

function getCurrentActionMatch(matches = state.matches) {
  const sortedMatches = sortMatchesChronologically(matches);
  const eligibleMatches = sortedMatches.filter((match) => computeMatchStatus(match) !== "cancelled");
  if (!sortedMatches.length) {
    return null;
  }

  const now = Date.now();
  const todayMatches = eligibleMatches.filter((match) => isTodayMatch(match, now));

  if (todayMatches.length) {
    const todayNeedsAction = todayMatches.find((match) =>
      doesMatchNeedUserAction(match, getCurrentUserPrediction(match.id)),
    );
    if (todayNeedsAction) {
      return todayNeedsAction;
    }

    const todayInMotion = todayMatches.find((match) => {
      const status = computeMatchStatus(match);
      return status === "live" || status === "locked" || status === "finalizing";
    });
    if (todayInMotion) {
      return todayInMotion;
    }

    const nextTodayUpcoming = todayMatches.find((match) => {
      const startsAt = getMatchStartTimestamp(match);
      const status = computeMatchStatus(match);
      return startsAt !== null && startsAt >= now && status !== "cancelled" && !isFinishedMatchStatus(status);
    });
    if (nextTodayUpcoming) {
      return nextTodayUpcoming;
    }
  }

  const nextNeedsAction = eligibleMatches.find((match) => {
    const startsAt = getMatchStartTimestamp(match);
    return startsAt !== null && startsAt >= now && doesMatchNeedUserAction(match, getCurrentUserPrediction(match.id));
  });
  if (nextNeedsAction) {
    return nextNeedsAction;
  }

  const nextUpcoming = eligibleMatches.find((match) => {
    const startsAt = getMatchStartTimestamp(match);
    const status = computeMatchStatus(match);
    return startsAt !== null && startsAt >= now && status !== "cancelled" && !isFinishedMatchStatus(status);
  });
  if (nextUpcoming) {
    return nextUpcoming;
  }

  return (
    eligibleMatches.find((match) => ["live", "locked", "finalizing"].includes(computeMatchStatus(match)))
    || eligibleMatches[0]
    || sortedMatches[0]
    || null
  );
}

function getCurrentActionMatchId(matches = state.matches) {
  return getCurrentActionMatch(matches)?.id || null;
}

function getCurrentMatchWindowLabel(match, prediction = getCurrentUserPrediction(match?.id)) {
  const liveWindow = getLiveWindowState(match, prediction);

  if (liveWindow.coreWindowOpen) {
    return "Core picks open";
  }

  if (liveWindow.scoreWindowOpen) {
    return "Score window open";
  }

  return "Next fixture";
}

function getCurrentMatchPickState(match, prediction = getCurrentUserPrediction(match?.id)) {
  if (!prediction) {
    return "Not started";
  }

  if (hasScorePrediction(prediction) && hasCorePrediction(prediction)) {
    return "Prediction complete";
  }

  if (hasCorePrediction(prediction)) {
    return "Core saved";
  }

  if (hasScorePrediction(prediction)) {
    return "Score saved";
  }

  return "Draft started";
}

function getCurrentMatchReason(match, prediction = getCurrentUserPrediction(match?.id)) {
  const liveWindow = getLiveWindowState(match, prediction);

  if (isTodayMatch(match) && doesMatchNeedUserAction(match, prediction)) {
    return liveWindow.coreWindowOpen
      ? "This is today’s active fixture and your core picks are still open here."
      : "This is today’s active fixture and your score call is the only thing left to lock in.";
  }

  if (isTodayMatch(match) && isCurrentMatchCandidate(match, prediction)) {
    return "This is the best match to keep in front of players right now, with today’s live flow or next lock window ready.";
  }

  return "Today’s match has moved on, so the app is already pushing the next useful fixture to the top.";
}

function getCurrentMatchQueue(currentMatch = getCurrentActionMatch(), limit = 5) {
  const sortedMatches = sortMatchesChronologically(state.matches);
  const queue = [];
  const seen = new Set();
  const now = Date.now();

  function pushMatch(match) {
    if (!match?.id || seen.has(match.id)) {
      return;
    }

    seen.add(match.id);
    queue.push(match);
  }

  pushMatch(currentMatch);

  sortedMatches
    .filter((match) => {
      const status = computeMatchStatus(match);
      return isTodayMatch(match, now) && status !== "cancelled" && !isFinishedMatchStatus(status);
    })
    .forEach(pushMatch);

  sortedMatches
    .filter((match) => {
      const startsAt = getMatchStartTimestamp(match);
      const status = computeMatchStatus(match);
      return startsAt !== null && startsAt >= now && status !== "cancelled" && !isFinishedMatchStatus(status);
    })
    .forEach(pushMatch);

  sortedMatches.forEach(pushMatch);
  return queue.slice(0, limit);
}

function renderCurrentQueueRow(match, { current = false, label = "Next" } = {}) {
  const status = computeMatchStatus(match);

  return `
    <a class="mini-fixture-row ${current ? "is-current" : ""}" href="${buildRouteHref({ page: "matches", section: "centre", matchId: match.id })}">
      <div class="mini-fixture-copy">
        <div class="entry-meta">
          <span class="panel-kicker">${escapeHtml(label)}</span>
          <span class="tag tag-${status}">${escapeHtml(labelizeStatus(status))}</span>
        </div>
        <div class="mini-fixture-clash">
          <span class="mini-fixture-team">
            ${renderTeamMark(match.team_a, "xs")}
            <strong>${escapeHtml(getTeamShortCode(match.team_a))}</strong>
          </span>
          <span class="mini-fixture-divider">vs</span>
          <span class="mini-fixture-team mini-fixture-team-away">
            ${renderTeamMark(match.team_b, "xs")}
            <strong>${escapeHtml(getTeamShortCode(match.team_b))}</strong>
          </span>
        </div>
        <div class="entry-meta">
          <span class="subtle">${escapeHtml(formatFixtureDayLabel(match.starts_at))}</span>
          <span class="subtle">${escapeHtml(formatFixtureTimeLabel(match.starts_at))}</span>
        </div>
      </div>
    </a>
  `;
}

function renderSetupPanel() {
  return `
    <section class="panel" id="setup">
      <div class="section-head">
        <div>
          <h3>Hosting and setup</h3>
          <p>This version is designed to stay free for a small private friends league.</p>
        </div>
      </div>
        <div class="setup-grid">
        <div class="setup-step">
          <strong>1. Create Supabase</strong>
          <p class="subtle">Create a free project and run the SQL in <code>supabase/schema.sql</code>.</p>
        </div>
        <div class="setup-step">
          <strong>2. Add keys</strong>
          <p class="subtle">Copy your project URL and anon key into <code>app/config.js</code>.</p>
        </div>
        <div class="setup-step">
          <strong>3. Deploy static app</strong>
          <p class="subtle">Drag this folder to Vercel or connect it to GitHub for a free hosted link.</p>
        </div>
        <div class="setup-step">
          <strong>4. Share invite code</strong>
          <p class="subtle">League admin creates one league, then friends join from the shared invite code.</p>
        </div>
      </div>
      <p class="footnote">
        ${
          state.demoMode
            ? "The app is currently showing demo data because Supabase keys are not configured yet."
            : "Supabase is configured. You can sign in below and start creating your league."
        }
      </p>
      <p class="footnote">
        Once hosted, friends can open the link on mobile and use the install prompt to add it to their home screen.
      </p>
    </section>
  `;
}

function renderAccountPanel() {
  const isAuthenticated = Boolean(state.user);

  return `
    <section class="panel" id="account">
      <div class="section-head">
        <div>
          <h3>${isAuthenticated ? "Your account" : "Sign in"}</h3>
          <p>${isAuthenticated ? "Update the name your league sees and keep your identity clean across every matchday." : "Google sign-in is the fastest path. Sign in once and your leagues follow you automatically."}</p>
        </div>
      </div>
      ${
        state.demoMode
          ? `
            <div class="empty-state">
              Demo mode is enabled. Turn <code>DEMO_MODE</code> off in <code>app/config.js</code> after adding your Supabase keys.
            </div>
          `
          : isAuthenticated
            ? `
              <form class="form-grid" id="profile-form">
                <div class="field">
                  <label for="profile-display-name">Display name</label>
                  <input id="profile-display-name" name="display_name" maxlength="40" value="${escapeAttribute(
                    state.profile?.display_name || "",
                  )}" required />
                </div>
                <div class="field">
                  <label>${state.user.phone ? "Phone" : "Email"}</label>
                  <input value="${escapeAttribute(getUserIdentityLabel())}" disabled />
                </div>
                <div class="field span-2">
                  <button class="btn" type="submit">Save display name</button>
                </div>
              </form>
            `
            : `
              <div class="form-grid auth-launch-panel">
                <div class="field span-2">
                  <label>Welcome back</label>
                  <p class="subtle">Use the Google account you want attached to your leagues. Join once with the invite code and come straight back into the same season later.</p>
                </div>
                <div class="field span-2 auth-actions">
                  <button class="btn" type="button" data-action="sign-in-google">Continue with Google</button>
                </div>
              </div>
            `
      }
    </section>
  `;
}

function renderLeagueAccessPanel() {
  if (!state.user || state.demoMode) {
    return "";
  }

  return `
    <section class="panel league-access-panel">
      <div class="section-head">
        <div>
          <h3>${state.memberships.length ? "Your leagues" : "Create or join a league"}</h3>
          <p>${
            state.memberships.length
              ? "Every league you are part of stays available here, so switching seasons feels instant."
              : "Create a league room or join one with a single invite code."
          }</p>
        </div>
      </div>
      ${
        state.memberships.length
          ? `
            <div class="league-switcher">
              ${state.memberships
                .map((membership) => {
                  const active = membership.league_id === state.activeLeagueId;
                  const leagueName = membership.leagues?.name || "Joined league";
                  const leagueStatus = membership.leagues?.status === "archived" ? "Ended" : "Active";
                  return `
                    <button class="league-switcher-card ${active ? "active" : ""}" type="button" data-action="switch-league" data-league-id="${membership.league_id}">
                      <span class="league-switcher-title">${escapeHtml(leagueName)}</span>
                      <span class="league-switcher-meta">${escapeHtml(membership.role)} · ${escapeHtml(leagueStatus)}</span>
                    </button>
                  `;
                })
                .join("")}
            </div>
          `
          : ""
      }
      <div class="grid-2 league-access-grid">
        <form class="panel action-panel" id="create-league-form">
          <div class="section-head">
            <div>
              <span class="panel-kicker">Creator setup</span>
              <h4>Create league</h4>
              <p>Open the room, sync the season, and run the competition from the league hub.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="league-name">League name</label>
              <input id="league-name" name="name" placeholder="Mohit Premier Picks" required />
            </div>
            <div class="field">
              <label for="league-season">Season</label>
              <input id="league-season" name="season" value="IPL 2026" required />
            </div>
            <div class="field span-2">
              <small>You become admin instantly, get the invite code immediately, and can start the season flow right away.</small>
            </div>
            <div class="field span-2">
              <button class="btn" type="submit">Create league room</button>
            </div>
          </div>
        </form>

        <form class="panel action-panel" id="join-league-form">
          <div class="section-head">
            <div>
              <span class="panel-kicker">Player entry</span>
              <h4>Join league</h4>
              <p>Use the invite code once. After that, the league stays attached to your account.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="invite-code">Invite code</label>
              <input id="invite-code" name="invite_code" placeholder="PLAYIPL" maxlength="12" required />
            </div>
            <div class="field span-2">
              <small>Join once, then come straight back into the same league from your profile.</small>
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <button class="btn" type="submit">Join this league</button>
            </div>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderDashboard() {
  if (!state.activeLeagueId) {
    return `
      <section class="panel" id="dashboard">
        <div class="empty-state">
          ${
            state.demoMode
              ? "Demo league data loads automatically."
              : "Sign in and create or join a league to open the dashboard."
          }
        </div>
      </section>
    `;
  }

  const league = getActiveLeague();
  const match = getSelectedMatch();
  const prediction = getCurrentUserPrediction(match?.id);
  const isAdmin = currentMembership()?.role === "admin";
  const leagueWinner = getLeagueWinner();
  const leagueEnded = league?.status === "archived";
  const focusMatch = getLeagueFocusMatch();
  const completedMatchCount = getCompletedMatchCount();

  return `
    <section class="stack" id="dashboard">
      <section class="panel league-overview-panel">
        <div class="league-overview-shell">
          <div class="league-overview-copy">
            <span class="panel-kicker">${leagueEnded ? "Season wrapped" : "League command centre"}</span>
            <h3>${escapeHtml(league?.name || "League dashboard")}</h3>
            <p>${
              leagueEnded
                ? `${escapeHtml(league?.season || "")} is complete. The winner is locked in and the room now serves as the final archive.`
                : `Invite your people once, run the full IPL slate from here, and let the app manage locks, squads, and scores in the background.`
            }</p>
            <div class="league-highlight-row">
              <span class="chip"><strong>Status</strong>${leagueEnded ? "Ended" : "Active"}</span>
              <span class="chip"><strong>Your role</strong>${isAdmin ? "Admin" : "Member"}</span>
              <span class="chip"><strong>Season</strong>${escapeHtml(league?.season || "IPL 2026")}</span>
              ${
                leagueEnded
                  ? ""
                  : `<span class="chip"><strong>Invite code</strong>${escapeHtml(league?.invite_code || "-")}</span>`
              }
            </div>
          </div>
          <div class="league-overview-actions">
            ${
              !leagueEnded
                ? `<button class="ghost-btn" type="button" data-action="copy-invite-code" data-invite-code="${escapeAttribute(league?.invite_code || "")}">Copy invite code</button>`
                : ""
            }
            ${
              leagueEnded
                ? `<span class="tag tag-completed">Ended</span>`
                : ""
            }
            ${
              isAdmin && !leagueEnded
                ? `<button class="ghost-btn" type="button" data-action="end-league" data-league-id="${league?.id}" ${
                    state.endingLeagueId === league?.id ? "disabled" : ""
                  }>${state.endingLeagueId === league?.id ? "Ending league..." : "End league"}</button>`
                : ""
            }
            <button class="ghost-btn" type="button" data-action="refresh-league">Refresh board</button>
          </div>
        </div>
        <div class="metric-grid">
          <div class="stat-card">
            <span>Members</span>
            <strong>${state.members.length}</strong>
          </div>
          <div class="stat-card">
            <span>Matches</span>
            <strong>${state.matches.length}</strong>
          </div>
          <div class="stat-card">
            <span>Your points</span>
            <strong>${getCurrentUserPoints()}</strong>
          </div>
          <div class="stat-card">
            <span>Completed matches</span>
            <strong>${completedMatchCount}</strong>
          </div>
        </div>
        <div class="league-callouts">
          <div class="mini-panel spotlight-panel">
            <span class="panel-kicker">${leagueEnded ? "Champion" : "League leader"}</span>
            <strong>${escapeHtml(leagueWinner?.display_name || "Waiting for the first result")}</strong>
            <p>${leagueWinner ? `${escapeHtml(leagueWinner.total_points)} points so far.` : "The board takes shape as soon as scored matches start to land."}</p>
          </div>
          <div class="mini-panel spotlight-panel">
            <span class="panel-kicker">${focusMatch ? "Focus match" : "Next match"}</span>
            <strong>${escapeHtml(focusMatch?.title || "Sync the season to load fixtures")}</strong>
            <p>${focusMatch ? `${escapeHtml(formatDate(focusMatch.starts_at))} · ${escapeHtml(labelizeStatus(computeMatchStatus(focusMatch)))}` : "Once fixtures are synced, each match becomes a single-click room for picks and score calls."}</p>
          </div>
        </div>
      </section>

      <section class="grid-3">
        <div class="panel">
          <div class="section-head">
            <div>
              <h3>Matches</h3>
              <p>Every IPL fixture for this league appears here once the season schedule is synced.</p>
            </div>
          </div>
          ${
            state.matches.length
              ? `<div class="match-list">${state.matches
                  .map((item) => renderMatchCard(item))
                  .join("")}</div>`
              : `<div class="empty-state">No matches yet. ${
                  isAdmin ? "Sync the IPL schedule below to load the full season." : "Ask your admin to sync the IPL schedule."
                }</div>`
          }
        </div>

        <div class="stack">
          ${
            match
              ? `
                ${renderMatchDetail(match, prediction, isAdmin, leagueEnded)}
              `
              : `<section class="panel"><div class="empty-state">${
                  isAdmin
                    ? "No matches yet. Sync the IPL schedule below."
                    : "Choose a match to start."
                }</div></section>`
          }
          ${isAdmin && !leagueEnded ? renderAdminTools(match) : ""}
        </div>

        <div class="stack">
          <section class="panel">
            <div class="section-head">
              <div>
                <h3>Leaderboard</h3>
                <p>Season standings across all completed matches.</p>
              </div>
            </div>
            ${
              state.leaderboard.length
                ? `<div class="leaderboard-list">${state.leaderboard
                    .map((entry, index) => renderLeaderboardRow(entry, index))
                    .join("")}</div>`
                : `<div class="empty-state">Points appear after the first scored match.</div>`
            }
          </section>

          <section class="panel">
            <div class="section-head">
              <div>
                <h3>Players</h3>
                <p>Everyone active in the league right now.</p>
              </div>
            </div>
            <div class="member-list">
              ${state.members
                .map(
                  (member) => `
                    <div class="member-item">
                      <div>
                        <strong>${escapeHtml(member.display_name)}</strong>
                        <span class="subtle">Joined ${escapeHtml(formatDate(member.joined_at, "date"))}</span>
                      </div>
                      <span class="tag ${member.role === "admin" ? "tag-admin" : "tag-member"}">${escapeHtml(member.role)}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>
        </div>
      </section>
    </section>
  `;
}

function renderMatchCard(match) {
  const matchResult = getMatchResult(match);
  const status = computeMatchStatus(match);
  const active = match.id === getSelectedMatch()?.id;
  const entries = getPredictionsForMatch(match.id);
  const myPrediction = getCurrentUserPrediction(match.id);
  const liveWindow = getLiveWindowState(match, getCurrentUserPrediction(match.id));
  const availabilityLabel = liveWindow.coreWindowOpen
    ? "Player picks open"
    : liveWindow.scoreWindowOpen
      ? "Score phase open"
      : status === "finalizing"
        ? "Result finalizing"
      : matchResult
        ? "Scored"
        : "Locked";
  const userStateLabel = myPrediction
    ? myPrediction.score_submitted_at
      ? "Ready"
      : myPrediction.core_submitted_at
        ? "Core saved"
        : "Started"
    : "No pick";

  return `
    <button class="match-card ${active ? "active" : ""}" type="button" data-action="select-match" data-match-id="${match.id}">
      <div class="match-card-glow"></div>
      <div class="match-card-head">
        <span class="tag tag-${status}">${labelizeStatus(status)}</span>
        <span class="subtle">${escapeHtml(formatDate(match.starts_at))}</span>
      </div>
      <h4>${escapeHtml(match.title || `${match.team_a} vs ${match.team_b}`)}</h4>
      <div class="fixture-teams">
        <div class="team-token">
          ${renderTeamMark(match.team_a, "md")}
          <div class="team-token-meta">
            <strong>${escapeHtml(match.team_a)}</strong>
            <span>${escapeHtml(getTeamShortCode(match.team_a))}</span>
          </div>
        </div>
        <span class="versus-dot">VS</span>
        <div class="team-token team-token-away">
          ${renderTeamMark(match.team_b, "md")}
          <div class="team-token-meta">
            <strong>${escapeHtml(match.team_b)}</strong>
            <span>${escapeHtml(getTeamShortCode(match.team_b))}</span>
          </div>
        </div>
      </div>
      <div class="match-card-meta">
        <span class="chip"><strong>Venue</strong>${escapeHtml(match.venue || "Venue TBD")}</span>
        <span class="chip"><strong>Window</strong>${escapeHtml(availabilityLabel)}</span>
      </div>
      <div class="match-card-footer">
        <span class="chip"><strong>${entries.length}</strong>Picks posted</span>
        <span class="chip"><strong>You</strong>${escapeHtml(userStateLabel)}</span>
      </div>
    </button>
  `;
}

function renderMatchDetail(match, prediction, isAdmin, leagueEnded = false) {
  const status = computeMatchStatus(match);
  const entries = getPredictionsForMatch(match.id);
  const editablePrediction = getEditablePrediction(match.id, prediction);
  const liveWindow = getLiveWindowState(match, prediction);
  const scoreResult = getMatchResult(match);
  const squadGroups = getPlayingXiGroups(match);
  const hasSquad = squadGroups.some((group) => group.players.length);
  const squadsLoading = isOfficialTeamSquadLoading(match);
  const batsmanOptions = getSelectablePlayers(match, "batsman", editablePrediction);
  const bowlerOptions = getSelectablePlayers(match, "bowler", editablePrediction);
  const syncSummary = getMatchSyncSummary(match);
  const canEditCore = !leagueEnded && liveWindow.coreWindowOpen;
  const canEditScore = !leagueEnded && liveWindow.scoreWindowOpen;
  const windowMessage = leagueEnded
    ? "This league has ended. Picks stay visible, but no more changes can be made."
    : status === "finalizing"
      ? "This match has finished on the field. Official scoring is still finalizing, so picks stay read-only while points land."
    : liveWindow.coreWindowOpen
      ? "Choose one batsman, one bowler, and one winning team before 3.1 overs. Score unlocks right after that."
      : liveWindow.scoreWindowOpen
        ? "Player picks are locked. Exact first-innings score is open until 7.1 overs."
        : "All standard prediction windows are locked for this match.";
  const predictionMessage = windowMessage;
  const coreButtonLabel = leagueEnded
    ? "League ended"
    : !hasSquad
    ? squadsLoading
      ? "Loading official team squads"
      : "Waiting for official team squads"
    : canEditCore
      ? "Save player picks"
      : "Player picks locked";
  const scoreButtonLabel = leagueEnded
    ? "League ended"
    : canEditScore
    ? "Save score prediction"
    : liveWindow.scoreLocked
      ? "Score locked"
      : "Score opens after 3.1 overs";
  const activePanel = getActiveMatchCentrePanel(Boolean(scoreResult));
  const actionLabel = prediction
    ? "Update your prediction"
    : editablePrediction
      ? "Continue your prediction"
      : "Make your prediction";
  const userStateLabel = prediction
    ? prediction.score_submitted_at
      ? "Prediction complete"
      : prediction.core_submitted_at
        ? "Core saved"
        : "Started"
    : "Waiting for your entry";

  return `
    <section class="arena-panel match-command-shell">
      <section class="panel match-command-hero">
        <div class="match-command-hero-main">
          <div class="match-command-hero-top">
            <span class="tag tag-${status}">${labelizeStatus(status)}</span>
            <span class="subtle">${escapeHtml(formatDate(match.starts_at))}</span>
          </div>
          <div class="match-command-clash">
            <div class="match-command-team">
              ${renderTeamMark(match.team_a, "hero")}
              <div>
                <span class="panel-kicker">Home</span>
                <strong>${escapeHtml(match.team_a)}</strong>
                <span class="subtle">${escapeHtml(getTeamShortCode(match.team_a))}</span>
              </div>
            </div>
            <div class="match-command-versus">VS</div>
            <div class="match-command-team match-command-team-away">
              ${renderTeamMark(match.team_b, "hero")}
              <div>
                <span class="panel-kicker">Away</span>
                <strong>${escapeHtml(match.team_b)}</strong>
                <span class="subtle">${escapeHtml(getTeamShortCode(match.team_b))}</span>
              </div>
            </div>
          </div>
          ${renderMatchCentreQuickNav(match, isAdmin, Boolean(scoreResult))}
        </div>
        <aside class="match-command-status-card">
          <span class="panel-kicker">Your state</span>
          <strong>${escapeHtml(userStateLabel)}</strong>
          <p>${escapeHtml(predictionMessage)}</p>
          <div class="match-command-status-actions">
            <button class="btn" type="button" data-action="jump-match-panel" data-panel-id="prediction-panel">${escapeHtml(actionLabel)}</button>
            ${
              isAdmin
                ? `<button class="ghost-btn" type="button" data-action="sync-selected-match" data-match-id="${match.id}" ${
                    state.syncingMatchIds.has(match.id) ? "disabled" : ""
                  }>${state.syncingMatchIds.has(match.id) ? "Syncing..." : "Sync now"}</button>`
                : ""
            }
          </div>
          <div class="match-command-state-strip">
            <div class="match-command-state-pill ${canEditCore ? "is-live" : liveWindow.coreLocked ? "is-locked" : ""}">
              <span>Core picks</span>
              <strong>${canEditCore ? "Open" : liveWindow.coreLocked ? "Locked" : "Waiting"}</strong>
            </div>
            <div class="match-command-state-pill ${canEditScore ? "is-live" : liveWindow.scoreLocked ? "is-locked" : ""}">
              <span>Score call</span>
              <strong>${canEditScore ? "Open" : liveWindow.scoreLocked ? "Locked" : "Waiting"}</strong>
            </div>
            <div class="match-command-state-pill ${syncSummary.settlementTone === "fresh" ? "is-live" : syncSummary.settlementTone === "finalizing" ? "is-warning" : ""}">
              <span>Result</span>
              <strong>${escapeHtml(syncSummary.settlementLabel)}</strong>
            </div>
          </div>
        </aside>
      </section>

      ${
        match.notes
          ? `<p class="footnote arena-note">${escapeHtml(match.notes)}</p>`
          : ""
      }
      ${
        match.sync_error
          ? `<div class="notice notice-error">${escapeHtml(match.sync_error)}</div>`
          : ""
      }
      ${renderMatchStateNotice(match, syncSummary, isAdmin)}

      <section class="match-command-layout" data-active-panel="${escapeAttribute(activePanel)}">
        <aside class="panel entry-shell prediction-dock match-centre-panel panel-group-prediction" id="prediction-panel">
          <div class="section-head">
            <div>
              <span class="panel-kicker">Your entry</span>
              <h4>Prediction dock</h4>
              <p>${predictionMessage}</p>
            </div>
          </div>
          ${
            state.demoMode
              ? `<div class="notice notice-info">Demo mode is read-only. Configure Supabase to save real entries.</div>`
              : !state.user
                ? `<div class="empty-state">Sign in to submit picks.</div>`
                : `
                  <div class="entry-stage-card">
                    <div class="entry-stage-head">
                      <div>
                        <span class="panel-kicker">Phase one</span>
                        <h5>Player picks + winner</h5>
                      </div>
                      <span class="tag ${canEditCore ? "tag-live" : "tag-locked"}">${canEditCore ? "Open" : "Locked"}</span>
                    </div>
                    <form class="form-grid" id="core-prediction-form">
                      <input type="hidden" name="match_id" value="${match.id}" />
                      ${renderPredictionPlayerInput({
                        match,
                        fieldId: `batsman-name-${match.id}`,
                        fieldName: "batsman_name",
                        label: "Batsman",
                        placeholder: "Choose your batsman",
                        groups: batsmanOptions,
                        selectedValue: editablePrediction?.batsman_name || "",
                        disabled: !canEditCore || !hasSquad,
                        helperText: `${getSelectablePlayerCount(batsmanOptions)} official batting options`,
                      })}
                      ${renderPredictionPlayerInput({
                        match,
                        fieldId: `bowler-name-${match.id}`,
                        fieldName: "bowler_name",
                        label: "Bowler",
                        placeholder: "Choose your bowler",
                        groups: bowlerOptions,
                        selectedValue: editablePrediction?.bowler_name || "",
                        disabled: !canEditCore || !hasSquad,
                        helperText: `${getSelectablePlayerCount(bowlerOptions)} official bowling options`,
                      })}
                      <div class="field span-2">
                        <label for="team-pick">Winning team</label>
                        <select id="team-pick" name="team_pick" ${!canEditCore ? "disabled" : ""}>
                          <option value="">Choose a winner</option>
                          <option value="${escapeAttribute(match.team_a)}" ${
                            editablePrediction?.team_pick === match.team_a ? "selected" : ""
                          }>${escapeHtml(match.team_a)}</option>
                          <option value="${escapeAttribute(match.team_b)}" ${
                            editablePrediction?.team_pick === match.team_b ? "selected" : ""
                          }>${escapeHtml(match.team_b)}</option>
                        </select>
                      </div>
                      <div class="field span-2">
                        <small>
                          ${
                            hasSquad
                              ? "Pick from the official IPL squads. Batters and all-rounders count for batsman, bowlers and all-rounders count for bowler."
                              : squadsLoading
                                ? "Official squads are loading. The dropdowns will unlock as soon as those rosters arrive."
                                : "Official IPL team squads are not available yet for this fixture."
                          }
                        </small>
                      </div>
                      <div class="field span-2">
                        <button class="btn" type="submit" ${!canEditCore || !hasSquad ? "disabled" : ""}>${coreButtonLabel}</button>
                      </div>
                    </form>
                  </div>
                  <div class="entry-stage-card score-stage-card">
                    <div class="entry-stage-head">
                      <div>
                        <span class="panel-kicker">Phase two</span>
                        <h5>1st innings total</h5>
                      </div>
                      <span class="tag ${canEditScore ? "tag-live" : liveWindow.scoreLocked ? "tag-locked" : "tag-scheduled"}">${
                        canEditScore ? "Open" : liveWindow.scoreLocked ? "Locked" : "Waiting"
                      }</span>
                    </div>
                    <form class="form-grid" id="score-prediction-form">
                      <input type="hidden" name="match_id" value="${match.id}" />
                      <div class="field span-2">
                        <label for="predicted-score">1st innings total</label>
                        <input
                          id="predicted-score"
                          type="text"
                          name="predicted_score"
                          inputmode="numeric"
                          pattern="[0-9]*"
                          maxlength="3"
                          placeholder="182"
                          value="${escapeAttribute(editablePrediction?.predicted_score ?? "")}"
                          ${!canEditScore ? "disabled" : ""}
                        />
                      </div>
                      <div class="field span-2">
                        <small>
                          Exact score prediction opens after 3.1 overs and locks at 7.1 overs. If nobody is exact, the nearest score wins, and tied nearest picks split the 10 points.
                        </small>
                      </div>
                      <div class="field span-2">
                        <button class="ghost-btn" type="submit" ${!canEditScore ? "disabled" : ""}>${scoreButtonLabel}</button>
                      </div>
                    </form>
                  </div>
                `
          }
          ${renderPredictionSnapshot(match, editablePrediction)}
        </aside>

        <div class="match-content-stack">
          <section class="panel prediction-board match-centre-panel panel-group-picks" id="picks-board-panel">
            <div class="section-head">
              <div>
                <span class="panel-kicker">Shared board</span>
                <h4>Who picked whom</h4>
                <p>Everyone can see the claimed batsman, bowler, winner, and score call here with player images when official squad data is available.</p>
              </div>
            </div>
            ${
              entries.length
                ? `<div class="entry-list">${entries.map((entry) => renderPredictionRow(entry)).join("")}</div>`
                : `<div class="empty-state">No one has posted yet.</div>`
            }
          </section>

          <div class="grid-2 roster-engine-grid">
            <section class="panel roster-panel match-centre-panel panel-group-squads" id="squad-panel">
              <div class="section-head">
                <div>
                  <span class="panel-kicker">Selection pool</span>
                  <h4>Official squads</h4>
                  <p>${hasSquad ? "Player picks use the official IPL squads. Final points still come only from the match scorecard." : squadsLoading ? "Official IPL team rosters are loading now." : "Official IPL team rosters are not available yet for this fixture."}</p>
                </div>
              </div>
              ${
                hasSquad
                  ? `<div class="roster-grid">${squadGroups
                      .map(
                        (group) => `
                          <div class="team-block roster-card">
                            <div class="roster-card-head">
                              ${renderTeamMark(group.teamName, "sm")}
                              <strong>${escapeHtml(group.teamName)}</strong>
                            </div>
                            <div class="chip-list roster-chip-list">
                              ${group.players
                                .map(
                                  (player) => `
                                    <span class="chip roster-pill">
                                      ${renderPlayerAvatar(match, player.name, { size: "xs", teamName: group.teamName })}
                                      ${escapeHtml(player.name)}
                                    </span>
                                  `,
                                )
                                .join("")}
                            </div>
                          </div>
                        `,
                      )
                      .join("")}</div>`
                  : `<div class="empty-state">${squadsLoading ? "Fetching the official IPL squads for these two teams." : "Once the official IPL team rosters are available, the player dropdowns will fill automatically."}</div>`
              }
            </section>

          </div>

          ${
            scoreResult
              ? `
                <section class="panel result-ribbon match-centre-panel panel-group-result" id="result-panel">
                  <div class="section-head">
                    <div>
                      <span class="panel-kicker">Result archive</span>
                      <h4>Scored result</h4>
                      <p>Points have been calculated automatically for this match.</p>
                    </div>
                  </div>
                  <div class="chip-list">
                    <span class="chip"><strong>Winner</strong>${escapeHtml(scoreResult.winner_team)}</span>
                    <span class="chip"><strong>1st innings total</strong>${escapeHtml(scoreResult.first_innings_total)}</span>
                    <span class="chip"><strong>Tracked batsmen</strong>${Object.keys(scoreResult.batsman_runs || {}).length}</span>
                    <span class="chip"><strong>Tracked bowlers</strong>${Object.keys(scoreResult.bowler_wickets || {}).length}</span>
                  </div>
                  ${
                    scoreResult.notes
                      ? `<p class="footnote">${escapeHtml(scoreResult.notes)}</p>`
                      : ""
                  }
                </section>
              `
              : !isAdmin
                ? `<div class="notice notice-info">This match will settle automatically once the completed scorecard arrives.</div>`
                : ""
          }
        </div>
      </section>
    </section>
  `;
}

function renderPredictionRow(entry) {
  const sameUser = entry.user_id === state.user?.id;
  const match = state.matches.find((item) => item.id === entry.match_id) || getSelectedMatch();
  const ownerName = entry.league_members?.display_name || "Player";
  const ownerAvatarUrl =
    getMemberRecord(entry.user_id)?.avatar_url ||
    (sameUser ? state.profile?.avatar_url || getUserAvatarUrl(state.user) : "");
  const coreStamp = entry.core_submitted_at ? `Core ${formatDate(entry.core_submitted_at)}` : "Core pending";
  const scoreStamp = entry.score_submitted_at ? `Score ${formatDate(entry.score_submitted_at)}` : "Score pending";

  return `
    <div class="entry-item prediction-row ${sameUser ? "current-user" : ""}">
      <div class="prediction-row-header">
        <div class="prediction-owner">
          ${renderMemberAvatar(ownerName, "sm", "", ownerAvatarUrl)}
          <div class="identity-copy">
            <div class="prediction-row-head">
              <strong>${escapeHtml(ownerName)}</strong>
              ${sameUser ? `<span class="tag tag-member">You</span>` : ""}
            </div>
            <div class="prediction-owner-meta">
              <span class="subtle">${escapeHtml(coreStamp)}</span>
              <span class="subtle">${escapeHtml(scoreStamp)}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="prediction-call-grid">
        <div class="prediction-call-card prediction-call-card-player">
          ${renderPlayerAvatar(match, entry.batsman_name, { size: "sm" })}
          <div class="identity-copy">
            <span class="subtle">Batsman</span>
            <strong>${escapeHtml(entry.batsman_name || "-")}</strong>
          </div>
        </div>
        <div class="prediction-call-card prediction-call-card-player">
          ${renderPlayerAvatar(match, entry.bowler_name, { size: "sm" })}
          <div class="identity-copy">
            <span class="subtle">Bowler</span>
            <strong>${escapeHtml(entry.bowler_name || "-")}</strong>
          </div>
        </div>
        <div class="prediction-call-card prediction-call-card-team">
          ${entry.team_pick ? renderTeamMark(entry.team_pick, "xs") : ""}
          <div class="identity-copy">
            <span class="subtle">Winner</span>
            <strong>${escapeHtml(entry.team_pick || "-")}</strong>
          </div>
        </div>
        <div class="prediction-call-card prediction-call-card-score">
          <span class="subtle">Score call</span>
          <strong>${escapeHtml(entry.predicted_score ?? "-")}</strong>
        </div>
      </div>
    </div>
  `;
}

function getPredictionScorecardMatch() {
  if (!state.predictionScorecardMatchId) {
    return null;
  }

  return state.matches.find((match) => match.id === state.predictionScorecardMatchId) || null;
}

function getMatchPredictionScoreRows(match) {
  const result = getMatchResult(match);
  if (!match || !result) {
    return [];
  }

  const matchPredictions = getPredictionsForMatch(match.id);

  return state.members
    .map((member) => {
      const prediction = getMemberPrediction(match.id, member.user_id);
      const batsmanPoints =
        prediction && prediction.batsman_name
          ? getPlayerStatValue(result.batsman_runs, prediction.batsman_name, match)
          : 0;
      const bowlerPoints =
        prediction && prediction.bowler_name
          ? getPlayerStatValue(result.bowler_wickets, prediction.bowler_name, match) * 20
          : 0;
      const teamPoints =
        prediction && prediction.team_pick && result.winner_team === prediction.team_pick ? 50 : 0;
      const scorePoints = prediction
        ? calculateScorePointsForPrediction(prediction, result, matchPredictions)
        : 0;
      const totalPoints = batsmanPoints + bowlerPoints + teamPoints + scorePoints;

      return {
        member,
        prediction,
        batsmanPoints,
        bowlerPoints,
        teamPoints,
        scorePoints,
        totalPoints,
        isCurrentUser: member.user_id === state.user?.id,
      };
    })
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (Boolean(right.prediction) !== Boolean(left.prediction)) {
        return Number(Boolean(right.prediction)) - Number(Boolean(left.prediction));
      }

      return left.member.display_name.localeCompare(right.member.display_name);
    });
}

function renderPredictionScorecardPick(label, content, extraClass = "") {
  return `
    <div class="prediction-scorecard-pick ${extraClass}">
      <span class="subtle">${escapeHtml(label)}</span>
      ${content}
    </div>
  `;
}

function renderPredictionScorecardDialog() {
  const match = getPredictionScorecardMatch();
  const result = getMatchResult(match);
  if (!match || !result) {
    return "";
  }

  const rows = getMatchPredictionScoreRows(match);
  const entriesPosted = rows.filter((row) => row.prediction).length;

  return `
    <div class="dialog-layer" aria-hidden="false">
      <div class="dialog-backdrop" data-action="close-prediction-scorecard"></div>
      <section
        class="dialog-card prediction-scorecard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prediction-scorecard-title"
      >
        <div class="dialog-head">
          <div>
            <span class="panel-kicker">Prediction scorecard</span>
            <h3 id="prediction-scorecard-title">${escapeHtml(match.title || `${match.team_a} vs ${match.team_b}`)}</h3>
            <p>Match-wise prediction points after settlement. This popup shows league member scores for this fixture only.</p>
          </div>
          <button
            class="dialog-close"
            type="button"
            data-action="close-prediction-scorecard"
            aria-label="Close prediction scorecard"
          >
            ×
          </button>
        </div>

        <div class="chip-list prediction-scorecard-summary">
          <span class="chip"><strong>Winner</strong>${escapeHtml(result.winner_team || "-")}</span>
          <span class="chip"><strong>1st innings</strong>${escapeHtml(result.first_innings_total ?? "-")}</span>
          <span class="chip"><strong>Entries</strong>${escapeHtml(entriesPosted)}</span>
          <span class="chip"><strong>Venue</strong>${escapeHtml(match.venue || "Venue TBD")}</span>
        </div>

        <div class="prediction-scorecard-list">
          ${rows
            .map((row, index) => {
              const ownerName = row.member.display_name || "Player";
              const prediction = row.prediction;
              const ownerAvatarUrl =
                row.member.avatar_url ||
                (row.isCurrentUser ? state.profile?.avatar_url || getUserAvatarUrl(state.user) : "");

              const batsmanContent = prediction?.batsman_name
                ? `
                    ${renderPlayerAvatar(match, prediction.batsman_name, { size: "sm" })}
                    <strong>${escapeHtml(prediction.batsman_name)}</strong>
                  `
                : `<strong class="subtle">No pick</strong>`;
              const bowlerContent = prediction?.bowler_name
                ? `
                    ${renderPlayerAvatar(match, prediction.bowler_name, { size: "sm" })}
                    <strong>${escapeHtml(prediction.bowler_name)}</strong>
                  `
                : `<strong class="subtle">No pick</strong>`;
              const teamContent = prediction?.team_pick
                ? `
                    ${renderTeamMark(prediction.team_pick, "xs")}
                    <strong>${escapeHtml(prediction.team_pick)}</strong>
                  `
                : `<strong class="subtle">No pick</strong>`;
              const scoreContent =
                prediction?.predicted_score !== null && prediction?.predicted_score !== undefined
                  ? `<strong>${escapeHtml(prediction.predicted_score)}</strong>`
                  : `<strong class="subtle">No score</strong>`;

              return `
                <article class="prediction-scorecard-row ${row.isCurrentUser ? "current-user" : ""}">
                  <div class="prediction-scorecard-rank">${escapeHtml(index + 1)}</div>
                  <div class="prediction-scorecard-member">
                    ${renderMemberAvatar(ownerName, "sm", "", ownerAvatarUrl)}
                    <div class="identity-copy">
                      <div class="prediction-row-head">
                        <strong>${escapeHtml(ownerName)}</strong>
                        ${row.isCurrentUser ? `<span class="tag tag-member">You</span>` : ""}
                      </div>
                      <span class="subtle">${
                        prediction
                          ? escapeHtml(
                              prediction.score_submitted_at
                                ? `Score ${formatDate(prediction.score_submitted_at)}`
                                : prediction.core_submitted_at
                                  ? `Core ${formatDate(prediction.core_submitted_at)}`
                                  : "Prediction saved",
                            )
                          : "No prediction submitted"
                      }</span>
                    </div>
                  </div>
                  <div class="prediction-scorecard-picks">
                    ${renderPredictionScorecardPick("Batsman", batsmanContent, prediction?.batsman_name ? "" : "is-empty")}
                    ${renderPredictionScorecardPick("Bowler", bowlerContent, prediction?.bowler_name ? "" : "is-empty")}
                    ${renderPredictionScorecardPick("Winner", teamContent, prediction?.team_pick ? "" : "is-empty")}
                    ${renderPredictionScorecardPick("Score", scoreContent, prediction?.predicted_score !== null && prediction?.predicted_score !== undefined ? "" : "is-empty")}
                  </div>
                  <div class="prediction-scorecard-breakdown">
                    <span class="score-breakdown-pill"><strong>Bat</strong>${escapeHtml(row.batsmanPoints)}</span>
                    <span class="score-breakdown-pill"><strong>Bowl</strong>${escapeHtml(row.bowlerPoints)}</span>
                    <span class="score-breakdown-pill"><strong>Team</strong>${escapeHtml(row.teamPoints)}</span>
                    <span class="score-breakdown-pill"><strong>Score</strong>${escapeHtml(row.scorePoints)}</span>
                  </div>
                  <div class="prediction-scorecard-total">
                    <span>Total</span>
                    <strong>${escapeHtml(row.totalPoints)}</strong>
                    <small>pts</small>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function renderAdminTools(match) {
  const selectedSummary = match ? getMatchSyncSummary(match) : null;
  const scheduleYear = getTargetSeasonYear();
  const liveWindow = match ? getLiveWindowState(match, getCurrentUserPrediction(match.id)) : null;
  const matchResult = match ? getMatchResult(match) : null;
  const selectedMatchStatus = match ? computeMatchStatus(match) : null;
  const recoveryEntries = match ? getAdminRecoveryEntries(match.id) : [];
  const recoveryMissingCount = recoveryEntries.filter((entry) => !entry.hasCore).length;
  const recoveryScoreOnlyCount = recoveryEntries.filter(
    (entry) => !entry.hasCore && entry.hasScore,
  ).length;
  const defaultRecoveryEntry =
    recoveryEntries.find((entry) => !entry.hasCore) || recoveryEntries[0] || null;
  const recoveryBatsmanOptions = match
    ? getSelectablePlayers(match, "batsman", defaultRecoveryEntry?.prediction || null)
    : [];
  const recoveryBowlerOptions = match
    ? getSelectablePlayers(match, "bowler", defaultRecoveryEntry?.prediction || null)
    : [];
  const recoveryBatsmanListId = match ? `admin-recovery-batsmen-${match.id}` : "";
  const recoveryBowlerListId = match ? `admin-recovery-bowlers-${match.id}` : "";
  const defaultAdjustmentMember = state.leaderboard[0] || state.members[0] || null;
  const pollingIntervalMs = Number(APP_CONFIG.AUTO_SYNC_INTERVAL_MS) || 90 * 1000;
  const pollingLabel =
    pollingIntervalMs >= 60 * 1000
      ? `${Math.round(pollingIntervalMs / 60000)} min`
      : `${Math.round(pollingIntervalMs / 1000)} sec`;

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <span class="panel-kicker">Creator console</span>
          <h3>Admin tools</h3>
          <p>Use this space to sync the season, correct live timing, and recover gracefully if a feed misbehaves.</p>
        </div>
      </div>
      <div class="stack">
        <div class="admin-card">
          <div class="section-head">
            <div>
              <h4>IPL schedule sync</h4>
              <p>Pull the full IPL ${escapeHtml(scheduleYear)} fixture list into this league so every match is visible from day one.</p>
            </div>
          </div>
          <div class="chip-list">
            <span class="chip"><strong>Fixtures</strong>Official IPL</span>
            <span class="chip"><strong>Live data</strong>Official IPL feeds</span>
            <span class="chip"><strong>League</strong>IPL</span>
            <span class="chip"><strong>Season</strong>${escapeHtml(scheduleYear)}</span>
            <span class="chip"><strong>Matches in league</strong>${state.matches.length}</span>
            <span class="chip"><strong>Polling</strong>${escapeHtml(pollingLabel)}</span>
          </div>
          <div class="split-line" style="margin-top: 1rem;">
            <button class="btn" type="button" data-action="load-provider-fixtures" ${state.loadingProviderFixtures ? "disabled" : ""}>
              ${state.loadingProviderFixtures ? "Syncing schedule..." : "Sync IPL schedule"}
            </button>
            <span class="subtle">This creates or updates every IPL fixture for the selected league.</span>
          </div>
        </div>
        ${
          match
            ? `
              <div class="admin-card">
                <div class="section-head">
                  <div>
                    <h4>Selected match sync</h4>
                    <p>${match.external_match_id ? "Refresh this match now, or let auto sync keep the squads, innings clock, and results updated." : "This match is not linked to the live provider yet. Sync the full schedule first."}</p>
                  </div>
                </div>
                ${
                  match.external_match_id
                    ? `
                      <div class="chip-list">
                        <span class="chip"><strong>Provider ID</strong>${escapeHtml(match.external_match_id)}</span>
                        <span class="chip"><strong>Auto sync</strong>${match.auto_sync_enabled ? "On" : "Off"}</span>
                        <span class="chip"><strong>Squads</strong>${escapeHtml(selectedSummary?.playingXiLabel || "Waiting")}</span>
                        <span class="chip"><strong>Last sync</strong>${escapeHtml(selectedSummary?.lastSynced || "Never")}</span>
                      </div>
                      <div class="split-line" style="margin-top: 1rem;">
                        <button class="btn" type="button" data-action="sync-selected-match" data-match-id="${match.id}" ${
                          state.syncingMatchIds.has(match.id) || selectedMatchStatus === "cancelled" ? "disabled" : ""
                        }>${state.syncingMatchIds.has(match.id) ? "Syncing..." : "Sync now"}</button>
                        <button class="ghost-btn" type="button" data-action="toggle-auto-sync" data-match-id="${match.id}" ${
                          selectedMatchStatus === "cancelled" ? "disabled" : ""
                        }>
                          ${match.auto_sync_enabled ? "Pause auto sync" : "Resume auto sync"}
                        </button>
                        <button class="ghost-btn" type="button" data-action="calculate-match-points" data-match-id="${match.id}" ${
                          state.settlingMatchIds.has(match.id) || !isFinishedMatchStatus(selectedMatchStatus) || selectedMatchStatus === "cancelled"
                            ? "disabled"
                            : ""
                        }>${
                          state.settlingMatchIds.has(match.id)
                            ? "Calculating..."
                            : matchResult
                              ? "Recalculate points"
                              : "Calculate points now"
                        }</button>
                      </div>
                      ${
                        selectedMatchStatus === "cancelled"
                          ? `<span class="subtle">This fixture is cancelled. Sync and settlement are disabled, and the leaderboard ignores it entirely.</span>`
                          : ""
                      }
                      ${
                        isFinishedMatchStatus(selectedMatchStatus)
                          ? `<span class="subtle">Use this if the match has finished but the leaderboard has not updated yet. It re-runs point allocation from the official IPL scorecard.</span>`
                          : ""
                      }
                      ${
                        match.sync_error
                          ? `<div class="notice notice-error" style="margin-top: 1rem;">${escapeHtml(match.sync_error)}</div>`
                          : ""
                      }
                    `
                    : `<div class="empty-state">No provider link yet. Sync the league schedule first, then this match will gain live data automatically.</div>`
                }
              </div>
              <div class="admin-card">
                <div class="section-head">
                  <div>
                    <h4>Set leaderboard total</h4>
                    <p>Choose the member, type the final total you want them to have, and save. The app handles the correction behind the scenes.</p>
                  </div>
                </div>
                <div class="chip-list">
                  <span class="chip"><strong>Scope</strong>League total</span>
                  <span class="chip"><strong>Action</strong>Set final score</span>
                  <span class="chip"><strong>Saved in DB</strong>Yes</span>
                </div>
                <form class="form-grid" id="leaderboard-adjustment-form">
                  <input type="hidden" name="league_id" value="${match?.league_id || state.activeLeagueId || ""}" />
                  <div class="field span-2">
                    <label for="leaderboard-adjustment-member">Member</label>
                    <select id="leaderboard-adjustment-member" name="target_user_id">
                      <option value="">Choose member</option>
                      ${renderLeaderboardAdjustmentMemberOptions(defaultAdjustmentMember?.user_id || "")}
                    </select>
                  </div>
                  <div class="field span-2">
                    <label for="leaderboard-adjustment-total">New total score</label>
                    <input
                      id="leaderboard-adjustment-total"
                      type="text"
                      name="target_total"
                      inputmode="numeric"
                      placeholder="Use 156"
                    />
                  </div>
                  <div class="field span-2">
                    <label for="leaderboard-adjustment-reason">Reason</label>
                    <input
                      id="leaderboard-adjustment-reason"
                      type="text"
                      name="reason"
                      maxlength="160"
                      placeholder="Rain correction, fair-play fix, manual bonus..."
                    />
                  </div>
                  <div class="field span-2">
                    <small>
                      Example: if a member is on 150 and you type 156, the app saves the needed +6 correction automatically.
                    </small>
                  </div>
                  <div class="field span-2">
                    <button class="btn" type="submit">Save new total</button>
                  </div>
                </form>
              </div>
              <div class="admin-card">
                <div class="section-head">
                  <div>
                    <h4>Match cancellation</h4>
                    <p>Use this only when the fixture is officially abandoned or should not count at all. Once cancelled, any points from this match disappear from the leaderboard.</p>
                  </div>
                </div>
                ${
                  match
                    ? `
                      <div class="chip-list">
                        <span class="chip"><strong>Status</strong>${escapeHtml(labelizeStatus(selectedMatchStatus))}</span>
                        <span class="chip"><strong>Effect</strong>No points count</span>
                        <span class="chip"><strong>Result row</strong>${selectedMatchStatus === "cancelled" ? "Removed" : "Will be removed"}</span>
                      </div>
                      <div class="split-line" style="margin-top: 1rem;">
                        <button
                          class="ghost-btn danger-btn"
                          type="button"
                          data-action="cancel-match"
                          data-match-id="${match.id}"
                          ${state.cancellingMatchIds.has(match.id) || selectedMatchStatus === "cancelled" ? "disabled" : ""}
                        >
                          ${
                            selectedMatchStatus === "cancelled"
                              ? "Match cancelled"
                              : state.cancellingMatchIds.has(match.id)
                                ? "Cancelling..."
                                : "Cancel match"
                          }
                        </button>
                        <span class="subtle">${
                          selectedMatchStatus === "cancelled"
                            ? "This fixture is already cancelled, and its points no longer count anywhere."
                            : "This clears the settled result and removes this fixture from all leaderboard totals."
                        }</span>
                      </div>
                    `
                    : `<div class="empty-state">Choose a fixture above to unlock cancellation controls.</div>`
                }
              </div>
              <div class="admin-card">
                <div class="section-head">
                  <div>
                    <h4>Prediction recovery</h4>
                    <p>Use this when the platform bug wiped unsaved picks. It restores core picks for a member and can also repair their score call if needed.</p>
                  </div>
                </div>
                <div class="chip-list">
                  <span class="chip"><strong>Members</strong>${recoveryEntries.length}</span>
                  <span class="chip"><strong>Core missing</strong>${recoveryMissingCount}</span>
                  <span class="chip"><strong>Score only</strong>${recoveryScoreOnlyCount}</span>
                  <span class="chip"><strong>Window</strong>Admin recovery</span>
                </div>
                ${
                  selectedMatchStatus === "cancelled"
                    ? `<div class="empty-state">This fixture is cancelled, so prediction recovery is frozen and no user picks from this match will contribute to scoring.</div>`
                    : `
                      <form class="form-grid" id="admin-recovery-form">
                        <input type="hidden" name="match_id" value="${match.id}" />
                        <div class="field span-2">
                          <label for="admin-recovery-member">Member</label>
                          <select
                            id="admin-recovery-member"
                            name="target_user_id"
                            ${!recoveryEntries.length ? "disabled" : ""}
                          >
                            <option value="">Choose member</option>
                            ${renderAdminRecoveryMemberOptions(
                              match.id,
                              defaultRecoveryEntry?.member?.user_id || "",
                            )}
                          </select>
                        </div>
                        <div class="field">
                          <label for="admin-recovery-batsman">Batsman</label>
                          <input
                            id="admin-recovery-batsman"
                            type="text"
                            name="batsman_name"
                            list="${escapeAttribute(recoveryBatsmanListId)}"
                            value="${escapeAttribute(defaultRecoveryEntry?.prediction?.batsman_name || "")}"
                            placeholder="Type batsman name"
                            ${!recoveryEntries.length ? "disabled" : ""}
                          />
                          <datalist id="${escapeAttribute(recoveryBatsmanListId)}">
                            ${renderPlayerDatalistOptions(recoveryBatsmanOptions)}
                          </datalist>
                        </div>
                        <div class="field">
                          <label for="admin-recovery-bowler">Bowler</label>
                          <input
                            id="admin-recovery-bowler"
                            type="text"
                            name="bowler_name"
                            list="${escapeAttribute(recoveryBowlerListId)}"
                            value="${escapeAttribute(defaultRecoveryEntry?.prediction?.bowler_name || "")}"
                            placeholder="Type bowler name"
                            ${!recoveryEntries.length ? "disabled" : ""}
                          />
                          <datalist id="${escapeAttribute(recoveryBowlerListId)}">
                            ${renderPlayerDatalistOptions(recoveryBowlerOptions)}
                          </datalist>
                        </div>
                        <div class="field span-2">
                          <label for="admin-recovery-team">Winning team</label>
                          <select
                            id="admin-recovery-team"
                            name="team_pick"
                            ${!recoveryEntries.length ? "disabled" : ""}
                          >
                            <option value="">Choose winner</option>
                            <option value="${escapeAttribute(match.team_a)}" ${
                              defaultRecoveryEntry?.prediction?.team_pick === match.team_a ? "selected" : ""
                            }>${escapeHtml(match.team_a)}</option>
                            <option value="${escapeAttribute(match.team_b)}" ${
                              defaultRecoveryEntry?.prediction?.team_pick === match.team_b ? "selected" : ""
                            }>${escapeHtml(match.team_b)}</option>
                          </select>
                        </div>
                        <div class="field span-2">
                          <label for="admin-recovery-score">1st innings total</label>
                          <input
                            id="admin-recovery-score"
                            type="text"
                            name="predicted_score"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            maxlength="3"
                            value="${escapeAttribute(defaultRecoveryEntry?.prediction?.predicted_score ?? "")}"
                            placeholder="Leave blank to keep current score"
                            ${!recoveryEntries.length ? "disabled" : ""}
                          />
                        </div>
                        <div class="field span-2">
                          <small>
                            Recovery bypasses the normal 3.1 and 7.1 user locks for admins only. Leave score blank if you only want to repair batsman, bowler, and winner.
                          </small>
                        </div>
                        <div class="field span-2">
                          <button class="btn" type="submit" ${!recoveryEntries.length ? "disabled" : ""}>
                            Recover member prediction
                          </button>
                        </div>
                      </form>
                    `
                }
              </div>
              <div class="admin-card">
                <div class="section-head">
                  <div>
                    <h4>Admin override</h4>
                    <p>Creator can override match timing and current ball if the live feed lags or needs correction.</p>
                  </div>
                </div>
                ${
                  selectedMatchStatus === "cancelled"
                    ? `
                      <div class="empty-state">
                        This fixture is cancelled and frozen. Its result row is removed, it no longer affects leaderboard totals, and live override controls stay disabled.
                      </div>
                    `
                    : `
                      <form class="form-grid" id="admin-override-form">
                        <input type="hidden" name="match_id" value="${match.id}" />
                        <div class="field">
                          <label for="override-status">Status</label>
                          <select id="override-status" name="status">
                            ${["scheduled", "live", "locked", "completed"]
                              .map(
                                (status) => `
                                  <option value="${status}" ${
                                    computeMatchStatus(match) === status ? "selected" : ""
                                  }>${labelizeStatus(status)}</option>
                                `,
                              )
                              .join("")}
                          </select>
                        </div>
                        <div class="field">
                          <label for="override-starts-at">Starts at</label>
                          <input id="override-starts-at" type="datetime-local" name="starts_at" value="${escapeAttribute(
                            toDateTimeInput(match.starts_at),
                          )}" />
                        </div>
                        <div class="field">
                          <label for="override-innings-at">Innings started at</label>
                          <input id="override-innings-at" type="datetime-local" name="innings_started_at" value="${escapeAttribute(
                            toDateTimeInput(match.innings_started_at),
                          )}" />
                        </div>
                        <div class="field">
                          <label for="override-xi-at">Official XI announced at</label>
                          <input id="override-xi-at" type="datetime-local" name="playing_xi_announced_at" value="${escapeAttribute(
                            toDateTimeInput(match.playing_xi_announced_at),
                          )}" />
                        </div>
                        <div class="field">
                          <label for="override-picks-at">Core picks fallback lock</label>
                          <input id="override-picks-at" type="datetime-local" name="picks_deadline_at" value="${escapeAttribute(
                            toDateTimeInput(match.picks_deadline_at),
                          )}" />
                        </div>
                        <div class="field">
                          <label for="override-score-at">Score fallback lock</label>
                          <input id="override-score-at" type="datetime-local" name="score_deadline_at" value="${escapeAttribute(
                            toDateTimeInput(match.score_deadline_at),
                          )}" />
                        </div>
                        <div class="field">
                          <label for="override-current-ball">Current 1st innings ball</label>
                          <input id="override-current-ball" type="text" inputmode="numeric" name="current_innings_ball" value="${escapeAttribute(
                            liveWindow?.currentBall ?? "",
                          )}" placeholder="19" />
                        </div>
                        <div class="field span-2">
                          <label for="override-notes">Notes</label>
                          <textarea id="override-notes" name="notes" placeholder="Optional admin note or exception rule.">${escapeHtml(
                            match.notes || "",
                          )}</textarea>
                        </div>
                        <div class="field span-2">
                          <small>
                            Setting current ball lets you manually force the 3.1 and 7.1 over locks. Leave it blank to rely on provider sync and fallback deadlines.
                          </small>
                        </div>
                        <div class="field span-2">
                          <button class="btn" type="submit">Save admin override</button>
                        </div>
                      </form>
                    `
                }
              </div>
              <div class="admin-card">
                <div class="section-head">
                  <div>
                    <h4>Manual result fallback</h4>
                    <p>Use this only if the provider result or scorecard is missing and you need to settle points manually.</p>
                  </div>
                </div>
                ${
                  selectedMatchStatus === "cancelled"
                    ? `<div class="empty-state">This fixture is cancelled, so manual settlement stays disabled and no points will be applied.</div>`
                    : `
                      <form class="form-grid" id="result-form">
                        <input type="hidden" name="match_id" value="${match.id}" />
                        <div class="field">
                          <label for="result-winner">Winner</label>
                          <select id="result-winner" name="winner_team">
                            <option value="">Choose winner</option>
                            <option value="${escapeAttribute(match.team_a)}" ${
                              matchResult?.winner_team === match.team_a ? "selected" : ""
                            }>${escapeHtml(match.team_a)}</option>
                            <option value="${escapeAttribute(match.team_b)}" ${
                              matchResult?.winner_team === match.team_b ? "selected" : ""
                            }>${escapeHtml(match.team_b)}</option>
                          </select>
                        </div>
                        <div class="field">
                          <label for="result-total">1st innings total</label>
                          <input id="result-total" type="text" inputmode="numeric" name="first_innings_total" value="${escapeAttribute(
                            matchResult?.first_innings_total ?? "",
                          )}" placeholder="182" />
                        </div>
                        <div class="field span-2">
                          <label for="result-batsmen">Batsman runs</label>
                          <textarea id="result-batsmen" name="batsman_runs" placeholder="Virat Kohli: 72">${escapeHtml(
                            mapToLines(matchResult?.batsman_runs || {}),
                          )}</textarea>
                        </div>
                        <div class="field span-2">
                          <label for="result-bowlers">Bowler wickets</label>
                          <textarea id="result-bowlers" name="bowler_wickets" placeholder="Jasprit Bumrah: 2">${escapeHtml(
                            mapToLines(matchResult?.bowler_wickets || {}),
                          )}</textarea>
                        </div>
                        <div class="field span-2">
                          <label for="result-notes">Result notes</label>
                          <textarea id="result-notes" name="notes" placeholder="Optional settlement note.">${escapeHtml(
                            matchResult?.notes || "",
                          )}</textarea>
                        </div>
                        <div class="field span-2">
                          <button class="ghost-btn" type="submit">Save manual result</button>
                        </div>
                      </form>
                    `
                }
              </div>
            `
            : ""
        }
      </div>
    </section>
  `;
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();

  try {
    if (form.id === "profile-form") {
      await saveProfile(form);
      return;
    }

    if (state.demoMode) {
      flash("Demo mode is read-only. Add Supabase keys to save real data.", "info");
      return;
    }

    if (form.id === "create-league-form") {
      await createLeague(form);
      return;
    }

    if (form.id === "join-league-form") {
      await joinLeague(form);
      return;
    }

    if (form.id === "core-prediction-form" || form.id === "score-prediction-form") {
      await savePrediction(form);
      return;
    }

    if (form.id === "create-match-form") {
      await createMatch(form);
      return;
    }

    if (form.id === "timeline-form") {
      await saveTimeline(form);
      return;
    }

    if (form.id === "result-form") {
      await saveResult(form);
      return;
    }

    if (form.id === "admin-recovery-form") {
      await saveAdminRecovery(form);
      return;
    }

    if (form.id === "leaderboard-adjustment-form") {
      await saveLeaderboardAdjustment(form);
      return;
    }

    if (form.id === "admin-override-form") {
      await saveAdminOverride(form);
    }
  } catch (error) {
    console.error(error);
    flash(error.message || "That action failed.", "error");
  }
}

async function startGoogleSignIn(button) {
  await withButtonPending(button, "Redirecting...", async () => {
    clearPendingPhoneAuthState();

    const redirectTo = new URL(window.location.pathname || "/", window.location.origin).toString();
    const { error } = await state.client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      throw error;
    }
  });
}

async function saveProfile(form) {
  const formData = new FormData(form);
  const displayName = cleanText(formData.get("display_name"), 40);

  if (!displayName) {
    throw new Error("Display name cannot be empty.");
  }

  if (state.demoMode) {
    state.profile.display_name = displayName;
    state.members = state.members.map((member) =>
      member.user_id === DEMO_USER_ID ? { ...member, display_name: displayName } : member,
    );
    state.memberships = state.memberships.map((membership) => ({
      ...membership,
      display_name: membership.user_id === DEMO_USER_ID ? displayName : membership.display_name,
    }));
    state.leaderboard = buildLeaderboardFromMatches(
      state.members,
      state.predictions,
      state.matches,
      state.pointAdjustments,
    );
    render();
    flash("Demo profile updated locally.", "success");
    return;
  }

  await withPendingForm(form, "Saving...", async () => {
    const { error } = await state.client.rpc("sync_member_display_name", {
      p_display_name: displayName,
    });

    if (error) {
      throw error;
    }

    await ensureProfile();
    await loadMemberships();
    await loadLeagueBundle();
  });
  render();
  flash("Display name updated.", "success");
}

async function createLeague(form) {
  const formData = new FormData(form);
  const name = cleanText(formData.get("name"), 80);
  const season = cleanText(formData.get("season"), 40);

  if (!name) {
    throw new Error("League name is required.");
  }

  let scheduleMessage = "League created. Share the invite code with your friends.";

  await withPendingForm(form, "Creating league...", async () => {
    const { error } = await state.client.rpc("create_league", {
      p_name: name,
      p_season: season || "IPL 2026",
    });

    if (error) {
      throw error;
    }

    await loadMemberships();
    await loadLeagueBundle();

    if (!state.demoMode) {
      try {
        await loadProviderFixtures({ quiet: true, flashSuccess: false });
        scheduleMessage = "League created and the IPL schedule was synced.";
      } catch (syncError) {
        console.error(syncError);
        scheduleMessage = "League created, but IPL schedule sync needs a retry from admin tools.";
      }
    }
  });

  render();
  form.reset();
  flash(scheduleMessage, "success");
}

async function joinLeague(form) {
  const formData = new FormData(form);
  const inviteCode = String(formData.get("invite_code") || "").trim().toUpperCase();

  if (!inviteCode) {
    throw new Error("Invite code is required.");
  }

  await withPendingForm(form, "Joining league...", async () => {
    const { error } = await state.client.rpc("join_league", {
      p_invite_code: inviteCode,
    });

    if (error) {
      throw error;
    }

    await loadMemberships();
    await loadLeagueBundle();
  });
  render();
  form.reset();
  flash(`Joined league with code ${inviteCode}.`, "success");
}

async function savePrediction(form) {
  const formData = new FormData(form);
  const matchId = String(formData.get("match_id") || "");
  const match = state.matches.find((entry) => entry.id === matchId) || null;
  const liveWindow = getLiveWindowState(match, getCurrentUserPrediction(matchId));
  const batsmanName = cleanNullableText(formData.get("batsman_name"), 80);
  const bowlerName = cleanNullableText(formData.get("bowler_name"), 80);
  const teamPick = cleanNullableText(formData.get("team_pick"), 80);
  const predictedScoreRaw = String(formData.get("predicted_score") || "").trim();

  const hasCoreValue = [batsmanName, bowlerName, teamPick].some(Boolean);
  if (hasCoreValue && [batsmanName, bowlerName, teamPick].some((value) => !value)) {
    throw new Error("Submit batsman, bowler, and winning team together.");
  }

  if (match && isFinishedMatchStatus(computeMatchStatus(match))) {
    throw new Error("This match is already completed.");
  }

  if (hasCoreValue && !liveWindow.coreWindowOpen) {
    throw new Error("Player picks are locked after the 3.1 over cutoff.");
  }

  if (
    batsmanName &&
    bowlerName &&
    resolvePlayerCanonicalKey(batsmanName, match) === resolvePlayerCanonicalKey(bowlerName, match)
  ) {
    throw new Error("Batsman and bowler must be two different players.");
  }

  if (predictedScoreRaw !== "" && !/^\d+$/.test(predictedScoreRaw)) {
    throw new Error("Score prediction must contain numbers only.");
  }
  const predictedScore =
    predictedScoreRaw === "" ? null : Number.parseInt(predictedScoreRaw, 10);

  if (predictedScore !== null && !liveWindow.scoreWindowOpen) {
    throw new Error(
      liveWindow.scoreLocked
        ? "Score prediction is locked after the 7.1 over cutoff."
        : "Score prediction opens after the 3.1 over cutoff.",
    );
  }

  const conflict = findPredictionConflict(matchId, {
    batsman_name: batsmanName,
    bowler_name: bowlerName,
    predicted_score: predictedScore,
  });
  if (conflict) {
    state.lastPredictionConflictKey = conflict.key;
    showTransientToast(
      conflict.message || "Same batsman-bowler combination exists for this match. Choose a different pair.",
      "error",
    );
  }

  await withPendingForm(
    form,
    form.id === "score-prediction-form" ? "Saving score..." : "Saving picks...",
    async () => {
      const { error } = await state.client.rpc("submit_prediction", {
        p_match_id: matchId,
        p_batsman_name: batsmanName,
        p_bowler_name: bowlerName,
        p_team_pick: teamPick,
        p_predicted_score: predictedScore,
      });

      if (error) {
        throw error;
      }

      await loadLeagueBundle();
    },
  );
  clearPredictionDraft(matchId);
  state.lastPredictionConflictKey = null;
  render();
  flash("Prediction saved.", "success");
}

async function saveAdminRecovery(form) {
  const formData = new FormData(form);
  const matchId = String(formData.get("match_id") || "");
  const targetUserId = String(formData.get("target_user_id") || "").trim();
  const batsmanName = cleanNullableText(formData.get("batsman_name"), 80);
  const bowlerName = cleanNullableText(formData.get("bowler_name"), 80);
  const teamPick = cleanNullableText(formData.get("team_pick"), 80);
  const predictedScoreRaw = String(formData.get("predicted_score") || "").trim();
  const predictedScore =
    predictedScoreRaw === "" ? null : Number.parseInt(predictedScoreRaw, 10);
  const member = state.members.find((entry) => entry.user_id === targetUserId) || null;

  if (!matchId) {
    throw new Error("Match id is missing.");
  }

  if (!targetUserId) {
    throw new Error("Choose the member you want to recover.");
  }

  if (!batsmanName || !bowlerName || !teamPick) {
    throw new Error("Recovery needs batsman, bowler, and winning team.");
  }

  if (predictedScoreRaw !== "" && !/^\d+$/.test(predictedScoreRaw)) {
    throw new Error("Recovered score must contain numbers only.");
  }

  await withPendingForm(form, "Recovering picks...", async () => {
    const payload = {
      p_match_id: matchId,
      p_target_user_id: targetUserId,
      p_batsman_name: batsmanName,
      p_bowler_name: bowlerName,
      p_team_pick: teamPick,
    };

    if (predictedScore !== null) {
      payload.p_predicted_score = predictedScore;
    }

    const { error } = await state.client.rpc("admin_recover_prediction", payload);

    if (error) {
      if (error.code === "PGRST202") {
        throw new Error(
          predictedScore !== null
            ? "Supabase is still on the older admin recovery function. Run the admin recovery migration in SQL editor, then retry score recovery."
            : "Supabase is missing the admin recovery function. Run the admin recovery migration in SQL editor, then retry.",
        );
      }
      throw error;
    }

    await loadLeagueBundle();
  });

  render();
  flash(
    `Recovered prediction for ${member?.display_name || "that member"}.`,
    "success",
  );
}

async function saveLeaderboardAdjustment(form) {
  const formData = new FormData(form);
  const leagueId = String(formData.get("league_id") || state.activeLeagueId || "").trim();
  const targetUserId = String(formData.get("target_user_id") || "").trim();
  const targetTotalRaw = String(formData.get("target_total") || "").trim();
  const reason = cleanNullableText(formData.get("reason"), 160);
  const member = state.members.find((entry) => entry.user_id === targetUserId) || null;

  if (!leagueId) {
    throw new Error("League id is missing.");
  }

  if (!targetUserId) {
    throw new Error("Choose the member whose points you want to adjust.");
  }

  if (!/^-?\d+$/.test(targetTotalRaw)) {
    throw new Error("New total score must be a whole number like 156.");
  }

  const targetTotal = Number.parseInt(targetTotalRaw, 10);

  await withPendingForm(form, "Saving adjustment...", async () => {
    const { error } = await state.client.rpc("set_leaderboard_total", {
      p_league_id: leagueId,
      p_target_user_id: targetUserId,
      p_target_total: targetTotal,
      p_reason: reason,
    });

    if (error) {
      if (error.code === "PGRST202") {
        throw new Error(
          "Supabase is missing the leaderboard adjustment functions. Run the manual point adjustments migration in SQL editor, then retry.",
        );
      }
      throw error;
    }

    await loadLeagueBundle();
  });

  form.reset();
  render();
  flash(
    `Set ${member?.display_name || "that member"} to ${targetTotal} total points.`,
    "success",
  );
}

async function saveAdminOverride(form) {
  const formData = new FormData(form);
  const matchId = String(formData.get("match_id") || "");
  const status = cleanNullableText(formData.get("status"), 20);
  const startsAt = toIsoDate(formData.get("starts_at"));
  const inningsStartedAt = toIsoDate(formData.get("innings_started_at"));
  const xiAt = toIsoDate(formData.get("playing_xi_announced_at"));
  const picksAt = toIsoDate(formData.get("picks_deadline_at"));
  const scoreAt = toIsoDate(formData.get("score_deadline_at"));
  const notes = cleanNullableText(formData.get("notes"), 600);
  const currentBallRaw = String(formData.get("current_innings_ball") || "").trim();
  const currentBall =
    currentBallRaw === "" ? null : Number.parseInt(currentBallRaw, 10);

  if (!matchId) {
    throw new Error("Match id is missing.");
  }

  if (currentBallRaw !== "" && Number.isNaN(currentBall)) {
    throw new Error("Current innings ball must be a number.");
  }

  const payload = {
    status: status || null,
    starts_at: startsAt,
    innings_started_at: inningsStartedAt,
    playing_xi_announced_at: xiAt,
    picks_deadline_at: picksAt,
    score_deadline_at: scoreAt,
    notes,
    current_innings_ball: currentBall,
    current_over_display: currentBall === null ? null : formatBallsAsOvers(currentBall),
    sync_error: null,
  };

  await withPendingForm(form, "Saving override...", async () => {
    const { error } = await state.client.from("matches").update(payload).eq("id", matchId);

    if (error) {
      throw error;
    }

    await loadLeagueBundle();
  });
  render();
  flash("Admin override saved.", "success");
}

async function createMatch(form) {
  const formData = new FormData(form);
  const teamA = cleanText(formData.get("team_a"), 80);
  const teamB = cleanText(formData.get("team_b"), 80);
  const title = cleanNullableText(formData.get("title"), 120) || `${teamA} vs ${teamB}`;
  const venue = cleanNullableText(formData.get("venue"), 120);
  const startsAt = toIsoDate(formData.get("starts_at"));
  const xiAt = toIsoDate(formData.get("playing_xi_announced_at"));
  const picksAt = toIsoDate(formData.get("picks_deadline_at"));
  const scoreAt = toIsoDate(formData.get("score_deadline_at"));
  const notes = cleanNullableText(formData.get("notes"), 600);
  const leagueId = String(formData.get("league_id") || state.activeLeagueId || "");

  if (!teamA || !teamB || !startsAt || !picksAt || !scoreAt) {
    throw new Error("Please fill all required match fields.");
  }

  await withPendingForm(form, "Creating match...", async () => {
    const { error } = await state.client.rpc("create_match", {
      p_league_id: leagueId,
      p_title: title,
      p_team_a: teamA,
      p_team_b: teamB,
      p_starts_at: startsAt,
      p_playing_xi_announced_at: xiAt,
      p_picks_deadline_at: picksAt,
      p_score_deadline_at: scoreAt,
      p_venue: venue,
      p_notes: notes,
    });

    if (error) {
      throw error;
    }

    await loadLeagueBundle();
  });
  render();
  form.reset();
  flash("Match created.", "success");
}

async function saveTimeline(form) {
  const formData = new FormData(form);

  await withPendingForm(form, "Saving timeline...", async () => {
    const { error } = await state.client.rpc("save_match_timeline", {
      p_match_id: String(formData.get("match_id") || ""),
      p_status: cleanNullableText(formData.get("status"), 20),
      p_starts_at: toIsoDate(formData.get("starts_at")),
      p_innings_started_at: toIsoDate(formData.get("innings_started_at")),
      p_playing_xi_announced_at: toIsoDate(formData.get("playing_xi_announced_at")),
      p_picks_deadline_at: toIsoDate(formData.get("picks_deadline_at")),
      p_score_deadline_at: toIsoDate(formData.get("score_deadline_at")),
    });

    if (error) {
      throw error;
    }

    await loadLeagueBundle();
  });
  render();
  flash("Match timeline updated.", "success");
}

async function saveResult(form) {
  const formData = new FormData(form);
  const matchId = String(formData.get("match_id") || "");
  const match = state.matches.find((entry) => entry.id === matchId) || null;
  const winnerTeam = cleanText(formData.get("winner_team"), 80);
  const total = Number.parseInt(String(formData.get("first_innings_total") || ""), 10);
  const batsmanRuns = parseScoreLines(String(formData.get("batsman_runs") || ""), match);
  const bowlerWickets = parseScoreLines(String(formData.get("bowler_wickets") || ""), match);
  const notes = cleanNullableText(formData.get("notes"), 1000);

  if (!winnerTeam || Number.isNaN(total)) {
    throw new Error("Winner and first innings total are required.");
  }

  if (match?.status === "cancelled") {
    throw new Error("Cancelled matches cannot be settled.");
  }

  await withPendingForm(form, "Saving result...", async () => {
    const { error } = await state.client.rpc("save_match_result", {
      p_match_id: matchId,
      p_winner_team: winnerTeam,
      p_first_innings_total: total,
      p_batsman_runs: batsmanRuns,
      p_bowler_wickets: bowlerWickets,
      p_notes: notes,
    });

    if (error) {
      throw error;
    }

    await loadLeagueBundle();
  });
  render();
  flash("Match result saved and points recalculated.", "success");
}

async function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.getAttribute("data-action");

  try {
    if (action === "toggle-theme") {
      state.theme = state.theme === "light" ? "dark" : "light";
      persistTheme();
      render();
      return;
    }

    if (action === "sign-out") {
      clearPendingPhoneAuthState();
      await state.client.auth.signOut();
      flash("Signed out.", "success");
      return;
    }

    if (action === "sign-in-google") {
      await startGoogleSignIn(target);
      return;
    }

    if (action === "switch-league") {
      state.activeLeagueId = target.getAttribute("data-league-id");
      await loadLeagueBundle();
      render();
      return;
    }

    if (action === "refresh-league") {
      if (state.demoMode) {
        flash("Demo data is already local.", "info");
        return;
      }

      await loadMemberships();
      await loadLeagueBundle();
      render();
      flash("League refreshed.", "success");
      return;
    }

    if (action === "copy-invite-code") {
      const inviteCode = target.getAttribute("data-invite-code") || "";
      if (!inviteCode) {
        throw new Error("Invite code is not available yet.");
      }

      await navigator.clipboard.writeText(inviteCode);
      flash(`Invite code ${inviteCode} copied.`, "success");
      return;
    }

    if (action === "end-league") {
      const leagueId = target.getAttribute("data-league-id") || state.activeLeagueId;
      if (!leagueId) {
        throw new Error("League not found.");
      }

      if (!window.confirm("End this league and freeze the invite code? The winner will stay visible on the league card.")) {
        return;
      }

      state.endingLeagueId = leagueId;
      render();
      try {
        const { error } = await state.client.rpc("end_league", {
          p_league_id: leagueId,
        });

        if (error) {
          throw error;
        }

        await loadMemberships();
        await loadLeagueBundle();
        flash("League ended. The winner is now shown on the league widget.", "success");
      } finally {
        state.endingLeagueId = null;
        render();
      }
      return;
    }

    if (action === "cancel-match") {
      const matchId = target.getAttribute("data-match-id") || getSelectedMatch()?.id;
      if (!matchId) {
        throw new Error("Match not found.");
      }

      await cancelMatch(matchId);
      return;
    }

    if (action === "open-prediction-scorecard") {
      const matchId = target.getAttribute("data-match-id");
      const match = state.matches.find((item) => item.id === matchId);
      if (!match || !getMatchResult(match)) {
        throw new Error("Prediction scorecard is not available for this match yet.");
      }

      state.predictionScorecardMatchId = matchId;
      render();
      return;
    }

    if (action === "close-prediction-scorecard") {
      state.predictionScorecardMatchId = null;
      render();
      return;
    }

    if (action === "open-player-picker") {
      const matchId = target.getAttribute("data-match-id");
      const fieldName = target.getAttribute("data-field-name");
      if (!matchId || !fieldName) {
        return;
      }

      state.playerPicker = {
        matchId,
        fieldName,
      };
      render();
      return;
    }

    if (action === "close-player-picker") {
      state.playerPicker = null;
      render();
      return;
    }

    if (action === "select-player-option") {
      const matchId = target.getAttribute("data-match-id");
      const fieldName = target.getAttribute("data-field-name");
      const playerName = target.getAttribute("data-player-name") || "";
      setPredictionDraftField(matchId, fieldName, playerName);
      state.playerPicker = null;
      render();
      maybeWarnPredictionConflict(document.getElementById("core-prediction-form"));
      return;
    }

    if (action === "clear-player-option") {
      const matchId = target.getAttribute("data-match-id");
      const fieldName = target.getAttribute("data-field-name");
      setPredictionDraftField(matchId, fieldName, "");
      state.playerPicker = null;
      render();
      maybeWarnPredictionConflict(document.getElementById("core-prediction-form"));
      return;
    }

    if (action === "load-provider-fixtures") {
      await loadProviderFixtures();
      return;
    }

    if (action === "import-provider-fixture") {
      await importProviderFixture(target.getAttribute("data-external-match-id"));
      return;
    }

    if (action === "sync-selected-match") {
      const matchId = target.getAttribute("data-match-id");
      const match = state.matches.find((item) => item.id === matchId);
      if (!match) {
        throw new Error("Match not found.");
      }

      await syncMatchFromProvider(match, { quiet: false, flashSuccess: true });
      return;
    }

    if (action === "calculate-match-points") {
      const matchId = target.getAttribute("data-match-id");
      const match = state.matches.find((item) => item.id === matchId);
      if (!match) {
        throw new Error("Match not found.");
      }

      await calculateMatchPointsFromProvider(match);
      return;
    }

    if (action === "toggle-auto-sync") {
      const matchId = target.getAttribute("data-match-id");
      await toggleAutoSync(matchId);
      return;
    }

    if (action === "install-app") {
      await installApp();
      return;
    }

    if (action === "clear-fixture-filters") {
      state.fixtureFilters = {
        team: "all",
        status: "scheduled",
        todayOnly: false,
        scorecardOnly: false,
      };
      render();
      return;
    }

    if (action === "toggle-fixture-filter-flag") {
      const flag = target.getAttribute("data-flag");
      if (flag === "todayOnly" || flag === "scorecardOnly") {
        state.fixtureFilters[flag] = !state.fixtureFilters[flag];
        render();
      }
      return;
    }

    if (action === "open-match-section") {
      const section = target.getAttribute("data-section") || state.route?.section || "centre";
      const matchId = target.getAttribute("data-match-id") || getSelectedMatch()?.id;
      if (section === "centre") {
        state.activeMatchCentrePanel = "prediction";
      }
      navigateToRoute(
        {
          page: "matches",
          section,
          matchId,
        },
        { scrollToTop: false },
      );
      return;
    }

    if (action === "select-match") {
      state.selectedMatchId = target.getAttribute("data-match-id");
      state.activeMatchCentrePanel = "prediction";
      if (state.route?.page === "matches") {
        navigateToRoute(
          {
            page: "matches",
            section: state.route.section || "centre",
            matchId: state.selectedMatchId,
          },
          { scrollToTop: false },
        );
        return;
      }

      render();
      scrollPredictionPanelIntoView();
      return;
    }

    if (action === "jump-match-panel") {
      const panelId = target.getAttribute("data-panel-id");
      state.activeMatchCentrePanel =
        target.getAttribute("data-panel-key") || getMatchCentrePanelKeyFromId(panelId);
      render();
      scrollPanelIntoView(panelId);
      return;
    }
  } catch (error) {
    console.error(error);
    flash(error.message || "Action failed.", "error");
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
    return;
  }

  if (target instanceof HTMLSelectElement && target.id === "fixture-team-filter") {
    state.fixtureFilters.team = target.value || "all";
    render();
    return;
  }

  if (target instanceof HTMLSelectElement && target.id === "fixture-status-filter") {
    state.fixtureFilters.status = target.value || "scheduled";
    render();
    return;
  }

  if (target instanceof HTMLInputElement && target.id === "create-starts-at" && !document.getElementById("create-picks-at")?.value) {
    document.getElementById("create-picks-at").value = target.value;
  }

  syncPredictionDraftFromForm(target.form);
  maybeWarnPredictionConflict(target.form);
}

function handleKeyDown(event) {
  if (event.key === "Escape" && state.playerPicker) {
    state.playerPicker = null;
    render();
    return;
  }

  if (event.key === "Escape" && state.predictionScorecardMatchId) {
    state.predictionScorecardMatchId = null;
    render();
  }
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.playerPickerSearch === "true") {
    filterPlayerPickerOptions(target.value);
    return;
  }

  if (
    target.name === "predicted_score" ||
    target.name === "current_innings_ball" ||
    target.name === "first_innings_total"
  ) {
    target.value = target.value.replace(/\D+/g, "");
  }

  syncPredictionDraftFromForm(target.form);
  maybeWarnPredictionConflict(target.form);
}

function getUserIdentityLabel() {
  return state.user?.phone || state.user?.email || "";
}

function getUserAvatarUrl(user = state.user) {
  return cleanText(
    user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture ||
      user?.user_metadata?.picture_url ||
      user?.identities?.[0]?.identity_data?.avatar_url ||
      user?.identities?.[0]?.identity_data?.picture ||
      "",
    1000,
  );
}

function getMemberRecord(userId) {
  if (!userId) {
    return null;
  }

  return state.members.find((member) => member.user_id === userId) || null;
}

function getTeamBrand(teamName) {
  const normalizedName = normalizeName(teamName || "");
  const resolvedKey = TEAM_BRAND_ALIASES[normalizedName] || normalizedName;
  return (
    TEAM_BRANDS[resolvedKey] || {
      short: getTeamShortCode(teamName),
      logo: "",
      primary: "#244eb1",
      secondary: "#ff8f3d",
      accent: "#9cdfff",
    }
  );
}

function getIdentityHue(seed) {
  return Array.from(String(seed || "")).reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
}

function buildIdentityStyle(seed, teamName = "") {
  if (teamName) {
    const brand = getTeamBrand(teamName);
    return `--identity-primary:${brand.primary};--identity-secondary:${brand.secondary};--identity-accent:${brand.accent};`;
  }

  const hue = getIdentityHue(seed);
  return `--identity-primary:hsl(${hue} 66% 46%);--identity-secondary:hsl(${(hue + 28) % 360} 84% 60%);--identity-accent:hsl(${(hue + 120) % 360} 72% 72%);`;
}

function getDisplayInitials(value, limit = 2) {
  const parts = cleanText(value, 80)
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "--";
  }

  return parts
    .slice(0, limit)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function renderTeamMark(teamName, size = "md", className = "") {
  const brand = getTeamBrand(teamName);
  const classes = ["team-mark", `team-mark-${size}`, className].filter(Boolean).join(" ");
  const fallback = getTeamShortCode(teamName) || "--";

  return `
    <span class="${classes}" style="${escapeAttribute(buildIdentityStyle(teamName, teamName))}">
      ${
        brand.logo
          ? `<img src="${escapeAttribute(brand.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`
          : ""
      }
      <span class="team-mark-fallback">${escapeHtml(fallback)}</span>
    </span>
  `;
}

function renderMemberAvatar(displayName, size = "sm", className = "", avatarUrl = "") {
  const classes = ["member-avatar", `member-avatar-${size}`, className].filter(Boolean).join(" ");
  const resolvedAvatarUrl = cleanText(avatarUrl, 1000);

  return `
    <span class="${classes}" style="${escapeAttribute(buildIdentityStyle(displayName))}">
      ${
        resolvedAvatarUrl
          ? `<img src="${escapeAttribute(resolvedAvatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`
          : ""
      }
      <span class="member-avatar-fallback">${escapeHtml(getDisplayInitials(displayName))}</span>
    </span>
  `;
}

function playerNamesMatch(left, right) {
  if (!left || !right) {
    return false;
  }

  const lookupLeft = normalizePlayerLookupKey(left);
  const lookupRight = normalizePlayerLookupKey(right);
  if (lookupLeft && lookupRight) {
    return lookupLeft === lookupRight;
  }

  return normalizeName(left) === normalizeName(right);
}

function getPlayerMeta(match, playerName) {
  if (!match || !playerName) {
    return null;
  }

  for (const group of getPlayingXiGroups(match)) {
    const player = group.players.find((entry) => playerNamesMatch(entry.name, playerName));
    if (player) {
      return {
        ...player,
        team: player.team || group.teamName,
      };
    }
  }

  return null;
}

function renderPlayerAvatar(match, playerName, { size = "sm", teamName = "", className = "" } = {}) {
  const meta = getPlayerMeta(match, playerName);
  const resolvedName = cleanMatchPlayerName(playerName || meta?.name || "Player");
  const resolvedTeam = teamName || meta?.team || "";
  const imageUrl =
    meta?.image ||
    meta?.imageUrl ||
    meta?.photo ||
    meta?.playerImage ||
    "";
  const classes = ["player-avatar", `player-avatar-${size}`, className].filter(Boolean).join(" ");
  const fallback = getDisplayInitials(resolvedName);

  return `
    <span class="${classes}" style="${escapeAttribute(buildIdentityStyle(resolvedName, resolvedTeam))}">
      ${
        imageUrl
          ? `<img src="${escapeAttribute(imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`
          : ""
      }
      <span class="player-avatar-fallback">${escapeHtml(fallback)}</span>
    </span>
  `;
}

function getTeamShortCode(teamName) {
  const normalized = normalizeName(teamName || "");
  const preset = {
    "chennai-super-kings": "CSK",
    "delhi-capitals": "DC",
    "gujarat-titans": "GT",
    "kolkata-knight-riders": "KKR",
    "lucknow-super-giants": "LSG",
    "mumbai-indians": "MI",
    "punjab-kings": "PBKS",
    "rajasthan-royals": "RR",
    "royal-challengers-bengaluru": "RCB",
    "sunrisers-hyderabad": "SRH",
  }[normalized];

  if (preset) {
    return preset;
  }

  return String(teamName || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function maskPhoneNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return "";
  }

  const visibleTail = normalized.slice(-4);
  const prefix = normalized.startsWith("+91") ? "+91" : normalized.slice(0, Math.max(normalized.length - 8, 2));
  return `${prefix} •••• ${visibleTail}`;
}

function normalizePhoneNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) {
    return "";
  }

  let normalized = cleaned;
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (normalized.startsWith("+")) {
    normalized = `+${normalized.slice(1).replace(/\D+/g, "")}`;
  } else {
    const digits = normalized.replace(/\D+/g, "");
    if (digits.length === 10) {
      normalized = `+91${digits}`;
    } else if (digits.length === 12 && digits.startsWith("91")) {
      normalized = `+${digits}`;
    } else {
      normalized = `+${digits}`;
    }
  }

  return /^\+\d{10,15}$/.test(normalized) ? normalized : "";
}

async function withPendingForm(form, label, task) {
  const elements = Array.from(form.elements || []);
  const submitButtons = Array.from(form.querySelectorAll('button[type="submit"]'));

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    if ("disabled" in element) {
      element.dataset.wasDisabled = element.disabled ? "true" : "false";
      element.disabled = true;
    }
  }

  for (const button of submitButtons) {
    button.dataset.originalLabel = button.textContent || "";
    button.textContent = label;
    button.classList.add("is-loading");
  }

  try {
    return await task();
  } finally {
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      if ("disabled" in element) {
        element.disabled = element.dataset.wasDisabled === "true";
        delete element.dataset.wasDisabled;
      }
    }

    for (const button of submitButtons) {
      button.textContent = button.dataset.originalLabel || button.textContent;
      button.classList.remove("is-loading");
      delete button.dataset.originalLabel;
    }
  }
}

async function withButtonPending(button, label, task) {
  const originalLabel = button.textContent || "";
  const originalDisabled = button.disabled;
  button.disabled = true;
  button.textContent = label;
  button.classList.add("is-loading");

  try {
    return await task();
  } finally {
    button.disabled = originalDisabled;
    button.textContent = originalLabel;
    button.classList.remove("is-loading");
  }
}

function normalizeMatchResultRelation(value, match = null) {
  const relation = Array.isArray(value) ? value[0] || null : value;
  if (!relation || typeof relation !== "object") {
    return null;
  }

  return {
    ...relation,
    batsman_runs: normalizeResultScoreMap(relation.batsman_runs, match),
    bowler_wickets: normalizeResultScoreMap(relation.bowler_wickets, match),
  };
}

function normalizeMatchRecord(match) {
  if (!match || typeof match !== "object") {
    return match;
  }

  return {
    ...match,
    match_results: normalizeMatchResultRelation(match.match_results, match),
  };
}

function getMatchResult(match) {
  if (match?.status === "cancelled") {
    return null;
  }

  return normalizeMatchResultRelation(match?.match_results, match);
}

function getActiveLeague() {
  return state.memberships.find((membership) => membership.league_id === state.activeLeagueId)
    ?.leagues;
}

function getLeagueWinner() {
  return state.leaderboard[0] || null;
}

function currentMembership() {
  return state.memberships.find((membership) => membership.league_id === state.activeLeagueId);
}

function getSelectedMatch() {
  if (!state.matches.length) {
    return null;
  }

  return (
    state.matches.find((match) => match.id === state.selectedMatchId) || state.matches[0] || null
  );
}

function scrollPredictionPanelIntoView() {
  scrollPanelIntoView("prediction-panel");
}

function scrollPanelIntoView(panelId) {
  if (!panelId) {
    return;
  }

  window.requestAnimationFrame(() => {
    document.getElementById(panelId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function getOfficialTeamSquad(teamName) {
  const squad = state.teamSquads[normalizeName(teamName)];
  return Array.isArray(squad) ? normalizePlayerList(squad, teamName) : [];
}

function getMatchPlayerCandidates(match) {
  if (!match) {
    return [];
  }

  const seen = new Set();
  const candidates = [];

  for (const group of getPlayingXiGroups(match)) {
    for (const player of group.players) {
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
  }

  return candidates;
}

function isOfficialTeamSquadLoading(match) {
  if (!match) {
    return false;
  }

  return [match.team_a, match.team_b]
    .map((teamName) => normalizeName(teamName))
    .filter(Boolean)
    .some((teamKey) => state.loadingTeamSquads.has(teamKey));
}

function chooseDefaultMatchId(matches = state.matches) {
  if (!matches.length) {
    return null;
  }

  const currentActionMatchId = getCurrentActionMatchId(matches);
  if (currentActionMatchId) {
    return currentActionMatchId;
  }

  return matches[0].id;
}

function getPredictionsForMatch(matchId) {
  return state.predictions.filter((entry) => entry.match_id === matchId);
}

function getMemberPrediction(matchId, userId) {
  if (!matchId || !userId) {
    return null;
  }

  return (
    state.predictions.find(
      (entry) => entry.match_id === matchId && entry.user_id === userId,
    ) || null
  );
}

function hasCorePrediction(prediction) {
  return Boolean(
    prediction?.batsman_name && prediction?.bowler_name && prediction?.team_pick,
  );
}

function getAdminRecoveryEntries(matchId) {
  return state.members
    .map((member) => {
      const prediction = getMemberPrediction(matchId, member.user_id);
      return {
        member,
        prediction,
        hasCore: hasCorePrediction(prediction),
        hasScore:
          prediction?.predicted_score !== null &&
          prediction?.predicted_score !== undefined,
      };
    })
    .sort((left, right) => {
      const leftRank = left.hasCore ? 1 : 0;
      const rightRank = right.hasCore ? 1 : 0;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return String(left.member.display_name || "").localeCompare(
        String(right.member.display_name || ""),
      );
    });
}

function renderAdminRecoveryMemberOptions(matchId, selectedUserId = "") {
  return getAdminRecoveryEntries(matchId)
    .map(({ member, hasCore, hasScore }) => {
      const label = hasCore ? "core saved" : hasScore ? "score only" : "core missing";
      return `
        <option value="${escapeAttribute(member.user_id)}" ${
          String(member.user_id || "") === String(selectedUserId || "") ? "selected" : ""
        }>
          ${escapeHtml(member.display_name || "Player")} · ${escapeHtml(label)}
        </option>
      `;
    })
    .join("");
}

function renderLeaderboardAdjustmentMemberOptions(selectedUserId = "") {
  const totalsByUserId = new Map(
    state.leaderboard.map((entry) => [String(entry.user_id || ""), Number(entry.total_points || 0)]),
  );

  return [...state.members]
    .sort((left, right) => {
      const leftTotal = totalsByUserId.get(String(left.user_id || "")) || 0;
      const rightTotal = totalsByUserId.get(String(right.user_id || "")) || 0;
      return rightTotal - leftTotal || String(left.display_name || "").localeCompare(String(right.display_name || ""));
    })
    .map((member) => {
      const total = totalsByUserId.get(String(member.user_id || "")) || 0;
      return `
        <option value="${escapeAttribute(member.user_id)}" ${
          String(member.user_id || "") === String(selectedUserId || "") ? "selected" : ""
        }>
          ${escapeHtml(member.display_name || "Player")} · ${escapeHtml(total)} pts
        </option>
      `;
    })
    .join("");
}

function renderPlayerDatalistOptions(groups) {
  const seen = new Set();

  return groups
    .flatMap((group) => group.players.map((player) => player.name))
    .filter((name) => {
      const key = normalizeName(name);
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => left.localeCompare(right))
    .map(
      (name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`,
    )
    .join("");
}

function getCurrentUserPrediction(matchId) {
  if (!matchId || !state.user) {
    return null;
  }

  return (
    state.predictions.find(
      (entry) => entry.match_id === matchId && entry.user_id === state.user.id,
    ) || null
  );
}

function isPredictionForm(form) {
  return (
    form instanceof HTMLFormElement &&
    (form.id === "core-prediction-form" || form.id === "score-prediction-form")
  );
}

function hasPredictionDraftValues(prediction) {
  if (!prediction) {
    return false;
  }

  return Boolean(
    prediction.batsman_name ||
      prediction.bowler_name ||
      prediction.team_pick ||
      prediction.core_submitted_at ||
      prediction.score_submitted_at ||
      prediction.predicted_score !== null && prediction.predicted_score !== undefined,
  );
}

function getPredictionDraft(matchId) {
  if (!matchId) {
    return null;
  }

  return state.predictionDrafts[matchId] || null;
}

function getEditablePrediction(matchId, prediction = getCurrentUserPrediction(matchId)) {
  const draft = getPredictionDraft(matchId);
  if (!draft) {
    return prediction;
  }

  const mergedPrediction = {
    ...(prediction || {}),
    ...draft,
    match_id: matchId,
    user_id: prediction?.user_id || state.user?.id || null,
    id: prediction?.id || null,
    core_submitted_at: prediction?.core_submitted_at || null,
    score_submitted_at: prediction?.score_submitted_at || null,
    core_locked_due_to_pre_xi: prediction?.core_locked_due_to_pre_xi || false,
  };

  return hasPredictionDraftValues(mergedPrediction) ? mergedPrediction : null;
}

function syncPredictionDraftFromForm(form) {
  if (!isPredictionForm(form)) {
    return;
  }

  const formData = new FormData(form);
  const matchId = String(formData.get("match_id") || "");
  if (!matchId) {
    return;
  }

  const predictedScoreRaw = String(formData.get("predicted_score") || "").trim();
  state.predictionDrafts[matchId] = {
    batsman_name: cleanNullableText(formData.get("batsman_name"), 80),
    bowler_name: cleanNullableText(formData.get("bowler_name"), 80),
    team_pick: cleanNullableText(formData.get("team_pick"), 80),
    predicted_score: /^\d+$/.test(predictedScoreRaw)
      ? Number.parseInt(predictedScoreRaw, 10)
      : null,
  };
}

function clearPredictionDraft(matchId) {
  if (!matchId) {
    return;
  }

  delete state.predictionDrafts[matchId];
}

function isPredictionFormActive() {
  const activeElement = document.activeElement;
  return Boolean(
    activeElement instanceof HTMLElement &&
      activeElement.closest("#core-prediction-form, #score-prediction-form"),
  );
}

function isMatchFinalizing(match) {
  return Boolean(match?.status === "completed" && !getMatchResult(match));
}

function isMatchSettled(match) {
  return Boolean(getMatchResult(match));
}

function isFinishedMatchStatus(status) {
  return status === "completed" || status === "finalizing";
}

function computeMatchStatus(match) {
  if (match?.status === "cancelled") {
    return "cancelled";
  }

  if (isMatchSettled(match)) {
    return "completed";
  }

  if (isMatchFinalizing(match)) {
    return "finalizing";
  }

  const liveWindow = getLiveWindowState(match, null);
  const startsAt = match.starts_at ? new Date(match.starts_at).getTime() : null;
  const now = Date.now();

  if (liveWindow.scoreLocked) {
    return "locked";
  }

  if (liveWindow.currentBall !== null || (startsAt && now >= startsAt)) {
    return "live";
  }

  return match.status || "scheduled";
}

function labelizeStatus(status) {
  if (!status) {
    return "Scheduled";
  }

  if (status === "finalizing") {
    return "Finalizing";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function isCoreLocked(match, prediction) {
  return getLiveWindowState(match, prediction).coreLocked;
}

function isScoreLocked(match, prediction) {
  return getLiveWindowState(match, prediction).scoreLocked;
}

function getCurrentUserPoints() {
  const row = state.leaderboard.find((entry) => entry.user_id === state.user?.id);
  return row?.total_points ?? 0;
}

function getLeagueFocusMatch() {
  return getCurrentActionMatch();
}

function getCompletedMatchCount() {
  return state.matches.filter((match) => isFinishedMatchStatus(computeMatchStatus(match))).length;
}

function getLeaguePulseCopy(leagueEnded, leader, focusMatch) {
  if (leagueEnded && leader) {
    return `${leader.display_name} closed this season on top. The league is frozen and the result is now part of the record.`;
  }

  if (focusMatch) {
    const status = computeMatchStatus(focusMatch);
    if (status === "live" || status === "locked") {
      return `${focusMatch.team_a} vs ${focusMatch.team_b} is the pressure point right now. Picks, score windows, and auto-scoring all revolve around this fixture.`;
    }

    if (status === "finalizing") {
      return `${focusMatch.team_a} vs ${focusMatch.team_b} has finished on the field. The official scorecard is still settling, so points will land as soon as that write completes.`;
    }

    return `${focusMatch.team_a} vs ${focusMatch.team_b} is the next big decision. Players can see the full squad early, then the 3.1 and 7.1 locks keep the round fair.`;
  }

  return "Create the room once, bring everyone in with one code, and let the app run the match-day pressure from there.";
}

function getHeroStatusLabel(focusMatch) {
  if (!focusMatch) {
    return "League ready";
  }

  const status = computeMatchStatus(focusMatch);
  if (status === "live" || status === "locked") {
    return "Match in motion";
  }

  if (status === "finalizing") {
    return "Result finalizing";
  }

  if (status === "completed") {
    return "Result archived";
  }

  return "Next fixture lined up";
}

function renderLeaderboardRow(entry, index) {
  const sameUser = entry.user_id === state.user?.id;
  const displayName = entry.display_name || "Player";
  const avatarUrl =
    entry.avatar_url ||
    (sameUser ? state.profile?.avatar_url || getUserAvatarUrl(state.user) : "");

  return `
    <div class="leaderboard-item ${sameUser ? "current-user" : ""} ${index < 3 ? `leaderboard-top leaderboard-top-${index + 1}` : ""}">
      <div class="leaderboard-main">
        <div class="leaderboard-headline">
          <div class="leaderboard-rank">${index + 1}</div>
          ${renderMemberAvatar(displayName, "md", "", avatarUrl)}
          <div class="leaderboard-summary">
            <div class="prediction-row-head">
              <strong>${escapeHtml(displayName)}</strong>
              ${sameUser ? `<span class="tag tag-member">You</span>` : ""}
            </div>
            <div class="leaderboard-meta">
              <span class="subtle">${entry.matches_joined || 0} matches joined</span>
              <span class="subtle">${entry.role}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="leaderboard-points">
        <strong>${escapeHtml(entry.total_points ?? 0)}</strong>
        <span class="subtle">total points</span>
      </div>
    </div>
  `;
}

function buildLeaderboardFromMatches(members, predictions, matches, pointAdjustments = []) {
  const rows = members.map((member) => ({
    league_id: member.league_id,
    user_id: member.user_id,
    display_name: member.display_name,
    avatar_url: member.avatar_url || null,
    role: member.role,
    matches_joined: 0,
    batsman_points: 0,
    bowler_points: 0,
    score_points: 0,
    team_points: 0,
    manual_points: 0,
    total_points: 0,
  }));

  const rowByUserId = Object.fromEntries(rows.map((row) => [row.user_id, row]));
  const predictionsByMatchId = new Map();

  for (const prediction of predictions) {
    const entries = predictionsByMatchId.get(prediction.match_id) || [];
    entries.push(prediction);
    predictionsByMatchId.set(prediction.match_id, entries);
  }

  for (const prediction of predictions) {
    const row = rowByUserId[prediction.user_id];
    const match = matches.find((item) => item.id === prediction.match_id);
    const result = getMatchResult(match);

    if (!row) {
      continue;
    }

    row.matches_joined += 1;

    if (!result || match?.status === "cancelled") {
      continue;
    }

    const batsmanKey = resolvePlayerCanonicalKey(prediction.batsman_name, match);
    const bowlerKey = resolvePlayerCanonicalKey(prediction.bowler_name, match);
    row.batsman_points += getPlayerStatValue(result.batsman_runs, prediction.batsman_name, match);
    row.bowler_points += getPlayerStatValue(result.bowler_wickets, prediction.bowler_name, match) * 20;
    row.score_points += calculateScorePointsForPrediction(
      prediction,
      result,
      predictionsByMatchId.get(prediction.match_id) || [],
    );
    row.team_points += result.winner_team === prediction.team_pick ? 50 : 0;
  }

  for (const adjustment of pointAdjustments) {
    const row = rowByUserId[adjustment.user_id];
    if (!row) {
      continue;
    }

    row.manual_points += Number(adjustment.points_delta || 0);
  }

  for (const row of rows) {
    row.total_points =
      row.batsman_points +
      row.bowler_points +
      row.score_points +
      row.team_points +
      row.manual_points;
  }

  return rows.sort(
    (left, right) => right.total_points - left.total_points || left.display_name.localeCompare(right.display_name),
  );
}

function hasCricketApiConfig() {
  return !state.demoMode;
}

async function ensureOfficialTeamSquadsForMatches(matches) {
  const relevantMatches = asArray(matches).filter((match) => match?.team_a && match?.team_b);
  if (!relevantMatches.length) {
    return;
  }

  const seasonYear = getTargetSeasonYear();
  const teamsToFetch = Array.from(
    new Set(relevantMatches.flatMap((match) => [match.team_a, match.team_b])),
  ).filter((teamName) => {
    const teamKey = normalizeName(teamName);
    const retryAfter = Number(state.teamSquadRetryAfter[teamKey] || 0);
    return (
      teamKey &&
      !Object.prototype.hasOwnProperty.call(state.teamSquads, teamKey) &&
      Date.now() >= retryAfter &&
      !state.loadingTeamSquads.has(teamKey) &&
      Boolean(resolveOfficialTeamSlug(teamName))
    );
  });

  if (!teamsToFetch.length) {
    return;
  }

  for (const teamName of teamsToFetch) {
    state.loadingTeamSquads.add(normalizeName(teamName));
  }

  let needsRender = false;

  try {
    const results = await Promise.allSettled(
      teamsToFetch.map((teamName) => fetchOfficialTeamSquad(teamName, seasonYear)),
    );

    results.forEach((result, index) => {
      const teamName = teamsToFetch[index];
      const teamKey = normalizeName(teamName);

      if (result.status === "fulfilled") {
        state.teamSquads[teamKey] = result.value;
        delete state.teamSquadRetryAfter[teamKey];
        needsRender = true;
        return;
      }

      console.warn(`Official team squad fetch failed for ${teamName}`, result.reason);
      delete state.teamSquads[teamKey];
      state.teamSquadRetryAfter[teamKey] = Date.now() + TEAM_SQUAD_RETRY_COOLDOWN_MS;
      needsRender = true;
    });
  } finally {
    for (const teamName of teamsToFetch) {
      state.loadingTeamSquads.delete(normalizeName(teamName));
    }

    if (needsRender) {
      render();
    }
  }
}

function resolveOfficialTeamSlug(teamName) {
  return OFFICIAL_IPL_TEAM_SLUGS[normalizeName(teamName)] || null;
}

async function fetchOfficialTeamSquad(teamName, seasonYear) {
  const teamSlug = resolveOfficialTeamSlug(teamName);
  if (!teamSlug) {
    return [];
  }

  if (shouldUseServerProxy()) {
    const proxyUrl = new URL("/api/official-ipl", window.location.origin);
    proxyUrl.searchParams.set("kind", "team-squad");
    proxyUrl.searchParams.set("teamSlug", teamSlug);
    proxyUrl.searchParams.set("season", seasonYear);

    const response = await fetch(proxyUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Official squad proxy returned ${response.status}.`);
    }

    const payload = await response.json();
    const players = normalizePlayerList(payload?.players, teamName);
    if (players.length < MIN_OFFICIAL_TEAM_SQUAD_SIZE) {
      throw new Error(`Official squad payload for ${teamName} only returned ${players.length} players.`);
    }

    return players;
  }

  const squadUrl = `https://www.iplt20.com/teams/${teamSlug}/squad/${seasonYear}`;
  const response = await fetch(squadUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Official squad page returned ${response.status}.`);
  }

  const html = await response.text();
  const players = normalizePlayerList(parseOfficialTeamSquadHtml(html), teamName);
  if (players.length < MIN_OFFICIAL_TEAM_SQUAD_SIZE) {
    throw new Error(`Official squad page for ${teamName} only returned ${players.length} players.`);
  }

  return players;
}

function parseOfficialTeamSquadHtml(source) {
  const cards = Array.from(
    String(source || "").matchAll(/<li class="dys-box-color ih-pcard1"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g),
  );
  const seen = new Set();
  const players = [];

  for (const [, block] of cards) {
    const name = decodeHtmlEntities(
      block.match(/data-player_name="([^"]+)"/)?.[1] ||
        block.match(/<div class="ih-p-name">\s*<h2>\s*([^<]+?)\s*<\/h2>/)?.[1] ||
        "",
    );
    const role = decodeHtmlEntities(
      block.match(/<span class="d-block w-100 text-center">\s*([^<]+?)\s*<\/span>/)?.[1] || "",
    );
    const image = extractOfficialPlayerImageFromHtml(block);
    const normalizedName = normalizeName(name);

    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    players.push({
      name: cleanText(name, 80),
      role: cleanNullableText(role, 40),
      image: cleanNullableText(image, 500),
    });
  }

  return players;
}

function extractOfficialPlayerImageFromHtml(block) {
  const source = String(block || "");
  const playerImageBlock =
    source.match(/<div class="ih-p-img">([\s\S]*?)<\/div>/i)?.[1] || source;

  const quotedCandidates = Array.from(
    playerImageBlock.matchAll(/\b(?:data-src|data-lazy-src|data-image|src)\s*=\s*"([^"]+)"/gi),
  ).map((match) => decodeHtmlEntities(match[1]));
  const singleQuotedCandidates = Array.from(
    playerImageBlock.matchAll(/\b(?:data-src|data-lazy-src|data-image|src)\s*=\s*'([^']+)'/gi),
  ).map((match) => decodeHtmlEntities(match[1]));
  const srcSetCandidate = decodeHtmlEntities(
    playerImageBlock.match(/\bsrcset\s*=\s*"([^"]+)"/i)?.[1]?.split(",")?.[0]?.trim()?.split(/\s+/)?.[0] || "",
  );

  const candidates = [...quotedCandidates, ...singleQuotedCandidates, srcSetCandidate].filter(Boolean);
  return resolveOfficialPlayerImageUrl(candidates[candidates.length - 1] || "");
}

function resolveOfficialPlayerImageUrl(value) {
  const raw = cleanNullableText(value, 500);
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  if (raw.startsWith("/")) {
    return `${IPL_OFFICIAL_TEAM_SITE_ORIGIN}${raw}`;
  }

  if (/^[^/]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(raw)) {
    return `${IPL_OFFICIAL_PLAYER_IMAGE_BASE_URL}${raw}`;
  }

  return raw;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function findPredictionConflict(matchId, draftPrediction) {
  if (!matchId) {
    return null;
  }

  const match = state.matches.find((entry) => entry.id === matchId) || null;
  const selfUserId = state.user?.id;
  const otherPredictions = getPredictionsForMatch(matchId).filter(
    (entry) => entry.user_id !== selfUserId,
  );
  const batsmanKey = resolvePlayerCanonicalKey(draftPrediction?.batsman_name, match);
  const bowlerKey = resolvePlayerCanonicalKey(draftPrediction?.bowler_name, match);
  const predictedScore = Number(draftPrediction?.predicted_score);

  if (
    batsmanKey &&
    bowlerKey &&
    otherPredictions.some(
      (entry) =>
        resolvePlayerCanonicalKey(entry.batsman_name, match) === batsmanKey &&
        resolvePlayerCanonicalKey(entry.bowler_name, match) === bowlerKey,
    )
  ) {
    return {
      key: `combo:${matchId}:${batsmanKey}:${bowlerKey}`,
      message: "Same batsman-bowler combination exists for this match. Choose a different pair.",
    };
  }

  if (
    Number.isFinite(predictedScore) &&
    otherPredictions.some((entry) => Number(entry.predicted_score) === predictedScore)
  ) {
    return {
      key: `score:${matchId}:${predictedScore}`,
      message: "That score prediction has already been taken.",
    };
  }

  return null;
}

function maybeWarnPredictionConflict(form) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (form.id !== "core-prediction-form" && form.id !== "score-prediction-form") {
    return;
  }

  const formData = new FormData(form);
  const conflict = findPredictionConflict(String(formData.get("match_id") || ""), {
    batsman_name: cleanNullableText(formData.get("batsman_name"), 80),
    bowler_name: cleanNullableText(formData.get("bowler_name"), 80),
    predicted_score: (() => {
      const raw = String(formData.get("predicted_score") || "").trim();
      return /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : null;
    })(),
  });

  const conflictKey = conflict?.key || null;
  if (!conflictKey) {
    state.lastPredictionConflictKey = null;
    return;
  }

  if (state.lastPredictionConflictKey === conflictKey) {
    return;
  }

  state.lastPredictionConflictKey = conflictKey;
  showTransientToast(
    conflict.message || "Same batsman-bowler combination exists for this match. Choose a different pair.",
    "error",
  );
}

function calculateScorePointsForPrediction(prediction, result, matchPredictions) {
  const actualScore = Number(result?.first_innings_total);
  if (!Number.isFinite(actualScore)) {
    return 0;
  }

  const winningPredictionIds = getScorePredictionWinnerIds(matchPredictions, actualScore);
  if (!winningPredictionIds.length || !prediction?.id || !winningPredictionIds.includes(prediction.id)) {
    return 0;
  }

  return Math.floor(10 / winningPredictionIds.length);
}

function getScorePredictionWinnerIds(matchPredictions, actualScore) {
  const validPredictions = asArray(matchPredictions)
    .map((entry) => ({
      id: entry?.id || null,
      predictedScore:
        entry?.predicted_score === null ||
        entry?.predicted_score === undefined ||
        String(entry.predicted_score).trim() === "" ||
        !/^\d+$/.test(String(entry.predicted_score).trim())
          ? null
          : Number.parseInt(String(entry.predicted_score).trim(), 10),
      scoreSubmittedAt: entry?.score_submitted_at ? new Date(entry.score_submitted_at).getTime() : null,
      createdAt: entry?.created_at ? new Date(entry.created_at).getTime() : null,
    }))
    .filter((entry) => entry.id && Number.isFinite(entry.predictedScore));

  if (!validPredictions.length) {
    return [];
  }

  const exactPredictions = validPredictions.filter((entry) => entry.predictedScore === actualScore);
  if (exactPredictions.length) {
    return exactPredictions.map((entry) => entry.id);
  }

  const bestDelta = Math.min(
    ...validPredictions.map((entry) => Math.abs(entry.predictedScore - actualScore)),
  );

  return validPredictions
    .filter((entry) => Math.abs(entry.predictedScore - actualScore) === bestDelta)
    .map((entry) => entry.id);
}

function getLiveWindowState(match, prediction) {
  const currentBall =
    toOptionalInteger(match?.current_innings_ball) ??
    oversToBalls(match?.current_over_display);
  const currentOverDisplay =
    cleanNullableText(match?.current_over_display, 20) ||
    (currentBall !== null ? formatBallsAsOvers(currentBall) : null);
  const submissionStartsAt = null;
  const submissionWindowOpen = true;
  const coreLockedByTime = match?.picks_deadline_at
    ? Date.now() > new Date(match.picks_deadline_at).getTime()
    : false;
  const scoreLockedByTime = match?.score_deadline_at
    ? Date.now() > new Date(match.score_deadline_at).getTime()
    : false;
  const scoreWindowOpenByTime = match?.picks_deadline_at
    ? Date.now() >= new Date(match.picks_deadline_at).getTime()
    : false;
  const coreLocked =
    currentBall !== null ? currentBall >= CORE_LOCK_BALL : coreLockedByTime;
  const scoreLocked = currentBall !== null ? currentBall >= SCORE_LOCK_BALL : scoreLockedByTime;
  const scoreWindowOpen =
    !scoreLocked &&
    (currentBall !== null ? currentBall >= CORE_LOCK_BALL : scoreWindowOpenByTime);
  const coreWindowOpen = !coreLocked;

  return {
    currentBall,
    currentOverDisplay,
    submissionStartsAt,
    submissionWindowOpen,
    coreWindowOpen,
    scoreWindowOpen,
    coreLocked,
    scoreLocked,
    allWindowsLocked: coreLocked && scoreLocked,
  };
}

function formatCoreLockLabel(match, liveWindow) {
  if (liveWindow.currentBall !== null) {
    return liveWindow.coreLocked
      ? `Locked at 3.1 overs (${liveWindow.currentOverDisplay || "live"})`
      : `Open until 3.1 overs (${liveWindow.currentOverDisplay || "live"})`;
  }

  return liveWindow.coreLocked
    ? `Locked ${formatDate(match?.picks_deadline_at) || "after 3.1 overs"}`
    : `Open until ${formatDate(match?.picks_deadline_at) || "3.1 overs"}`;
}

function formatScoreLockLabel(match, liveWindow) {
  if (liveWindow.currentBall !== null) {
    return liveWindow.scoreLocked
      ? `Locked at 7.1 overs (${liveWindow.currentOverDisplay || "live"})`
      : `Open until 7.1 overs (${liveWindow.currentOverDisplay || "live"})`;
  }

  if (!liveWindow.scoreWindowOpen && !liveWindow.scoreLocked) {
    return `Opens after ${formatDate(match?.picks_deadline_at) || "3.1 overs"}`;
  }

  return liveWindow.scoreLocked
    ? `Locked ${formatDate(match?.score_deadline_at) || "after 7.1 overs"}`
    : `Open until ${formatDate(match?.score_deadline_at) || "7.1 overs"}`;
}

function getPlayingXiGroups(match) {
  const payload = match?.playing_xi && typeof match.playing_xi === "object"
    ? match.playing_xi
    : buildEmptyPlayingXi();
  const officialTeamA = getOfficialTeamSquad(match?.team_a);
  const officialTeamB = getOfficialTeamSquad(match?.team_b);

  return [
    {
      teamName: match?.team_a || "Team A",
      players: officialTeamA.length
        ? officialTeamA
        : normalizePlayerList(payload.team_a, match?.team_a || "Team A"),
    },
    {
      teamName: match?.team_b || "Team B",
      players: officialTeamB.length
        ? officialTeamB
        : normalizePlayerList(payload.team_b, match?.team_b || "Team B"),
    },
  ];
}

function getSelectablePlayers(match, role, prediction) {
  return getPlayingXiGroups(match).map((group) => ({
    teamName: group.teamName,
    players: group.players.filter((player) => playerSupportsSelectionRole(player, role)),
  }));
}

function getSelectablePlayerCount(groups) {
  return asArray(groups).reduce((count, group) => count + asArray(group.players).length, 0);
}

function renderPlayerSelectOptions(placeholder, groups, selectedValue) {
  const selectedKey = normalizeName(selectedValue);
  let foundSelected = false;

  const options = groups
    .map((group) => {
      const items = group.players
        .map((player) => {
          const playerKey = normalizeName(player.name);
          const isSelected = playerKey === selectedKey;
          if (isSelected) {
            foundSelected = true;
          }

          return `<option value="${escapeAttribute(player.name)}" ${
            isSelected ? "selected" : ""
          }>${escapeHtml(player.name)}</option>`;
        })
        .join("");

      if (!items) {
        return "";
      }

      return `<optgroup label="${escapeAttribute(group.teamName)}">${items}</optgroup>`;
    })
    .join("");

  const savedOption =
    selectedValue && !foundSelected
      ? `<option value="${escapeAttribute(selectedValue)}" selected>${escapeHtml(
          `${selectedValue} (saved pick)`,
        )}</option>`
      : "";

  return `<option value="">${escapeHtml(placeholder)}</option>${savedOption}${options}`;
}

function renderPredictionPlayerInput({
  match,
  fieldId,
  fieldName,
  label,
  placeholder,
  groups,
  selectedValue,
  disabled,
  helperText,
}) {
  const totalPlayers = getSelectablePlayerCount(groups);
  const hasValue = Boolean(selectedValue);
  const selectedMeta = getPlayerMeta(match, selectedValue);
  const sublabel = hasValue
    ? [selectedMeta?.team ? getTeamShortCode(selectedMeta.team) : "", selectedMeta?.role || ""]
        .filter(Boolean)
        .join(" · ")
    : `${totalPlayers} official options`;

  return `
    <div class="field prediction-player-field">
      <label for="${escapeAttribute(`${fieldId}-trigger`)}">${escapeHtml(label)}</label>
      <input
        id="${escapeAttribute(fieldId)}"
        type="hidden"
        name="${escapeAttribute(fieldName)}"
        value="${escapeAttribute(selectedValue || "")}"
        ${disabled ? "disabled" : ""}
      />
      <button
        id="${escapeAttribute(`${fieldId}-trigger`)}"
        class="player-picker-trigger ${hasValue ? "has-value" : ""}"
        type="button"
        data-action="open-player-picker"
        data-match-id="${escapeAttribute(match?.id || "")}"
        data-field-name="${escapeAttribute(fieldName)}"
        ${disabled ? "disabled" : ""}
      >
        <span class="player-picker-trigger-main">
          ${
            hasValue
              ? renderPlayerAvatar(match, selectedValue, {
                  size: "sm",
                  teamName: selectedMeta?.team || "",
                })
              : `<span class="player-picker-trigger-placeholder">${escapeHtml(label.slice(0, 1))}</span>`
          }
          <span class="player-picker-trigger-copy">
            <strong>${escapeHtml(hasValue ? selectedValue : placeholder)}</strong>
            <small>${escapeHtml(sublabel || helperText || `${totalPlayers} official options ready`)}</small>
          </span>
        </span>
        <span class="player-picker-trigger-chevron" aria-hidden="true">▾</span>
      </button>
      <span class="field-helper">${escapeHtml(helperText || `${totalPlayers} official options ready`)}</span>
    </div>
  `;
}

function getPlayerPickerMeta(fieldName) {
  if (fieldName === "batsman_name") {
    return {
      label: "Batsman",
      searchPlaceholder: "Search official batting options",
      role: "batsman",
    };
  }

  return {
    label: "Bowler",
    searchPlaceholder: "Search official bowling options",
    role: "bowler",
  };
}

function getPlayerPickerConfig() {
  const picker = state.playerPicker;
  if (!picker?.matchId || !picker?.fieldName) {
    return null;
  }

  const match = state.matches.find((entry) => entry.id === picker.matchId);
  if (!match) {
    return null;
  }

  const meta = getPlayerPickerMeta(picker.fieldName);
  const groups = getSelectablePlayers(match, meta.role);
  return {
    ...picker,
    ...meta,
    match,
    groups,
    totalPlayers: getSelectablePlayerCount(groups),
    selectedValue: getEditablePrediction(match.id)?.[picker.fieldName] || "",
  };
}

function renderPlayerPickerDialog() {
  const picker = getPlayerPickerConfig();
  if (!picker) {
    return "";
  }

  const selectedMeta = getPlayerMeta(picker.match, picker.selectedValue);
  const groupsMarkup = picker.groups
    .map((group) => {
      const options = group.players
        .map((player) => {
          const isSelected = playerNamesMatch(player.name, picker.selectedValue);
          const searchText = cleanText(
            `${player.name} ${group.teamName} ${getTeamShortCode(group.teamName)} ${player.role || ""}`,
            240,
          ).toLowerCase();
          return `
            <button
              class="player-picker-option ${isSelected ? "selected" : ""}"
              type="button"
              data-action="select-player-option"
              data-match-id="${escapeAttribute(picker.match.id)}"
              data-field-name="${escapeAttribute(picker.fieldName)}"
              data-player-name="${escapeAttribute(player.name)}"
              data-player-option-search="${escapeAttribute(searchText)}"
            >
              ${renderPlayerAvatar(picker.match, player.name, { size: "sm", teamName: group.teamName })}
              <span class="player-picker-option-copy">
                <strong>${escapeHtml(cleanMatchPlayerName(player.name))}</strong>
                <small>${escapeHtml(
                  [getTeamShortCode(group.teamName), player.role || ""].filter(Boolean).join(" · "),
                )}</small>
              </span>
              ${isSelected ? `<span class="player-picker-option-check">Selected</span>` : ""}
            </button>
          `;
        })
        .join("");

      if (!options) {
        return "";
      }

      return `
        <section class="player-picker-group" data-player-group>
          <div class="player-picker-group-title">
            ${renderTeamMark(group.teamName, "xs")}
            <span>${escapeHtml(group.teamName)}</span>
          </div>
          <div class="player-picker-group-options">
            ${options}
          </div>
        </section>
      `;
    })
    .join("");

  return `
    <div class="dialog-layer player-picker-layer">
      <button class="dialog-backdrop" type="button" data-action="close-player-picker" aria-label="Close player picker"></button>
      <section
        class="dialog-card player-picker-dialog"
        data-total-options="${escapeAttribute(String(picker.totalPlayers))}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-picker-title"
      >
        <div class="dialog-head player-picker-head">
          <div>
            <span class="panel-kicker">${escapeHtml(picker.label)}</span>
            <h3 id="player-picker-title">Choose ${escapeHtml(picker.label.toLowerCase())}</h3>
            <p>${escapeHtml(`${picker.totalPlayers} official options across both teams.`)}</p>
          </div>
          <button class="dialog-close" type="button" data-action="close-player-picker" aria-label="Close player picker">×</button>
        </div>
        <div class="player-picker-toolbar">
          <label class="player-picker-search">
            <span class="sr-only">Search ${escapeHtml(picker.label.toLowerCase())}</span>
            <input
              id="player-picker-search"
              type="text"
              autocomplete="off"
              autocapitalize="words"
              spellcheck="false"
              placeholder="${escapeAttribute(picker.searchPlaceholder)}"
              data-player-picker-search="true"
              autofocus
            />
          </label>
          ${
            picker.selectedValue
              ? `
                <button
                  class="ghost-btn player-picker-clear"
                  type="button"
                  data-action="clear-player-option"
                  data-match-id="${escapeAttribute(picker.match.id)}"
                  data-field-name="${escapeAttribute(picker.fieldName)}"
                >
                  Clear
                </button>
              `
              : ""
          }
        </div>
        ${
          picker.selectedValue
            ? `
              <div class="player-picker-selected-strip">
                ${renderPlayerAvatar(picker.match, picker.selectedValue, { size: "sm", teamName: selectedMeta?.team || "" })}
                <div>
                  <strong>${escapeHtml(cleanMatchPlayerName(picker.selectedValue))}</strong>
                  <small>${escapeHtml(
                    [selectedMeta?.team ? getTeamShortCode(selectedMeta.team) : "", selectedMeta?.role || ""]
                      .filter(Boolean)
                      .join(" · ") || "Current pick",
                  )}</small>
                </div>
              </div>
            `
            : ""
        }
        <div class="player-picker-results-head">
          <span data-player-picker-count>${escapeHtml(`${picker.totalPlayers} official options`)}</span>
        </div>
        <div class="player-picker-list">
          ${groupsMarkup}
          <div class="empty-state player-picker-empty" data-player-picker-empty hidden>No matching players found. Try a shorter search.</div>
        </div>
      </section>
    </div>
  `;
}

function setPredictionDraftField(matchId, fieldName, value) {
  if (!matchId || !fieldName) {
    return;
  }

  const editablePrediction = getEditablePrediction(matchId) || {};
  const nextValue = cleanNullableText(value, 80);
  const draft = {
    batsman_name: cleanNullableText(
      fieldName === "batsman_name" ? nextValue : editablePrediction.batsman_name,
      80,
    ),
    bowler_name: cleanNullableText(
      fieldName === "bowler_name" ? nextValue : editablePrediction.bowler_name,
      80,
    ),
    team_pick: cleanNullableText(editablePrediction.team_pick, 80),
    predicted_score:
      editablePrediction.predicted_score !== null &&
      editablePrediction.predicted_score !== undefined &&
      /^\d+$/.test(String(editablePrediction.predicted_score).trim())
        ? Number.parseInt(String(editablePrediction.predicted_score).trim(), 10)
        : null,
  };

  state.predictionDrafts[matchId] = draft;
}

function filterPlayerPickerOptions(query) {
  const dialog = document.querySelector(".player-picker-dialog");
  if (!(dialog instanceof HTMLElement)) {
    return;
  }

  const normalizedQuery = cleanText(query, 120).toLowerCase();
  let visibleCount = 0;

  dialog.querySelectorAll("[data-player-group]").forEach((group) => {
    let groupVisibleCount = 0;

    group.querySelectorAll("[data-player-option-search]").forEach((option) => {
      const searchText = String(option.getAttribute("data-player-option-search") || "");
      const visible = !normalizedQuery || searchText.includes(normalizedQuery);
      option.hidden = !visible;
      if (visible) {
        groupVisibleCount += 1;
      }
    });

    group.hidden = groupVisibleCount === 0;
    visibleCount += groupVisibleCount;
  });

  const countLabel = dialog.querySelector("[data-player-picker-count]");
  if (countLabel) {
    countLabel.textContent = normalizedQuery
      ? `${visibleCount} matching players`
      : `${dialog.getAttribute("data-total-options") || visibleCount} official options`;
  }

  const emptyState = dialog.querySelector("[data-player-picker-empty]");
  if (emptyState instanceof HTMLElement) {
    emptyState.hidden = visibleCount > 0;
  }
}

function getMatchSyncSummary(match) {
  const liveWindow = getLiveWindowState(match, null);
  const squadGroups = getPlayingXiGroups(match);
  const playerCount = squadGroups.reduce(
    (count, group) => count + group.players.length,
    0,
  );
  const usingOfficialTeamSquads = squadGroups.every((group) => {
    const officialPlayers = getOfficialTeamSquad(group.teamName);
    return officialPlayers.length > 0;
  });
  const sourceLabel =
    match?.provider === "ipl-official"
      ? "Official IPL"
      : match?.provider === "hybrid"
        ? "Official IPL"
        : match?.external_match_id
          ? "Official IPL"
          : "Manual";
  const status = computeMatchStatus(match);
  const syncedAt = match?.last_synced_at ? new Date(match.last_synced_at).getTime() : null;
  const syncAgeMs = syncedAt && !Number.isNaN(syncedAt) ? Math.max(0, Date.now() - syncedAt) : null;
  const activeWindow = status === "live" || status === "locked" || status === "finalizing";
  const freshnessThresholdMs = activeWindow ? 25 * 1000 : 2 * 60 * 1000;
  const warmThresholdMs = activeWindow ? 90 * 1000 : 10 * 60 * 1000;

  let freshnessLabel = match?.external_match_id ? "Waiting for sync" : "Manual update";
  let freshnessTone = match?.external_match_id ? "stale" : "manual";
  let freshnessDetail = match?.external_match_id
    ? "No live provider update has landed yet."
    : "This fixture is controlled manually, so there is no live feed freshness to report.";

  if (syncAgeMs !== null) {
    const ageLabel = formatRelativeAge(syncAgeMs);
    if (syncAgeMs <= freshnessThresholdMs) {
      freshnessLabel = "Fresh now";
      freshnessTone = "fresh";
      freshnessDetail = `Live data updated ${ageLabel}.`;
    } else if (syncAgeMs <= warmThresholdMs) {
      freshnessLabel = activeWindow ? "Watching feed" : "Recently synced";
      freshnessTone = "warm";
      freshnessDetail = `Latest provider update landed ${ageLabel}.`;
    } else {
      freshnessLabel = "Sync stale";
      freshnessTone = "stale";
      freshnessDetail = `The last provider update was ${ageLabel}.`;
    }
  }

  let settlementLabel = "Awaiting finish";
  let settlementTone = "warm";
  let settlementDetail = "Points settle automatically once the official completed scorecard lands.";

  if (isMatchSettled(match)) {
    settlementLabel = "Settled";
    settlementTone = "fresh";
    settlementDetail = "Official results are written and the leaderboard is ready.";
  } else if (status === "finalizing") {
    settlementLabel = "Finalizing";
    settlementTone = "finalizing";
    settlementDetail = "The match has finished, but the official result is still being written into league scoring.";
  } else if (status === "cancelled") {
    settlementLabel = "Cancelled";
    settlementTone = "stale";
    settlementDetail = "This fixture is cancelled, so no settlement will run.";
  }

  return {
    source: sourceLabel,
    playingXiLabel: playerCount
      ? usingOfficialTeamSquads
        ? `${playerCount} official squad players ready`
        : `${playerCount} provider players ready`
      : isOfficialTeamSquadLoading(match)
        ? "Loading official team squads"
        : "Waiting for official team squads",
    liveClock: liveWindow.currentOverDisplay
      ? `${liveWindow.currentOverDisplay} overs`
      : match?.innings_started_at
        ? "Innings started"
        : "Not started",
    lastSynced: formatDate(match?.last_synced_at) || "Not synced yet",
    freshnessLabel,
    freshnessTone,
    freshnessDetail,
    settlementLabel,
    settlementTone,
    settlementDetail,
  };
}

function shouldAutoSyncMatch(match) {
  if (!match?.external_match_id || !match?.auto_sync_enabled || getMatchResult(match)) {
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

async function loadProviderFixtures({ quiet = false, flashSuccess = true } = {}) {
  state.loadingProviderFixtures = true;
  render();

  try {
    const { fixtures, warning } = await fetchProviderFixtures();
    const existingMatchMap = new Map(
      state.matches
        .filter((item) => item.external_match_id)
        .map((item) => [String(item.external_match_id), item]),
    );
    const existingIdentityMap = new Map(
      state.matches.map((item) => [buildFixtureIdentityKey(item), item]),
    );

    let created = 0;
    let updated = 0;

    for (const fixture of fixtures) {
      const existingMatch =
        (fixture.external_match_id
          ? existingMatchMap.get(String(fixture.external_match_id))
          : null) || existingIdentityMap.get(buildFixtureIdentityKey(fixture));
      await upsertSyncedMatchRow(existingMatch, fixture);
      if (existingMatch) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    state.providerFixtures = fixtures;
    await loadLeagueBundle();
    state.selectedMatchId = chooseDefaultMatchId(state.matches);
    await syncTrackedMatches({ quiet: true });
    await loadLeagueBundle();
    render();

    if (flashSuccess && !quiet) {
      const successMessage = warning
        ? `IPL schedule synced. ${created} created, ${updated} refreshed. ${warning}`
        : `IPL schedule synced. ${created} created, ${updated} refreshed.`;
      flash(successMessage, warning ? "info" : "success");
    }
  } finally {
    state.loadingProviderFixtures = false;
    render();
  }
}

async function importProviderFixture(externalMatchId) {
  if (!externalMatchId) {
    throw new Error("Fixture ID is missing.");
  }

  const fixture = state.providerFixtures.find(
    (item) => String(item.external_match_id) === String(externalMatchId),
  );

  if (!fixture) {
    throw new Error("Fixture not found in the latest provider list.");
  }

  const existingMatch =
    state.matches.find((item) => String(item.external_match_id) === String(externalMatchId)) ||
    state.matches.find((item) => buildFixtureIdentityKey(item) === buildFixtureIdentityKey(fixture));

  const enrichedFixture = await enrichFixtureWithPlayingXi(fixture, existingMatch);
  const savedMatch = await upsertSyncedMatchRow(existingMatch, enrichedFixture);

  await loadLeagueBundle();
  state.selectedMatchId = savedMatch.id;
  render();
  flash(
    existingMatch ? "Match updated from the live feed." : "Match imported from the live feed.",
    "success",
  );
}

async function toggleAutoSync(matchId) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) {
    throw new Error("Match not found.");
  }

  const { error } = await state.client
    .from("matches")
    .update({ auto_sync_enabled: !match.auto_sync_enabled })
    .eq("id", matchId);

  if (error) {
    throw error;
  }

  await loadLeagueBundle();
  render();
  flash(match.auto_sync_enabled ? "Auto sync paused." : "Auto sync resumed.", "success");
}

async function cancelMatch(matchId) {
  const match = state.matches.find((entry) => entry.id === matchId) || null;
  if (!match) {
    throw new Error("Match not found.");
  }

  if (match.status === "cancelled") {
    flash("This match is already cancelled.", "info");
    return;
  }

  if (
    !window.confirm(
      "Are you sure you want to cancel this match? Any points already allocated from this fixture will be removed from the leaderboard.",
    )
  ) {
    return;
  }

  state.cancellingMatchIds.add(matchId);
  render();

  try {
    const { error } = await state.client.rpc("cancel_match", {
      p_match_id: matchId,
      p_notes: cleanNullableText(match.notes, 600),
    });

    if (error) {
      throw error;
    }

    applyCancelledMatchLocally(matchId);
    scheduleLeagueReload();
    flash("Match cancelled. This fixture no longer contributes any points.", "success");
  } finally {
    state.cancellingMatchIds.delete(matchId);
    render();
  }
}

async function syncTrackedMatches({ quiet = true } = {}) {
  if (state.autoSyncBusy) {
    return;
  }

  state.autoSyncBusy = true;

  try {
    const trackedMatches = state.matches.filter(shouldAutoSyncMatch);
    for (const match of trackedMatches) {
      await syncMatchFromProvider(match, {
        quiet,
        flashSuccess: false,
        background: true,
        skipReload: true,
      });
    }

    if (trackedMatches.length) {
      await loadLeagueBundle();
      render();
    }
  } finally {
    state.autoSyncBusy = false;
  }
}

async function syncMatchFromProvider(
  match,
  { quiet = false, flashSuccess = false, background = false, skipReload = false } = {},
) {
  if (!match?.external_match_id) {
    throw new Error("This match is not linked to a live provider yet.");
  }

  if (match.status === "cancelled") {
    throw new Error("Cancelled matches cannot be synced into scoring.");
  }

  if (state.demoMode) {
    throw new Error("Live sync is unavailable in demo mode.");
  }

  markMatchSyncing(match.id, true, background);

  try {
    const latestSnapshot = await fetchProviderMatchSnapshot(match.external_match_id, match);
    const enrichedSnapshot = await enrichFixtureWithPlayingXi(latestSnapshot, match);
    const providerStatus = computeProviderMatchStatus(enrichedSnapshot);

    if (providerStatus === "cancelled") {
      const providerCancelNote = cleanNullableText(
        [
          cleanNullableText(match.notes, 600),
          "Official IPL provider marked this fixture cancelled or abandoned.",
        ]
          .filter(Boolean)
          .join("\n\n"),
        600,
      );

      const { error } = await state.client.rpc("cancel_match", {
        p_match_id: match.id,
        p_notes: providerCancelNote,
      });

      if (error) {
        throw error;
      }

      applyCancelledMatchLocally(match.id, providerCancelNote);

      if (!skipReload) {
        scheduleLeagueReload();
      }

      if (flashSuccess) {
        flash(
          "Official IPL feed marked this fixture cancelled. Its points were removed automatically.",
          "info",
        );
      }

      return;
    }

    let settlementPreview = null;
    if (!getMatchResult(match) && computeProviderMatchStatus(enrichedSnapshot) === "completed") {
      try {
        settlementPreview = extractSettlementPayload(
          enrichedSnapshot?.official_scorecard_bundle ||
            (await fetchMatchScorecard(enrichedSnapshot.external_match_id)),
          match,
          enrichedSnapshot,
        );
      } catch (error) {
        console.warn("Settlement preview failed", error);
      }
    }

    await upsertSyncedMatchRow(match, {
      ...enrichedSnapshot,
      persisted_status: computePersistedProviderStatus(
        enrichedSnapshot,
        match,
        Boolean(settlementPreview),
      ),
    });

    if (!getMatchResult(match)) {
      await settleSyncedMatchIfReady(match, enrichedSnapshot);
    }

    if (!skipReload) {
      await loadLeagueBundle();
      render();
    }

    if (flashSuccess) {
      if (enrichedSnapshot?.live_feed_pending) {
        flash("Official live files are not published yet. Schedule and squads stay ready.", "info");
      } else {
        flash("Live match data synced.", "success");
      }
    }
  } catch (error) {
    await saveMatchSyncError(match.id, error);
    if (!quiet) {
      throw error;
    }
  } finally {
    markMatchSyncing(match.id, false, background);
  }
}

function applyCancelledMatchLocally(matchId, notes = null) {
  let changed = false;

  state.matches = state.matches.map((match) => {
    if (match.id !== matchId) {
      return match;
    }

    changed = true;
    return normalizeMatchRecord({
      ...match,
      status: "cancelled",
      auto_sync_enabled: false,
      current_innings_ball: null,
      current_over_display: null,
      sync_error: null,
      notes: notes ?? match.notes ?? null,
      match_results: null,
    });
  });

  if (!changed) {
    return;
  }

  if (state.predictionScorecardMatchId === matchId) {
    state.predictionScorecardMatchId = null;
  }

  state.leaderboard = buildLeaderboardFromMatches(
    state.members,
    state.predictions,
    state.matches,
    state.pointAdjustments,
  );
  syncRouteSelection();
}

function markMatchSyncing(matchId, isSyncing, background) {
  if (isSyncing) {
    state.syncingMatchIds.add(matchId);
  } else {
    state.syncingMatchIds.delete(matchId);
  }

  if (!background) {
    render();
  }
}

function markMatchSettling(matchId, isSettling) {
  if (isSettling) {
    state.settlingMatchIds.add(matchId);
  } else {
    state.settlingMatchIds.delete(matchId);
  }

  render();
}

async function saveMatchSyncError(matchId, error) {
  if (!matchId || !state.client) {
    return;
  }

  const message = cleanText(error?.message || "Sync failed.", 300);
  await state.client.from("matches").update({ sync_error: message }).eq("id", matchId);
}

async function upsertSyncedMatchRow(existingMatch, fixture) {
  const defaultNotes =
    "Match synced from the official IPL feeds for fixtures, match squads, innings clock, and automatic settlement.";
  const notes =
    !existingMatch?.notes ||
    /match synced from cricapi|match synced from the official ipl/i.test(
      existingMatch.notes,
    )
      ? defaultNotes
      : existingMatch.notes;
  const payload = buildMatchPayloadFromFixture(fixture, existingMatch, notes);

  if (existingMatch?.id) {
    const { data, error } = await state.client
      .from("matches")
      .update(payload)
      .eq("id", existingMatch.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await state.client
    .from("matches")
    .insert({
      ...payload,
      league_id: state.activeLeagueId,
      created_by: state.user.id,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function buildMatchPayloadFromFixture(fixture, existingMatch, notes) {
  const startsAt = fixture.starts_at || existingMatch?.starts_at;
  const nowIso = new Date().toISOString();

  return {
    title: fixture.title,
    team_a: fixture.team_a,
    team_b: fixture.team_b,
    venue: fixture.venue || null,
    starts_at: startsAt,
    innings_started_at:
      existingMatch?.innings_started_at ||
      (fixture.current_innings_ball !== null ? startsAt || nowIso : null),
    playing_xi_announced_at: existingMatch?.playing_xi_announced_at || null,
    picks_deadline_at:
      existingMatch?.picks_deadline_at || addMinutes(startsAt, 20) || startsAt,
    score_deadline_at:
      existingMatch?.score_deadline_at || addMinutes(startsAt, 45) || startsAt,
    status:
      cleanNullableText(fixture.persisted_status, 20) ||
      cleanNullableText(fixture.status, 20) ||
      existingMatch?.status ||
      "scheduled",
    notes,
    provider: fixture.provider || existingMatch?.provider || "manual",
    external_match_id:
      fixture.external_match_id || fixture.official_match_id || existingMatch?.external_match_id || null,
    series_name: fixture.series_name || existingMatch?.series_name || "Indian Premier League",
    playing_xi: fixture.playing_xi || existingMatch?.playing_xi || buildEmptyPlayingXi(),
    current_innings_ball:
      fixture.current_innings_ball !== undefined
        ? fixture.current_innings_ball
        : existingMatch?.current_innings_ball ?? null,
    current_over_display:
      fixture.current_over_display || existingMatch?.current_over_display || null,
    auto_sync_enabled: existingMatch?.auto_sync_enabled ?? true,
    last_synced_at: nowIso,
    sync_error: null,
  };
}

async function enrichFixtureWithPlayingXi(fixture, existingMatch) {
  if (!fixture?.external_match_id) {
    return fixture;
  }

  if (getPlayingXiPlayerCountFromPayload(existingMatch?.playing_xi) > 0) {
    return fixture;
  }

  if (!shouldAttemptPlayingXiSync(fixture)) {
    return fixture;
  }

  try {
    const playingXi = await fetchPlayingXiSnapshot(fixture.external_match_id, fixture);
    if (getPlayingXiPlayerCountFromPayload(playingXi) > 0) {
      return {
        ...fixture,
        playing_xi: playingXi,
      };
    }
  } catch (error) {
    console.warn("Squad sync skipped", error);
  }

  return fixture;
}

function shouldAttemptPlayingXiSync(fixture) {
  const status = computeProviderMatchStatus(fixture);
  if (status === "live" || status === "locked" || status === "completed") {
    return true;
  }

  const startsAt = fixture?.starts_at ? new Date(fixture.starts_at).getTime() : null;
  if (!startsAt || Number.isNaN(startsAt)) {
    return false;
  }

  return startsAt - Date.now() <= SQUAD_SYNC_LOOKAHEAD_MS;
}

async function settleSyncedMatchIfReady(match, snapshot, { throwWhenUnavailable = false } = {}) {
  if (match?.status === "cancelled") {
    if (throwWhenUnavailable) {
      throw new Error("Cancelled matches cannot be settled.");
    }

    return false;
  }

  const scorecard =
    snapshot?.official_scorecard_bundle || (await fetchMatchScorecard(snapshot.external_match_id));
  const settlement = extractSettlementPayload(scorecard, match, snapshot);

  if (settlement) {
    const { error } = await state.client.rpc("save_match_result", {
      p_match_id: match.id,
      p_winner_team: settlement.winner_team,
      p_first_innings_total: settlement.first_innings_total,
      p_batsman_runs: settlement.batsman_runs,
      p_bowler_wickets: settlement.bowler_wickets,
      p_notes: settlement.notes,
    });

    if (error) {
      throw error;
    }

    return true;
  }

  if (computeProviderMatchStatus(snapshot) !== "completed") {
    if (throwWhenUnavailable) {
      throw new Error("Official result is not ready yet for this match.");
    }

    return false;
  }

  if (throwWhenUnavailable) {
    throw new Error("Official IPL scorecard is available, but point extraction is still incomplete.");
  }

  return false;
}

async function calculateMatchPointsFromProvider(match) {
  if (!match?.external_match_id) {
    throw new Error("This match is not linked to an official feed yet.");
  }

  if (match.status === "cancelled") {
    throw new Error("Cancelled matches cannot be settled.");
  }

  markMatchSettling(match.id, true);

  try {
    const latestSnapshot = await fetchProviderMatchSnapshot(match.external_match_id, match);
    const enrichedSnapshot = await enrichFixtureWithPlayingXi(latestSnapshot, match);
    await upsertSyncedMatchRow(match, {
      ...enrichedSnapshot,
      persisted_status: computePersistedProviderStatus(enrichedSnapshot, match, false),
    });
    await settleSyncedMatchIfReady(match, enrichedSnapshot, { throwWhenUnavailable: true });
    await loadLeagueBundle();
    render();
    flash("Points calculated from the official IPL scorecard.", "success");
  } finally {
    markMatchSettling(match.id, false);
  }
}

function getTargetSeasonYear() {
  const seasonText = cleanText(getActiveLeague()?.season || "", 40);
  const explicitYear = seasonText.match(/\b(20\d{2})\b/)?.[1];
  return explicitYear || String(new Date().getUTCFullYear());
}

async function fetchTargetIplSeries(targetYear) {
  let bestMatch = null;

  for (let offset = 0; offset <= 500; offset += 25) {
    const payload = await fetchCricketApi("series", { offset });
    const seriesRows = asArray(payload?.data);

    for (const item of seriesRows) {
      const name = cleanText(item?.name, 160);
      const normalizedName = name.toLowerCase();
      if (!normalizedName.includes("indian premier league")) {
        continue;
      }

      if (normalizedName.includes(String(targetYear))) {
        return item;
      }

      if (!bestMatch) {
        bestMatch = item;
      }
    }

    if (!seriesRows.length) {
      break;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  throw new Error("Could not find the IPL series in the provider feed.");
}

async function fetchProviderFixtures() {
  const seriesYear = getTargetSeasonYear();
  const officialFixtures = await fetchOfficialIplFixtures(seriesYear);

  return {
    fixtures: officialFixtures.sort(
      (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    ),
    warning: null,
  };
}

async function fetchCricketApiSeasonFixtures(targetYear) {
  const series = await fetchTargetIplSeries(targetYear);
  const payload = await fetchCricketApi("series_info", { id: series.id });
  return asArray(payload?.data?.matchList)
    .map((raw) => normalizeProviderMatch({ ...raw, series: payload?.data?.info?.name || series.name }))
    .filter(Boolean);
}

async function fetchOfficialIplFixtures(targetYear) {
  const competition = await fetchOfficialIplCompetition(targetYear);
  const feedBaseUrl = String(competition?.feedsource || IPL_OFFICIAL_DEFAULT_FEED_BASE_URL).replace(
    /\/$/,
    "",
  );
  const payload = await fetchJsonpPayload(`${feedBaseUrl}/${competition.CompetitionID}-matchschedule.js`);
  return asArray(payload?.Matchsummary)
    .map((raw) => normalizeOfficialIplMatch(raw, competition))
    .filter(Boolean);
}

async function fetchOfficialIplCompetition(targetYear) {
  const payload = await fetchJsonpPayload(IPL_OFFICIAL_COMPETITION_URL);
  const competitions = asArray(payload?.competition);

  const exactMatch = competitions.find((item) => {
    const competitionName = cleanText(item?.CompetitionName, 120).toLowerCase();
    return competitionName.includes("ipl") && competitionName.includes(String(targetYear));
  });

  if (exactMatch) {
    return exactMatch;
  }

  const fallbackMatch = competitions.find((item) =>
    cleanText(item?.CompetitionName, 120).toLowerCase().includes("ipl"),
  );

  if (fallbackMatch) {
    return fallbackMatch;
  }

  throw new Error("Could not find the IPL competition in the official fixture feed.");
}

async function fetchJsonpPayload(url) {
  if (shouldUseServerProxy()) {
    const requestedUrl = new URL(url);
    const proxyUrl = new URL("/api/official-ipl", window.location.origin);

    if (requestedUrl.pathname.endsWith("/competition.js")) {
      proxyUrl.searchParams.set("kind", "competition");
    } else {
      const competitionMatch = requestedUrl.pathname.match(/\/(\d+)-matchschedule\.js$/i);
      if (!competitionMatch) {
        throw new Error("Unsupported official IPL feed path.");
      }

      proxyUrl.searchParams.set("kind", "schedule");
      proxyUrl.searchParams.set("competitionId", competitionMatch[1]);
      proxyUrl.searchParams.set(
        "feedBaseUrl",
        requestedUrl.toString().replace(/\/[^/]+$/, ""),
      );
    }

    const response = await fetch(proxyUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Official IPL proxy returned ${response.status}.`);
    }

    return response.json();
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/javascript, text/javascript, */*;q=0.1",
    },
  });

  if (!response.ok) {
    const error = new Error(`Official IPL feed returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  return parseJsonpPayload(text);
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

async function fetchOfficialFeedJson(kind, params = {}) {
  if (shouldUseServerProxy()) {
    const proxyUrl = new URL("/api/official-ipl", window.location.origin);
    proxyUrl.searchParams.set("kind", kind);

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }

      proxyUrl.searchParams.set(key, String(value));
    }

    const response = await fetch(proxyUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      let message = `Official IPL proxy returned ${response.status}.`;
      try {
        const payload = await response.json();
        if (payload?.error) {
          message = payload.error;
        }
      } catch (_error) {
        // Ignore invalid proxy error payloads and keep the generic message.
      }

      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  let path = "";
  if (kind === "match-summary") {
    path = `${IPL_OFFICIAL_DEFAULT_FEED_BASE_URL}/${params.matchId}-matchsummary.js`;
  } else if (kind === "match-innings") {
    path = `${IPL_OFFICIAL_DEFAULT_FEED_BASE_URL}/${params.matchId}-Innings${params.inningsNo}.js`;
  } else if (kind === "match-squad") {
    path = `${IPL_OFFICIAL_DEFAULT_FEED_BASE_URL}/${params.matchId}-squad.js`;
  } else {
    throw new Error("Unsupported official IPL feed request.");
  }

  return fetchJsonpPayload(path);
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
          const payload = await fetchOfficialFeedJson("match-innings", { matchId, inningsNo });
          return payload?.[`Innings${inningsNo}`] || null;
        } catch (error) {
          console.warn(`Official IPL innings ${inningsNo} unavailable for match ${matchId}`, error);
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

function normalizeOfficialLiveSnapshot(bundle) {
  const summary = bundle?.summary || {};
  const innings = asArray(bundle?.innings);
  const inningsOne = innings.find((entry) => toOptionalInteger(entry?.InningsNo) === 1) || innings[0] || null;
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
    title: cleanText(summary?.MatchName || `${summary?.Team1 || ""} vs ${summary?.Team2 || ""}`, 120),
    team_a: cleanNullableText(summary?.Team1, 80),
    team_b: cleanNullableText(summary?.Team2, 80),
    venue: cleanNullableText(summary?.GroundName, 120),
    starts_at: null,
    series_name: cleanNullableText(summary?.CompetitionName, 120),
    status: computeOfficialMatchStatus(summary, currentBall),
    current_innings_ball: currentBall,
    current_over_display: extractOfficialOversText(currentInningsData, currentBall),
    playing_xi: buildEmptyPlayingXi(),
    provider: "ipl-official",
    raw: summary,
    official_scorecard_bundle: bundle,
  };
}

function mergeOfficialFixturesWithProviderData(officialFixtures, providerFixtures) {
  const providerByIdentity = new Map(
    providerFixtures.map((fixture) => [buildFixtureIdentityKey(fixture), fixture]),
  );

  return officialFixtures.map((officialFixture) => {
    const providerFixture = providerByIdentity.get(buildFixtureIdentityKey(officialFixture));
    if (!providerFixture) {
      return officialFixture;
    }

    return {
      ...officialFixture,
      external_match_id: providerFixture.external_match_id,
      provider: "hybrid",
      status: providerFixture.status || officialFixture.status,
      current_innings_ball:
        providerFixture.current_innings_ball ?? officialFixture.current_innings_ball ?? null,
      current_over_display:
        providerFixture.current_over_display || officialFixture.current_over_display || null,
      raw: {
        official: officialFixture.raw,
        cricapi: providerFixture.raw,
      },
    };
  });
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

async function fetchPlayingXiSnapshot(externalMatchId, fixture) {
  const payload = await fetchOfficialFeedJson("match-squad", { matchId: externalMatchId });
  return extractPlayingXiFromPayload(payload, fixture);
}

async function fetchMatchScorecard(externalMatchId) {
  return fetchOfficialMatchBundle(externalMatchId);
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
    playing_xi: match?.playing_xi || buildEmptyPlayingXi(),
    provider: "ipl-official",
    raw: null,
    official_scorecard_bundle: null,
    live_feed_pending: true,
  };
}

async function fetchCricketApi(endpoint, params = {}) {
  if (shouldUseServerProxy()) {
    const proxyUrl = new URL("/api/cricket", window.location.origin);
    proxyUrl.searchParams.set("endpoint", endpoint.replace(/^\//, ""));

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }

      proxyUrl.searchParams.set(key, String(value));
    }

    const response = await fetch(proxyUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Cricket proxy returned ${response.status}.`);
    }

    const json = await response.json();
    if (json?.status === "failure" || json?.status === "error") {
      throw new Error(json?.reason || json?.message || "Cricket API request failed.");
    }

    if (json?.error) {
      throw new Error(json.error);
    }

    return json;
  }

  const baseUrl = String(APP_CONFIG.CRICKET_API_BASE_URL || "https://api.cricapi.com/v1").replace(
    /\/$/,
    "",
  );
  const url = new URL(`${baseUrl}/${endpoint.replace(/^\//, "")}`);
  url.searchParams.set("apikey", String(APP_CONFIG.CRICKET_API_KEY || "").trim());

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Cricket API returned ${response.status}.`);
  }

  const json = await response.json();
  if (json?.status === "failure" || json?.status === "error") {
    throw new Error(json?.reason || json?.message || "Cricket API request failed.");
  }

  if (json?.error) {
    throw new Error(json.error);
  }

  return json;
}

function shouldUseServerProxy() {
  return typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function normalizeProviderMatch(rawMatch) {
  const externalMatchId = resolveProviderMatchId(rawMatch);
  const teams = extractProviderTeams(rawMatch);
  const startsAt = extractProviderStartsAt(rawMatch);

  if (!externalMatchId || teams.length < 2 || !startsAt) {
    return null;
  }

  const liveState = extractProviderLiveState(rawMatch);

  return {
    external_match_id: externalMatchId,
    official_match_id: null,
    title: cleanText(
      rawMatch?.name || rawMatch?.matchName || `${teams[0]} vs ${teams[1]}`,
      120,
    ),
    team_a: teams[0],
    team_b: teams[1],
    venue: extractProviderVenue(rawMatch),
    starts_at: startsAt,
    series_name: cleanNullableText(
      rawMatch?.series || rawMatch?.seriesName || rawMatch?.competition || "",
      120,
    ),
    status: computeProviderMatchStatus({ raw: rawMatch, ...liveState }),
    current_innings_ball: liveState.current_innings_ball,
    current_over_display: liveState.current_over_display,
    playing_xi: buildEmptyPlayingXi(),
    provider: "cricapi",
    raw: rawMatch,
  };
}

function normalizeOfficialIplMatch(rawMatch, competition) {
  const officialMatchId = cleanNullableText(rawMatch?.MatchID, 40);
  const teamA = cleanNullableText(rawMatch?.HomeTeamName || rawMatch?.FirstBattingTeamName, 80);
  const teamB = cleanNullableText(rawMatch?.AwayTeamName || rawMatch?.SecondBattingTeamName, 80);
  const startsAt = extractOfficialStartsAt(rawMatch);

  if (!officialMatchId || !teamA || !teamB || !startsAt) {
    return null;
  }

  const currentInningsBall = extractOfficialCurrentBall(rawMatch);
  const currentOverDisplay = extractOfficialOverDisplay(rawMatch, currentInningsBall);

  return {
    external_match_id: officialMatchId,
    official_match_id: officialMatchId,
    title: cleanText(rawMatch?.MatchName || `${teamA} vs ${teamB}`, 120),
    team_a: teamA,
    team_b: teamB,
    venue: extractOfficialVenue(rawMatch),
    starts_at: startsAt,
    series_name: cleanNullableText(
      rawMatch?.CompetitionName || competition?.CompetitionName || `IPL ${getTargetSeasonYear()}`,
      120,
    ),
    status: computeOfficialMatchStatus(rawMatch, currentInningsBall),
    current_innings_ball: currentInningsBall,
    current_over_display: currentOverDisplay,
    playing_xi: buildEmptyPlayingXi(),
    provider: "ipl-official",
    raw: rawMatch,
  };
}

function extractOfficialStartsAt(rawMatch) {
  const gmtDate = cleanNullableText(rawMatch?.GMTMatchDate, 40);
  const gmtTime = cleanNullableText(rawMatch?.GMTMatchTime, 20);
  const gmtClock = gmtTime ? gmtTime.replace(/\s*GMT\s*/i, "") : "";

  if (gmtDate && gmtClock) {
    return toIsoDate(`${gmtDate}T${gmtClock}:00Z`);
  }

  return toIsoDate(rawMatch?.MATCH_COMMENCE_START_DATE);
}

function extractOfficialVenue(rawMatch) {
  const ground = cleanNullableText(rawMatch?.GroundName, 80);
  const city = cleanNullableText(rawMatch?.city, 60);
  if (ground && city && !ground.toLowerCase().includes(city.toLowerCase())) {
    return `${ground}, ${city}`;
  }

  return ground || city || null;
}

function extractOfficialCurrentBall(rawMatch) {
  const currentInnings = toOptionalInteger(rawMatch?.CurrentInnings);
  const firstInningsOvers = rawMatch?.["1FallOvers"];
  const firstInningsBallCount = oversToBalls(firstInningsOvers);
  const statusText = cleanText(
    rawMatch?.MatchStatus || rawMatch?.Comments || rawMatch?.Commentss || "",
    240,
  ).toLowerCase();

  if (currentInnings === 1 && firstInningsBallCount !== null) {
    return firstInningsBallCount;
  }

  if (currentInnings >= 2 || /\bwon by\b|\bpost\b|\bresult\b|\bcompleted\b/.test(statusText)) {
    return firstInningsBallCount !== null ? Math.max(firstInningsBallCount, 43) : 120;
  }

  return null;
}

function extractOfficialBallsFromInnings(innings) {
  if (!innings || typeof innings !== "object") {
    return null;
  }

  const extras = asArray(innings?.Extras)[0] || {};
  return oversToBalls(
    extras?.FallOvers ||
      extras?.Overs ||
      innings?.FallOvers ||
      innings?.Overs ||
      "",
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

function extractOfficialOverDisplay(rawMatch, currentInningsBall) {
  const firstInningsOvers = cleanNullableText(rawMatch?.["1FallOvers"], 12);
  if (firstInningsOvers) {
    return firstInningsOvers;
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
    return currentInningsBall !== null && currentInningsBall >= SCORE_LOCK_BALL ? "locked" : "live";
  }

  return "scheduled";
}

function extractProviderLiveState(rawMatch) {
  const scoreEntries = extractProviderScoreEntries(rawMatch);
  const firstInningsEntry = scoreEntries[0] || null;
  const firstInningsOvers = extractOversValue(firstInningsEntry);
  const statusText = cleanText(
    rawMatch?.status || rawMatch?.ms || rawMatch?.state || rawMatch?.scoreText || "",
    240,
  ).toLowerCase();
  const secondInningsDetected =
    scoreEntries.length > 1 ||
    /\bneed\b|\brequire\b|\btarget\b|\bchasing\b|\bwon by\b/.test(statusText);

  if (secondInningsDetected) {
    return {
      current_innings_ball: 120,
      current_over_display:
        firstInningsOvers !== null ? formatOversValue(firstInningsOvers) : "20.0",
    };
  }

  return {
    current_innings_ball:
      firstInningsOvers !== null ? oversToBalls(firstInningsOvers) : null,
    current_over_display:
      firstInningsOvers !== null ? formatOversValue(firstInningsOvers) : null,
  };
}

function computeProviderMatchStatus(snapshot) {
  const rawMatch = snapshot?.raw || snapshot;
  const statusText = cleanText(
    rawMatch?.status || rawMatch?.ms || rawMatch?.state || "",
    240,
  ).toLowerCase();

  if (/\bcancelled\b|\babandoned\b|\bno result\b/.test(statusText)) {
    return "cancelled";
  }

  if (rawMatch?.matchEnded || /\bwon by\b|\bmatch over\b|\bcompleted\b|\bresult\b/.test(statusText)) {
    return "completed";
  }

  const currentBall = toOptionalInteger(snapshot?.current_innings_ball);
  if (currentBall !== null) {
    return currentBall >= 43 ? "locked" : "live";
  }

  if (rawMatch?.matchStarted) {
    return "live";
  }

  return "scheduled";
}

function computePersistedProviderStatus(snapshot, existingMatch, settlementReady = false) {
  if (existingMatch?.status === "cancelled") {
    return "cancelled";
  }

  const nextStatus =
    cleanNullableText(snapshot?.status, 20) || existingMatch?.status || "scheduled";

  if (nextStatus !== "completed") {
    return nextStatus;
  }

  if (settlementReady || getMatchResult(existingMatch)) {
    return "completed";
  }

  const previousStatus = cleanNullableText(existingMatch?.status, 20);
  if (previousStatus === "live" || previousStatus === "locked") {
    return previousStatus;
  }

  return "locked";
}

function extractProviderTeams(rawMatch) {
  const directTeams = asArray(rawMatch?.teams)
    .map((entry) => {
      if (typeof entry === "string") {
        return cleanProviderTeamName(entry);
      }

      return cleanProviderTeamName(
        entry?.name || entry?.teamName || entry?.shortname || entry?.shortName || "",
      );
    })
    .filter(Boolean);

  const infoTeams = asArray(rawMatch?.teamInfo)
    .map((entry) =>
      cleanProviderTeamName(
        entry?.name || entry?.teamName || entry?.shortname || entry?.shortName || "",
      ),
    )
    .filter(Boolean);

  const fallbackTeams = [
    cleanNullableText(cleanProviderTeamName(rawMatch?.teamA), 80),
    cleanNullableText(cleanProviderTeamName(rawMatch?.teamB), 80),
    cleanNullableText(cleanProviderTeamName(rawMatch?.t1), 80),
    cleanNullableText(cleanProviderTeamName(rawMatch?.t2), 80),
  ].filter(Boolean);

  return Array.from(new Set([...directTeams, ...infoTeams, ...fallbackTeams])).slice(0, 2);
}

function cleanProviderTeamName(value) {
  return cleanText(String(value || "").replace(/\s*\[[^\]]+\]\s*/g, " "), 80);
}

function extractProviderStartsAt(rawMatch) {
  return toIsoDate(
    rawMatch?.dateTimeGMT ||
      rawMatch?.dateTime ||
      rawMatch?.date ||
      rawMatch?.matchDate ||
      rawMatch?.startTime,
  );
}

function extractProviderVenue(rawMatch) {
  return cleanNullableText(
    rawMatch?.venue || rawMatch?.ground || rawMatch?.location || rawMatch?.stadium,
    120,
  );
}

function resolveProviderMatchId(rawMatch) {
  return cleanNullableText(
    rawMatch?.id || rawMatch?.matchId || rawMatch?.match_id || rawMatch?.unique_id,
    120,
  );
}

function extractProviderScoreEntries(rawMatch) {
  const score = rawMatch?.score || rawMatch?.scores || rawMatch?.scorecard || [];
  return asArray(score);
}

function extractOversValue(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const value = entry.o ?? entry.overs ?? entry.over ?? entry.ov;
  return value === undefined || value === null ? null : String(value).trim();
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

  const [, oversPart, ballsPart = "0"] = match;
  const overs = Number.parseInt(oversPart, 10);
  const balls = Number.parseInt(ballsPart.slice(0, 1) || "0", 10);

  if (Number.isNaN(overs) || Number.isNaN(balls) || balls > 5) {
    return null;
  }

  return overs * 6 + balls;
}

function formatOversValue(oversValue) {
  const text = String(oversValue || "").trim();
  return text || "";
}

function formatBallsAsOvers(ballCount) {
  const safeBallCount = Math.max(Number(ballCount) || 0, 0);
  const overs = Math.floor(safeBallCount / 6);
  const balls = safeBallCount % 6;
  return `${overs}.${balls}`;
}

function extractPlayingXiFromPayload(payload, fixture) {
  const root = payload?.data ?? payload ?? {};
  const grouped = new Map();

  const addGroup = (teamName, players) => {
    const resolvedTeamName = resolveFixtureTeamName(teamName, fixture);
    const normalizedPlayers = normalizePlayerList(players, resolvedTeamName);
    if (!resolvedTeamName || !normalizedPlayers.length) {
      return;
    }

    grouped.set(resolvedTeamName, normalizedPlayers);
  };

  for (const item of asArray(root)) {
    addGroup(
      item?.teamName || item?.name || item?.shortname,
      item?.players || item?.playingXI || item?.playing_xi || item?.squad,
    );
  }

  for (const item of asArray(root?.teamInfo)) {
    addGroup(
      item?.teamName || item?.name || item?.shortname,
      item?.players || item?.playingXI || item?.playing_xi || item?.squad,
    );
  }

  if (Array.isArray(root?.squadA)) {
    addGroup(root?.squadA?.[0]?.TeamName || fixture?.team_a, root.squadA);
  }

  if (Array.isArray(root?.squadB)) {
    addGroup(root?.squadB?.[0]?.TeamName || fixture?.team_b, root.squadB);
  }

  const flatPlayers = root?.players || root?.playingXI || root?.playing_xi || root?.squad;
  if (Array.isArray(flatPlayers)) {
    const groupedPlayers = groupFlatPlayersByTeam(flatPlayers, fixture);
    for (const [teamName, players] of Object.entries(groupedPlayers)) {
      addGroup(teamName, players);
    }
  }

  const fallback = buildEmptyPlayingXi();
  return {
    team_a: grouped.get(fixture.team_a) || fallback.team_a,
    team_b: grouped.get(fixture.team_b) || fallback.team_b,
  };
}

function groupFlatPlayersByTeam(players, fixture) {
  const grouped = {
    [fixture.team_a]: [],
    [fixture.team_b]: [],
  };

  for (const entry of players) {
    const player = normalizePlayerEntry(entry, "");
    if (!player) {
      continue;
    }

    const teamName = resolveFixtureTeamName(player.team, fixture);
    if (grouped[teamName]) {
      grouped[teamName].push(player);
    }
  }

  return grouped;
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

function playerSupportsSelectionRole(player, selectionRole) {
  const normalizedRole = normalizeName(player?.role || "");
  if (!normalizedRole) {
    return true;
  }

  const isAllrounder =
    normalizedRole.includes("all-rounder") || normalizedRole.includes("allrounder");
  const isBatter =
    normalizedRole.includes("batsman") ||
    normalizedRole.includes("batter") ||
    normalizedRole.includes("keeper") ||
    normalizedRole.includes("wk");
  const isBowler = normalizedRole.includes("bowler");

  if (selectionRole === "batsman") {
    return isBatter || isAllrounder;
  }

  if (selectionRole === "bowler") {
    return isBowler || isAllrounder;
  }

  return true;
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
    role: cleanNullableText(
      entry?.role || entry?.playerRole || entry?.skill || entry?.PlayerSkill,
      40,
    ),
    image: cleanNullableText(
      resolveOfficialPlayerImageUrl(
        entry?.image ||
          entry?.img ||
          entry?.photo ||
          entry?.playerImage ||
          entry?.player_image ||
          entry?.playerImageName ||
          entry?.PlayerImage ||
          entry?.PlayerImageName ||
          entry?.profileImage ||
          entry?.Image,
      ),
      500,
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

function resolveFixtureTeamName(teamName, fixture) {
  const normalized = normalizeName(teamName);
  if (!normalized) {
    return fixture.team_a;
  }

  if (normalized === normalizeName(fixture.team_a)) {
    return fixture.team_a;
  }

  if (normalized === normalizeName(fixture.team_b)) {
    return fixture.team_b;
  }

  return teamName;
}

function getPlayingXiPlayerCountFromPayload(playingXi) {
  if (!playingXi || typeof playingXi !== "object") {
    return 0;
  }

  return asArray(playingXi.team_a).length + asArray(playingXi.team_b).length;
}

function buildEmptyPlayingXi() {
  return {
    team_a: [],
    team_b: [],
  };
}

function isIplFixture(fixture) {
  const haystack = [fixture.series_name, fixture.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return getSeriesHints().some((hint) => haystack.includes(hint));
}

function buildFixtureIdentityKey(fixture) {
  const startsAt = fixture?.starts_at ? new Date(fixture.starts_at) : null;
  const dayKey =
    startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt.toISOString().slice(0, 10) : "unknown";
  const teamsKey = [fixture?.team_a, fixture?.team_b]
    .map((team) => normalizeName(team))
    .filter(Boolean)
    .sort()
    .join("|");

  return `${dayKey}|${teamsKey}`;
}

function getSeriesHints() {
  return asArray(APP_CONFIG.CRICKET_SERIES_HINTS)
    .map((hint) => String(hint || "").trim().toLowerCase())
    .filter(Boolean);
}

function extractSettlementPayload(scorecardPayload, match, snapshot) {
  if (scorecardPayload?.provider === "ipl-official") {
    return extractOfficialSettlementPayload(scorecardPayload, match, snapshot);
  }

  const root = scorecardPayload?.data ?? scorecardPayload ?? {};
  const batsmanRuns = extractBatsmanRuns(root, match);
  const bowlerWickets = extractBowlerWickets(root, match);
  const winnerTeam = findWinningTeam(root, match, snapshot);
  const firstInningsTotal = extractFirstInningsTotal(root, snapshot);

  if (!winnerTeam || firstInningsTotal === null) {
    return null;
  }

  return {
    winner_team: winnerTeam,
    first_innings_total: firstInningsTotal,
    batsman_runs: batsmanRuns,
    bowler_wickets: bowlerWickets,
    notes: "Settled automatically from CricAPI scorecard. Players missing from the final scorecard receive 0 points.",
  };
}

function extractOfficialSettlementPayload(bundle, match, snapshot) {
  const summary = bundle?.summary || {};
  const innings = asArray(bundle?.innings);
  const batsmanRuns = {};
  const bowlerWickets = {};

  for (const inningsData of innings) {
    for (const entry of asArray(inningsData?.BattingCard)) {
      const key = resolvePlayerCanonicalKey(entry?.PlayerName || entry?.PlayerShortName, match);
      const runs = toOptionalInteger(entry?.Runs);
      if (key && runs !== null) {
        batsmanRuns[key] = Math.max(batsmanRuns[key] || 0, runs);
      }
    }

    for (const entry of asArray(inningsData?.BowlingCard)) {
      const key = resolvePlayerCanonicalKey(entry?.PlayerName || entry?.PlayerShortName, match);
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

  return {
    winner_team: winnerTeam,
    first_innings_total: firstInningsTotal,
    batsman_runs: batsmanRuns,
    bowler_wickets: bowlerWickets,
    notes: "Settled automatically from the official IPL match-centre feeds. Players missing from the match-day squad or scorecard receive 0 points.",
  };
}

function extractOfficialSettlementFirstInningsTotal(bundle, snapshot) {
  const innings = asArray(bundle?.innings);
  const inningsOne = innings.find((entry) => toOptionalInteger(entry?.InningsNo) === 1) || innings[0] || null;
  const extras = asArray(inningsOne?.Extras)[0] || {};
  const totalText = cleanNullableText(extras?.Total, 40);
  const totalFromText = totalText?.match(/^(\d+)/)?.[1] || null;
  const summary = bundle?.summary || {};
  const summaryText = cleanNullableText(summary?.["1Summary"] || summary?.FirstBattingSummary, 40);
  const summaryTotalFromText = summaryText?.match(/^(\d+)/)?.[1] || null;
  const parsed =
    toOptionalInteger(extras?.FallScore) ??
    toOptionalInteger(totalFromText) ??
    toOptionalInteger(summary?.["1FallScore"]) ??
    toOptionalInteger(summaryTotalFromText) ??
    toOptionalInteger(snapshot?.raw?.["1FallScore"]) ??
    null;

  return parsed;
}

function extractFirstInningsTotal(root, snapshot) {
  const snapshotEntries = extractProviderScoreEntries(snapshot?.raw || snapshot);
  const firstSnapshotEntry = snapshotEntries[0];
  const candidate =
    firstSnapshotEntry?.r ??
    firstSnapshotEntry?.runs ??
    firstSnapshotEntry?.score ??
    extractProviderScoreEntries(root)[0]?.r ??
    extractProviderScoreEntries(root)[0]?.runs;

  const parsed = toOptionalInteger(candidate);
  return parsed;
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

  const winningTeamId = cleanNullableText(root?.WinningTeamID || snapshot?.raw?.WinningTeamID, 40);
  const homeTeamId = cleanNullableText(root?.HomeTeamID || snapshot?.raw?.HomeTeamID, 40);
  const awayTeamId = cleanNullableText(root?.AwayTeamID || snapshot?.raw?.AwayTeamID, 40);
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

function extractBatsmanRuns(root, match) {
  const payload = {};

  for (const entries of collectArraysByKey(root, new Set(["batting", "batsmen", "batters"]))) {
    for (const entry of entries) {
      const name = cleanText(
        entry?.batsman || entry?.name || entry?.playerName || entry?.player || "",
        80,
      );
      const runs = toOptionalInteger(entry?.r ?? entry?.runs ?? entry?.score);
      if (!name || runs === null) {
        continue;
      }

      const key = resolvePlayerCanonicalKey(name, match);
      payload[key] = Math.max(payload[key] || 0, runs);
    }
  }

  return payload;
}

function extractBowlerWickets(root, match) {
  const payload = {};

  for (const entries of collectArraysByKey(root, new Set(["bowling", "bowlers", "bowler"]))) {
    for (const entry of entries) {
      const name = cleanText(
        entry?.bowler || entry?.name || entry?.playerName || entry?.player || "",
        80,
      );
      const wickets = toOptionalInteger(entry?.w ?? entry?.wickets ?? entry?.wkts);
      if (!name || wickets === null) {
        continue;
      }

      const key = resolvePlayerCanonicalKey(name, match);
      payload[key] = Math.max(payload[key] || 0, wickets);
    }
  }

  return payload;
}

function collectArraysByKey(node, keys, results = []) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectArraysByKey(item, keys, results);
    }
    return results;
  }

  for (const [key, value] of Object.entries(node)) {
    if (keys.has(key) && Array.isArray(value)) {
      results.push(value);
    }

    if (value && typeof value === "object") {
      collectArraysByKey(value, keys, results);
    }
  }

  return results;
}

function addMinutes(isoValue, minutes) {
  if (!isoValue) {
    return null;
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
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

function parseScoreLines(rawText, match) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const payload = {};

  for (const line of lines) {
    const [namePart, valuePart] = line.split(":");
    const name = cleanText(namePart, 80);
    const value = Number.parseInt((valuePart || "").trim(), 10);

    if (!name || Number.isNaN(value)) {
      throw new Error(`Invalid score line: "${line}". Use "Name: number".`);
    }

    payload[resolvePlayerCanonicalKey(name, match)] = value;
  }

  return payload;
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

function getPlayerStatValue(statMap, playerName, match) {
  if (!statMap || typeof statMap !== "object") {
    return 0;
  }

  const directKeys = Array.from(
    new Set(
      [
        resolvePlayerCanonicalKey(playerName, match),
        normalizePlayerLookupKey(playerName),
      ].filter(Boolean),
    ),
  );

  for (const key of directKeys) {
    const value = Number(statMap[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  const comparableKey = normalizePlayerLookupKey(playerName);
  if (!comparableKey) {
    return 0;
  }

  const aliasMatches = Object.entries(statMap).filter(([storedKey]) => {
    return normalizePlayerLookupKey(storedKey) === comparableKey;
  });

  if (aliasMatches.length === 1) {
    const value = Number(aliasMatches[0][1]);
    return Number.isFinite(value) ? value : 0;
  }

  return 0;
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

  let matches = candidates.filter((candidate) => candidate.tokens.at(-1) === surname);
  if (!matches.length) {
    return null;
  }

  const firstToken = tokens[0];
  if (firstToken && firstToken !== surname) {
    const firstInitial = firstToken[0];
    const refined = matches.filter((candidate) => {
      const candidateFirst = candidate.tokens.find((token) => token.length > 1) || candidate.tokens[0];
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

function mapToLines(scoreMap = {}) {
  return Object.entries(scoreMap)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}

function toIsoDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateTimeInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDate(value, mode = "full") {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (mode === "date") {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeAge(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "just now";
  }

  if (milliseconds < 15 * 1000) {
    return "just now";
  }

  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

function flash(message, tone = "info") {
  state.notice = { message, tone };
  render();
  window.clearTimeout(flash.timerId);
  flash.timerId = window.setTimeout(() => {
    state.notice = null;
    render();
  }, 4200);
}

function showTransientToast(message, tone = "info") {
  let toast = document.getElementById("floating-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "floating-toast";
    toast.className = "floating-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = String(message || "");
  toast.className = `floating-toast notice notice-${tone} is-visible`;
  window.clearTimeout(showTransientToast.timerId);
  showTransientToast.timerId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2800);
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

function normalizeName(value) {
  return cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getComparablePlayerTokens(value) {
  return tokenizePlayerName(value).filter((token) => !PLAYER_NAME_IGNORED_TAGS.has(token));
}

function normalizePlayerLookupKey(value) {
  return getComparablePlayerTokens(value).join("-");
}

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  state.installPromptEvent = event;
  render();
}

function handleAppInstalled() {
  state.installPromptEvent = null;
  state.isStandalone = true;
  flash("App installed. It should now appear on your home screen.", "success");
}

async function installApp() {
  if (!state.installPromptEvent) {
    flash("Install prompt is not available on this device yet.", "info");
    return;
  }

  state.installPromptEvent.prompt();
  const outcome = await state.installPromptEvent.userChoice;

  if (outcome?.outcome === "accepted") {
    flash("Installing app...", "success");
  }

  state.installPromptEvent = null;
  render();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) {
      return;
    }

    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => registration.update().catch(() => registration))
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });
  });
}
