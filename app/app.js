import { APP_CONFIG } from "./config.js";

const root = document.getElementById("app");

const state = {
  appName: APP_CONFIG.APP_NAME || "IPL Prediction League",
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
  leaderboard: [],
  notice: null,
  loading: false,
  realtimeChannel: null,
  reloadTimer: null,
  autoSyncTimer: null,
  autoSyncBusy: false,
  providerFixtures: [],
  loadingProviderFixtures: false,
  syncingMatchIds: new Set(),
  installPromptEvent: null,
  isStandalone:
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true,
};

const DEMO_USER_ID = "demo-user";
const DEMO_LEAGUE_ID = "demo-league";
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

const CORE_OPEN_WINDOW_MS = 2 * 60 * 60 * 1000;
const CORE_LOCK_BALL = 19;
const SCORE_LOCK_BALL = 43;
const IPL_OFFICIAL_COMPETITION_URL = "https://scores.iplt20.com/ipl/mc/competition.js";
const IPL_OFFICIAL_DEFAULT_FEED_BASE_URL = "https://scores.iplt20.com/ipl/feeds";

document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("input", handleInput);
window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
window.addEventListener("appinstalled", handleAppInstalled);

registerServiceWorker();

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
      detectSessionInUrl: true,
    },
  });

  const {
    data: { session },
  } = await state.client.auth.getSession();

  state.session = session;
  state.user = session?.user ?? null;

  state.client.auth.onAuthStateChange(async (_event, sessionData) => {
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

    try {
      await ensureProfile();
      await loadMemberships();
      await loadLeagueBundle();
      render();
    } catch (error) {
      console.error(error);
      flash(error.message || "Unable to refresh your league data.", "error");
    }
  });

  if (state.user) {
    await ensureProfile();
    await loadMemberships();
    await loadLeagueBundle();
  }

  render();
}

function loadDemoState() {
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
  state.matches = DEMO_MATCHES;
  state.members = DEMO_MEMBERS;
  state.predictions = DEMO_PREDICTIONS;
  state.leaderboard = buildLeaderboardFromMatches(
    DEMO_MEMBERS,
    DEMO_PREDICTIONS,
    DEMO_MATCHES,
  );
}

async function ensureProfile() {
  const pendingName = window.localStorage.getItem("ipl-pending-display-name");
  const fallbackName =
    pendingName ||
    state.user?.user_metadata?.display_name ||
    state.user?.user_metadata?.full_name ||
    state.user?.email?.split("@")[0] ||
    "Player";

  const displayName = cleanText(fallbackName, 40);

  const { error } = await state.client
    .from("profiles")
    .upsert(
      {
        id: state.user.id,
        display_name: displayName,
        email: state.user.email || null,
      },
      { onConflict: "id" },
    );

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

  if (pendingName) {
    window.localStorage.removeItem("ipl-pending-display-name");
  }
}

async function loadMemberships() {
  const { data, error } = await state.client
    .from("league_members")
    .select(
      "id, league_id, display_name, role, is_active, joined_at, leagues(id, name, season, invite_code, status, created_by, created_at)",
    )
    .eq("user_id", state.user.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  state.memberships = data || [];

  if (!state.memberships.length) {
    state.activeLeagueId = null;
    state.matches = [];
    state.members = [];
    state.predictions = [];
    state.leaderboard = [];
    state.providerFixtures = [];
    teardownRealtime();
    teardownAutoSync();
    return;
  }

  const stillValid = state.memberships.some(
    (membership) => membership.league_id === state.activeLeagueId,
  );

  state.activeLeagueId = stillValid
    ? state.activeLeagueId
    : state.memberships[0].league_id;
}

async function loadLeagueBundle() {
  if (!state.activeLeagueId) {
    render();
    return;
  }

  const leagueId = state.activeLeagueId;

  const [matchesResult, membersResult, predictionsResult, leaderboardResult] =
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
        .from("league_leaderboard")
        .select("*")
        .eq("league_id", leagueId)
        .order("total_points", { ascending: false })
        .order("display_name", { ascending: true }),
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

  if (leaderboardResult.error) {
    throw leaderboardResult.error;
  }

  state.matches = matchesResult.data || [];
  state.members = membersResult.data || [];
  state.predictions = predictionsResult.data || [];
  state.leaderboard = leaderboardResult.data || [];

  if (!state.matches.length) {
    teardownRealtime();
    teardownAutoSync();
    render();
    return;
  }

  const currentSelection = getSelectedMatch();
  if (!currentSelection) {
    state.selectedMatchId = chooseDefaultMatchId(state.matches);
  }

  setupRealtime(leagueId);
  setupAutoSync();
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
  teardownAutoSync();

  if (!state.user || currentMembership()?.role !== "admin" || !hasCricketApiConfig()) {
    return;
  }

  const trackedMatches = state.matches.filter(shouldAutoSyncMatch);
  if (!trackedMatches.length) {
    return;
  }

  const intervalMs = Math.max(Number(APP_CONFIG.AUTO_SYNC_INTERVAL_MS) || 90000, 30000);
  state.autoSyncTimer = window.setInterval(() => {
    syncTrackedMatches({ quiet: true }).catch((error) => {
      console.error(error);
    });
  }, intervalMs);
}

function teardownAutoSync() {
  if (state.autoSyncTimer) {
    window.clearInterval(state.autoSyncTimer);
    state.autoSyncTimer = null;
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
  root.innerHTML = `
    <div class="page-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">🏏</div>
          <div class="brand-copy">
            <h1>${escapeHtml(state.appName)}</h1>
            <p>${state.demoMode ? "Demo mode with sample data" : "Realtime picks, locks, and leaderboard"}</p>
          </div>
        </div>
        <div class="topbar-actions">
          ${
            state.user
              ? `
                <span class="chip"><strong>${escapeHtml(
                  state.profile?.display_name || state.user.email || "Player",
                )}</strong>${escapeHtml(state.user.email || "")}</span>
                ${
                  state.demoMode
                    ? ""
                    : `<button class="ghost-btn" data-action="sign-out">Sign out</button>`
                }
              `
              : `<a class="ghost-btn" href="#account">Join your league</a>`
          }
          ${
            state.installPromptEvent && !state.isStandalone
              ? `<button class="ghost-btn" type="button" data-action="install-app">Install app</button>`
              : ""
          }
          <a class="btn" href="#dashboard">Open dashboard</a>
        </div>
      </header>

      <main class="layout">
        ${renderNotice()}
        ${renderHero()}
        ${renderAccountPanel()}
        ${renderLeagueAccessPanel()}
        ${renderDashboard()}
      </main>
    </div>
  `;
}

function renderNotice() {
  if (!state.notice) {
    return "";
  }

  return `
    <div class="notice notice-${escapeHtml(state.notice.tone || "info")}">
      ${escapeHtml(state.notice.message)}
    </div>
  `;
}

function renderHero() {
  return `
    <section class="hero">
      <div class="hero-grid">
        <div>
          <div class="eyebrow">Tournament game night, but properly organized</div>
          <h2>Run your IPL prediction league on one public link.</h2>
          <p>
            Friends pick one batsman, one bowler, one winning team, and one exact first-innings total.
            The app now pulls the IPL schedule, syncs full match squads, locks picks on the live innings clock, and settles the leaderboard after the match.
          </p>
          <div class="hero-actions">
            <a class="btn" href="#dashboard">Start the league</a>
            ${
              state.installPromptEvent && !state.isStandalone
                ? `<button class="ghost-btn" type="button" data-action="install-app">Add to home screen</button>`
                : ""
            }
          </div>
        </div>
        <div class="hero-meta">
          <div class="glass-card">
            <div class="section-head">
              <div>
                <h3>How scoring works</h3>
                <p>Same rules you shared, now tracked without WhatsApp chaos.</p>
              </div>
            </div>
            <div class="score-strip">
              <div class="score-pill"><span>Batsman</span><strong>Runs = points</strong></div>
              <div class="score-pill"><span>Bowler</span><strong>20 per wicket</strong></div>
              <div class="score-pill"><span>Exact total</span><strong>+10</strong></div>
              <div class="score-pill"><span>Match winner</span><strong>+50</strong></div>
            </div>
          </div>
          <div class="glass-card">
            <div class="section-head">
              <div>
                <h3>Built for edge cases</h3>
                <p>Live sync keeps the game fair even when picks race in at the last second.</p>
              </div>
            </div>
            <div class="chip-list">
              <span class="chip"><strong>No duplicates</strong>First come, first serve</span>
              <span class="chip"><strong>2h entry window</strong>Picks open two hours before each match</span>
              <span class="chip"><strong>Live innings clock</strong>3.1 and 7.1 overs lock automatically</span>
              <span class="chip"><strong>Auto scoring</strong>Completed matches settle themselves</span>
            </div>
          </div>
        </div>
      </div>
    </section>
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
          <p>${isAuthenticated ? "Update the name your friends will see on the board." : "Magic link login keeps this simple for the whole group."}</p>
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
                  <label>Email</label>
                  <input value="${escapeAttribute(state.user.email || "")}" disabled />
                </div>
                <div class="field span-2">
                  <button class="btn" type="submit">Save display name</button>
                </div>
              </form>
            `
            : `
              <form class="form-grid" id="magic-link-form">
                <div class="field">
                  <label for="auth-display-name">Display name</label>
                  <input id="auth-display-name" name="display_name" maxlength="40" placeholder="Mohit" required />
                </div>
                <div class="field">
                  <label for="auth-email">Email</label>
                  <input id="auth-email" type="email" name="email" placeholder="you@example.com" required />
                </div>
                <div class="field span-2">
                  <button class="btn" type="submit">Send magic link</button>
                </div>
              </form>
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
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>${state.memberships.length ? "Your leagues" : "Create or join a league"}</h3>
          <p>${
            state.memberships.length
              ? "Switch leagues here, or create and join another one."
              : "One person creates the tournament. Everyone else joins with the invite code."
          }</p>
        </div>
      </div>
      ${
        state.memberships.length
          ? `
            <div class="chip-list">
              ${state.memberships
                .map((membership) => {
                  const active = membership.league_id === state.activeLeagueId;
                  return `
                    <button class="${active ? "btn" : "ghost-btn"}" type="button" data-action="switch-league" data-league-id="${membership.league_id}">
                      ${escapeHtml(membership.leagues.name)} · ${escapeHtml(membership.role)}
                    </button>
                  `;
                })
                .join("")}
            </div>
          `
          : ""
      }
      <div class="grid-2">
        <form class="panel" id="create-league-form">
          <div class="section-head">
            <div>
              <h4>Create league</h4>
              <p>You become admin for this league.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="league-name">League name</label>
              <input id="league-name" name="name" placeholder="Mohit IPL League" required />
            </div>
            <div class="field">
              <label for="league-season">Season</label>
              <input id="league-season" name="season" value="IPL 2026" required />
            </div>
            <div class="field span-2">
              <button class="btn" type="submit">Create league</button>
            </div>
          </div>
        </form>

        <form class="panel" id="join-league-form">
          <div class="section-head">
            <div>
              <h4>Join league</h4>
              <p>Paste the invite code from the league admin.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="invite-code">Invite code</label>
              <input id="invite-code" name="invite_code" placeholder="PLAYIPL" maxlength="12" required />
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <button class="btn" type="submit">Join now</button>
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

  return `
    <section class="stack" id="dashboard">
      <section class="panel">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(league?.name || "League dashboard")}</h3>
            <p>${escapeHtml(league?.season || "")} · Invite code <strong>${escapeHtml(league?.invite_code || "-")}</strong></p>
          </div>
          <div class="split-line">
            <span class="tag ${isAdmin ? "tag-admin" : "tag-member"}">${isAdmin ? "Admin" : "Member"}</span>
            <button class="ghost-btn" type="button" data-action="refresh-league">Refresh</button>
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
                ${renderMatchDetail(match, prediction, isAdmin)}
              `
              : `<section class="panel"><div class="empty-state">${
                  isAdmin
                    ? "No matches yet. Sync the IPL schedule below."
                    : "Choose a match to start."
                }</div></section>`
          }
          ${isAdmin ? renderAdminTools(match) : ""}
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
  const status = computeMatchStatus(match);
  const active = match.id === getSelectedMatch()?.id;
  const entries = getPredictionsForMatch(match.id);
  const liveWindow = getLiveWindowState(match, getCurrentUserPrediction(match.id));
  const availabilityLabel = !liveWindow.submissionWindowOpen
    ? `Opens ${formatDate(liveWindow.submissionStartsAt) || "2h before start"}`
    : liveWindow.coreWindowOpen
      ? "Player picks open"
      : liveWindow.scoreWindowOpen
        ? "Score phase open"
        : match.match_results
          ? "Scored"
          : "Locked";

  return `
    <button class="match-card ${active ? "active" : ""}" type="button" data-action="select-match" data-match-id="${match.id}">
      <div class="inline-meta">
        <span class="tag tag-${status}">${labelizeStatus(status)}</span>
        <span class="subtle">${escapeHtml(formatDate(match.starts_at))}</span>
      </div>
      <h4>${escapeHtml(match.title || `${match.team_a} vs ${match.team_b}`)}</h4>
      <div class="match-meta">
        <span>${escapeHtml(match.team_a)}</span>
        <span>vs</span>
        <span>${escapeHtml(match.team_b)}</span>
      </div>
      <p class="subtle">${escapeHtml(match.venue || "Venue TBD")}</p>
      <div class="chip-list">
        <span class="chip"><strong>${entries.length}</strong>Picks posted</span>
        <span class="chip"><strong>${escapeHtml(availabilityLabel)}</strong>Window</span>
      </div>
    </button>
  `;
}

function renderMatchDetail(match, prediction, isAdmin) {
  const status = computeMatchStatus(match);
  const entries = getPredictionsForMatch(match.id);
  const liveWindow = getLiveWindowState(match, prediction);
  const coreLocked = liveWindow.coreLocked;
  const scoreLocked = liveWindow.scoreLocked;
  const scoreResult = match.match_results;
  const squadGroups = getPlayingXiGroups(match);
  const hasSquad = squadGroups.some((group) => group.players.length);
  const batsmanOptions = getSelectablePlayers(match, "batsman", prediction);
  const bowlerOptions = getSelectablePlayers(match, "bowler", prediction);
  const syncSummary = getMatchSyncSummary(match);
  const windowMessage = !liveWindow.submissionWindowOpen
    ? `Player picks open ${escapeHtml(
        formatDate(liveWindow.submissionStartsAt) || "2 hours before the match",
      )}.`
    : liveWindow.coreWindowOpen
      ? "Choose one batsman, one bowler, and one winning team before 3.1 overs."
      : liveWindow.scoreWindowOpen
        ? "Player picks are locked. Exact first-innings score is open until 7.1 overs."
        : "All prediction windows are locked for this match.";

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(match.title || `${match.team_a} vs ${match.team_b}`)}</h3>
          <p>${escapeHtml(match.venue || "Venue TBD")} · ${escapeHtml(formatDate(match.starts_at))}</p>
        </div>
        <span class="tag tag-${status}">${labelizeStatus(status)}</span>
      </div>

      <div class="chip-list">
        <span class="chip"><strong>Data source</strong>${escapeHtml(syncSummary.source)}</span>
        <span class="chip"><strong>Squads</strong>${escapeHtml(syncSummary.playingXiLabel)}</span>
        <span class="chip"><strong>Core picks</strong>${escapeHtml(formatCoreLockLabel(match, liveWindow))}</span>
        <span class="chip"><strong>Score lock</strong>${escapeHtml(formatScoreLockLabel(match, liveWindow))}</span>
        <span class="chip"><strong>Live clock</strong>${escapeHtml(syncSummary.liveClock)}</span>
        <span class="chip"><strong>Last sync</strong>${escapeHtml(syncSummary.lastSynced)}</span>
      </div>

      ${
        match.notes
          ? `<p class="footnote">${escapeHtml(match.notes)}</p>`
          : ""
      }
      ${
        match.sync_error
          ? `<div class="notice notice-error">${escapeHtml(match.sync_error)}</div>`
          : ""
      }

      <div class="grid-2">
        <div class="panel">
          <div class="section-head">
            <div>
              <h4>Your prediction</h4>
              <p>${windowMessage}</p>
            </div>
          </div>
          ${
            state.demoMode
              ? `<div class="notice notice-info">Demo mode is read-only. Configure Supabase to save real entries.</div>`
              : !state.user
                ? `<div class="empty-state">Sign in to submit picks.</div>`
                : `
                  <form class="form-grid" id="core-prediction-form">
                    <input type="hidden" name="match_id" value="${match.id}" />
                    <div class="field">
                      <label for="batsman-name">Batsman</label>
                      <select id="batsman-name" name="batsman_name" ${!liveWindow.coreWindowOpen || !hasSquad ? "disabled" : ""}>
                        ${renderPlayerSelectOptions("Choose batsman", batsmanOptions, prediction?.batsman_name)}
                      </select>
                    </div>
                    <div class="field">
                      <label for="bowler-name">Bowler</label>
                      <select id="bowler-name" name="bowler_name" ${!liveWindow.coreWindowOpen || !hasSquad ? "disabled" : ""}>
                        ${renderPlayerSelectOptions("Choose bowler", bowlerOptions, prediction?.bowler_name)}
                      </select>
                    </div>
                    <div class="field">
                      <label for="team-pick">Winning team</label>
                      <select id="team-pick" name="team_pick" ${!liveWindow.coreWindowOpen ? "disabled" : ""}>
                        <option value="">Choose a winner</option>
                        <option value="${escapeAttribute(match.team_a)}" ${
                          prediction?.team_pick === match.team_a ? "selected" : ""
                        }>${escapeHtml(match.team_a)}</option>
                        <option value="${escapeAttribute(match.team_b)}" ${
                          prediction?.team_pick === match.team_b ? "selected" : ""
                        }>${escapeHtml(match.team_b)}</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="predicted-score">1st innings total</label>
                      <input id="predicted-score" type="number" name="predicted_score" min="0" placeholder="182" value="${escapeAttribute(
                        prediction?.predicted_score ?? "",
                      )}" ${scoreLocked ? "disabled" : ""} />
                    </div>
                    <div class="field span-2">
                      <small>
                        ${
                          hasSquad
                            ? "Pick from the synced match squads. Duplicate batsmen and bowlers are blocked league-wide on a first-come basis."
                            : "Waiting for the match squads to sync from the provider. The dropdowns will populate automatically once squad data is available."
                        }
                      </small>
                    </div>
                    <div class="field span-2">
                      <button class="btn" type="submit" ${!liveWindow.coreWindowOpen || !hasSquad ? "disabled" : ""}>${
                        !liveWindow.submissionWindowOpen
                          ? "Opens 2 hours before start"
                          : coreLocked
                            ? "Player picks locked"
                            : "Save player picks"
                      }</button>
                    </div>
                  </form>
                  <form class="form-grid" id="score-prediction-form" style="margin-top: 1rem;">
                    <input type="hidden" name="match_id" value="${match.id}" />
                    <div class="field">
                      <label for="predicted-score">1st innings total</label>
                      <input
                        id="predicted-score"
                        type="text"
                        name="predicted_score"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        maxlength="3"
                        placeholder="182"
                        value="${escapeAttribute(prediction?.predicted_score ?? "")}"
                        ${!liveWindow.scoreWindowOpen ? "disabled" : ""}
                      />
                    </div>
                    <div class="field span-2">
                      <small>
                        Exact score prediction opens right after 3.1 overs and locks at 7.1 overs. Only numbers are allowed.
                      </small>
                    </div>
                    <div class="field span-2">
                      <button class="ghost-btn" type="submit" ${!liveWindow.scoreWindowOpen ? "disabled" : ""}>${
                        liveWindow.scoreWindowOpen
                          ? "Save score prediction"
                          : scoreLocked
                            ? "Score locked"
                            : "Score opens after 3.1 overs"
                      }</button>
                    </div>
                  </form>
                `
          }
          ${
            prediction
              ? `
                <div class="prediction-snapshot">
                  <div class="entry-item">
                    <div>
                      <strong>${escapeHtml(prediction.batsman_name || "Batsman not set")}</strong>
                      <span class="subtle">Batsman</span>
                    </div>
                    <div class="entry-stats">
                      <strong>${escapeHtml(prediction.team_pick || "Winner not set")}</strong>
                      <span class="subtle">Team pick</span>
                    </div>
                  </div>
                  <div class="entry-item">
                    <div>
                      <strong>${escapeHtml(prediction.bowler_name || "Bowler not set")}</strong>
                      <span class="subtle">Bowler</span>
                    </div>
                    <div class="entry-stats">
                      <strong>${escapeHtml(
                        prediction.predicted_score !== null && prediction.predicted_score !== undefined
                          ? prediction.predicted_score
                          : "Score not set",
                      )}</strong>
                      <span class="subtle">Predicted total</span>
                    </div>
                  </div>
                  <div class="chip-list">
                    ${
                      prediction.core_locked_due_to_pre_xi
                        ? `<span class="chip"><strong>Locked</strong>Submitted before XI</span>`
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
              `
              : ""
          }
        </div>

        <div class="panel">
          <div class="section-head">
            <div>
              <h4>Taken picks</h4>
              <p>These batsmen, bowlers, teams, and scores are already taken for this match.</p>
            </div>
          </div>
          ${
            entries.length
              ? `
                <div class="entry-list">
                  ${entries.map((entry) => renderPredictionRow(entry)).join("")}
                </div>
              `
              : `<div class="empty-state">No one has posted yet.</div>`
          }
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="section-head">
            <div>
              <h4>Match squads</h4>
              <p>${hasSquad ? "Player picks use these synced squads." : "The provider has not published squads for this match yet."}</p>
            </div>
          </div>
          ${
            hasSquad
              ? squadGroups
                  .map(
                    (group) => `
                      <div class="team-block">
                        <strong>${escapeHtml(group.teamName)}</strong>
                        <div class="chip-list">
                          ${group.players.map((player) => `<span class="chip">${escapeHtml(player.name)}</span>`).join("")}
                        </div>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="empty-state">Once the squad feed is available for this match, the player dropdowns will fill automatically.</div>`
          }
        </div>

        <div class="panel">
          <div class="section-head">
            <div>
              <h4>Automation status</h4>
              <p>The live feed updates the innings clock and settles completed matches.</p>
            </div>
          </div>
          <div class="chip-list">
            <span class="chip"><strong>Series</strong>${escapeHtml(match.series_name || "IPL")}</span>
            <span class="chip"><strong>Auto sync</strong>${match.auto_sync_enabled ? "On" : "Off"}</span>
            <span class="chip"><strong>Provider ID</strong>${escapeHtml(match.external_match_id || "Manual match")}</span>
            <span class="chip"><strong>First innings clock</strong>${escapeHtml(syncSummary.liveClock)}</span>
          </div>
          <p class="footnote">
            The 3.1 and 7.1 over locks use the provider's first-innings ball count whenever it is available. If the live feed lags, the admin can still override the current match clock below.
          </p>
        </div>
      </div>

      ${
        scoreResult
          ? `
            <div class="panel">
              <div class="section-head">
                <div>
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
            </div>
          `
          : !isAdmin
            ? `<div class="notice notice-info">This match will settle automatically once the completed scorecard arrives.</div>`
            : ""
      }
    </section>
  `;
}

function renderPredictionRow(entry) {
  const sameUser = entry.user_id === state.user?.id;

  return `
    <div class="entry-item">
      <div>
        <strong>${escapeHtml(entry.league_members?.display_name || "Player")}</strong>
        <div class="entry-meta">
          <span class="subtle">Batsman: ${escapeHtml(entry.batsman_name || "-")}</span>
          <span class="subtle">Bowler: ${escapeHtml(entry.bowler_name || "-")}</span>
        </div>
      </div>
      <div class="entry-stats">
        <strong>${escapeHtml(entry.predicted_score ?? "-")}</strong>
        <div class="entry-meta">
          <span class="subtle">${escapeHtml(entry.team_pick || "-")}</span>
          ${sameUser ? `<span class="tag tag-member">You</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderAdminTools(match) {
  const hasApiKey = hasCricketApiConfig();
  const selectedSummary = match ? getMatchSyncSummary(match) : null;
  const scheduleYear = getTargetSeasonYear();
  const liveWindow = match ? getLiveWindowState(match, getCurrentUserPrediction(match.id)) : null;

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>Admin tools</h3>
          <p>League creator controls schedule sync, live overrides, and manual scoring fallbacks.</p>
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
            <span class="chip"><strong>Live data</strong>${hasApiKey ? "CricAPI connected" : "Manual only"}</span>
            <span class="chip"><strong>League</strong>IPL</span>
            <span class="chip"><strong>Season</strong>${escapeHtml(scheduleYear)}</span>
            <span class="chip"><strong>Matches in league</strong>${state.matches.length}</span>
            <span class="chip"><strong>Polling</strong>${escapeHtml(
              `${Math.round((APP_CONFIG.AUTO_SYNC_INTERVAL_MS || 90000) / 1000)} sec`,
            )}</span>
          </div>
          <div class="split-line" style="margin-top: 1rem;">
            <button class="btn" type="button" data-action="load-provider-fixtures" ${state.loadingProviderFixtures ? "disabled" : ""}>
              ${state.loadingProviderFixtures ? "Syncing schedule..." : "Sync IPL schedule"}
            </button>
            <span class="subtle">This creates or updates every IPL fixture for the selected league.</span>
          </div>
          ${
            hasApiKey
              ? ""
              : `
                <div class="notice notice-info" style="margin-top: 1rem;">
                  Official IPL fixtures will still sync. Add <code>CRICKET_API_KEY</code> in <code>app/config.js</code> if you also want synced squads, live overs, and automatic scoring.
                </div>
              `
          }
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
                          state.syncingMatchIds.has(match.id) ? "disabled" : ""
                        }>${state.syncingMatchIds.has(match.id) ? "Syncing..." : "Sync now"}</button>
                        <button class="ghost-btn" type="button" data-action="toggle-auto-sync" data-match-id="${match.id}">
                          ${match.auto_sync_enabled ? "Pause auto sync" : "Resume auto sync"}
                        </button>
                      </div>
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
                    <h4>Admin override</h4>
                    <p>Creator can override match timing and current ball if the live feed lags or needs correction.</p>
                  </div>
                </div>
                <form class="form-grid" id="admin-override-form">
                  <input type="hidden" name="match_id" value="${match.id}" />
                  <div class="field">
                    <label for="override-status">Status</label>
                    <select id="override-status" name="status">
                      ${["scheduled", "live", "locked", "completed", "cancelled"]
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
              </div>
              <div class="admin-card">
                <div class="section-head">
                  <div>
                    <h4>Manual result fallback</h4>
                    <p>Use this only if the provider result or scorecard is missing and you need to settle points manually.</p>
                  </div>
                </div>
                <form class="form-grid" id="result-form">
                  <input type="hidden" name="match_id" value="${match.id}" />
                  <div class="field">
                    <label for="result-winner">Winner</label>
                    <select id="result-winner" name="winner_team">
                      <option value="">Choose winner</option>
                      <option value="${escapeAttribute(match.team_a)}" ${
                        match.match_results?.winner_team === match.team_a ? "selected" : ""
                      }>${escapeHtml(match.team_a)}</option>
                      <option value="${escapeAttribute(match.team_b)}" ${
                        match.match_results?.winner_team === match.team_b ? "selected" : ""
                      }>${escapeHtml(match.team_b)}</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="result-total">1st innings total</label>
                    <input id="result-total" type="text" inputmode="numeric" name="first_innings_total" value="${escapeAttribute(
                      match.match_results?.first_innings_total ?? "",
                    )}" placeholder="182" />
                  </div>
                  <div class="field span-2">
                    <label for="result-batsmen">Batsman runs</label>
                    <textarea id="result-batsmen" name="batsman_runs" placeholder="Virat Kohli: 72">${escapeHtml(
                      mapToLines(match.match_results?.batsman_runs || {}),
                    )}</textarea>
                  </div>
                  <div class="field span-2">
                    <label for="result-bowlers">Bowler wickets</label>
                    <textarea id="result-bowlers" name="bowler_wickets" placeholder="Jasprit Bumrah: 2">${escapeHtml(
                      mapToLines(match.match_results?.bowler_wickets || {}),
                    )}</textarea>
                  </div>
                  <div class="field span-2">
                    <label for="result-notes">Result notes</label>
                    <textarea id="result-notes" name="notes" placeholder="Optional settlement note.">${escapeHtml(
                      match.match_results?.notes || "",
                    )}</textarea>
                  </div>
                  <div class="field span-2">
                    <button class="ghost-btn" type="submit">Save manual result</button>
                  </div>
                </form>
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
    if (form.id === "magic-link-form") {
      await submitMagicLink(form);
      return;
    }

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

    if (form.id === "admin-override-form") {
      await saveAdminOverride(form);
    }
  } catch (error) {
    console.error(error);
    flash(error.message || "That action failed.", "error");
  }
}

async function submitMagicLink(form) {
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const displayName = cleanText(formData.get("display_name"), 40);

  if (!email || !displayName) {
    throw new Error("Please add both your email and display name.");
  }

  window.localStorage.setItem("ipl-pending-display-name", displayName);

  const { error } = await state.client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href,
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    throw error;
  }

  flash(`Magic link sent to ${email}. Open it on this device to sign in.`, "success");
  form.reset();
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
    );
    render();
    flash("Demo profile updated locally.", "success");
    return;
  }

  const { error } = await state.client.rpc("sync_member_display_name", {
    p_display_name: displayName,
  });

  if (error) {
    throw error;
  }

  await ensureProfile();
  await loadMemberships();
  await loadLeagueBundle();
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

  const { error } = await state.client.rpc("create_league", {
    p_name: name,
    p_season: season || "IPL 2026",
  });

  if (error) {
    throw error;
  }

  await loadMemberships();
  await loadLeagueBundle();
  let scheduleMessage = "League created. Share the invite code with your friends.";

  if (hasCricketApiConfig()) {
    try {
      await loadProviderFixtures({ quiet: true, flashSuccess: false });
      scheduleMessage = "League created and the IPL schedule was synced.";
    } catch (syncError) {
      console.error(syncError);
      scheduleMessage = "League created, but IPL schedule sync needs a retry from admin tools.";
    }
  }

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

  const { error } = await state.client.rpc("join_league", {
    p_invite_code: inviteCode,
  });

  if (error) {
    throw error;
  }

  await loadMemberships();
  await loadLeagueBundle();
  render();
  form.reset();
  flash(`Joined league with code ${inviteCode}.`, "success");
}

async function savePrediction(form) {
  const formData = new FormData(form);
  const matchId = String(formData.get("match_id") || "");
  const batsmanName = cleanNullableText(formData.get("batsman_name"), 80);
  const bowlerName = cleanNullableText(formData.get("bowler_name"), 80);
  const teamPick = cleanNullableText(formData.get("team_pick"), 80);
  const predictedScoreRaw = String(formData.get("predicted_score") || "").trim();

  const hasCoreValue = [batsmanName, bowlerName, teamPick].some(Boolean);
  if (hasCoreValue && [batsmanName, bowlerName, teamPick].some((value) => !value)) {
    throw new Error("Submit batsman, bowler, and winning team together.");
  }

  const predictedScore =
    predictedScoreRaw === "" ? null : Number.parseInt(predictedScoreRaw, 10);

  if (predictedScoreRaw !== "" && Number.isNaN(predictedScore)) {
    throw new Error("Score prediction must be a number.");
  }

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
  render();
  flash("Prediction saved.", "success");
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

  const { error } = await state.client.from("matches").update(payload).eq("id", matchId);

  if (error) {
    throw error;
  }

  await loadLeagueBundle();
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
  render();
  form.reset();
  flash("Match created.", "success");
}

async function saveTimeline(form) {
  const formData = new FormData(form);

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
  render();
  flash("Match timeline updated.", "success");
}

async function saveResult(form) {
  const formData = new FormData(form);
  const winnerTeam = cleanText(formData.get("winner_team"), 80);
  const total = Number.parseInt(String(formData.get("first_innings_total") || ""), 10);
  const batsmanRuns = parseScoreLines(String(formData.get("batsman_runs") || ""));
  const bowlerWickets = parseScoreLines(String(formData.get("bowler_wickets") || ""));
  const notes = cleanNullableText(formData.get("notes"), 1000);

  if (!winnerTeam || Number.isNaN(total)) {
    throw new Error("Winner and first innings total are required.");
  }

  const { error } = await state.client.rpc("save_match_result", {
    p_match_id: String(formData.get("match_id") || ""),
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
    if (action === "sign-out") {
      await state.client.auth.signOut();
      flash("Signed out.", "success");
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

    if (action === "toggle-auto-sync") {
      const matchId = target.getAttribute("data-match-id");
      await toggleAutoSync(matchId);
      return;
    }

    if (action === "install-app") {
      await installApp();
      return;
    }

    if (action === "select-match") {
      state.selectedMatchId = target.getAttribute("data-match-id");
      render();
    }
  } catch (error) {
    console.error(error);
    flash(error.message || "Action failed.", "error");
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.id === "create-starts-at" && !document.getElementById("create-picks-at")?.value) {
    document.getElementById("create-picks-at").value = target.value;
  }
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (
    target.name === "predicted_score" ||
    target.name === "current_innings_ball" ||
    target.name === "first_innings_total"
  ) {
    target.value = target.value.replace(/\D+/g, "");
  }
}

function getActiveLeague() {
  return state.memberships.find((membership) => membership.league_id === state.activeLeagueId)
    ?.leagues;
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

function chooseDefaultMatchId(matches = state.matches) {
  if (!matches.length) {
    return null;
  }

  const liveMatch = matches.find((match) => computeMatchStatus(match) === "live");
  if (liveMatch) {
    return liveMatch.id;
  }

  const activeWindowMatch = matches.find((match) => {
    const liveWindow = getLiveWindowState(match, getCurrentUserPrediction(match.id));
    return liveWindow.submissionWindowOpen && !liveWindow.scoreLocked;
  });

  if (activeWindowMatch) {
    return activeWindowMatch.id;
  }

  const upcomingMatch = matches.find((match) => {
    const startsAt = match?.starts_at ? new Date(match.starts_at).getTime() : null;
    return startsAt && startsAt >= Date.now();
  });

  return upcomingMatch?.id || matches[0].id;
}

function getPredictionsForMatch(matchId) {
  return state.predictions.filter((entry) => entry.match_id === matchId);
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

function computeMatchStatus(match) {
  if (match.match_results) {
    return "completed";
  }

  if (match.status === "cancelled") {
    return "cancelled";
  }

  if (match.status === "completed") {
    return "completed";
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

function renderLeaderboardRow(entry, index) {
  const sameUser = entry.user_id === state.user?.id;

  return `
    <div class="leaderboard-item ${sameUser ? "current-user" : ""}">
      <div class="split-line">
        <div class="leaderboard-rank">${index + 1}</div>
        <div>
          <strong>${escapeHtml(entry.display_name)}</strong>
          <div class="leaderboard-meta">
            <span class="subtle">${entry.matches_joined || 0} matches joined</span>
            <span class="subtle">${entry.role}</span>
          </div>
        </div>
      </div>
      <div class="leaderboard-points">
        <strong>${escapeHtml(entry.total_points ?? 0)}</strong>
        <span class="subtle">points</span>
      </div>
    </div>
  `;
}

function buildLeaderboardFromMatches(members, predictions, matches) {
  const rows = members.map((member) => ({
    league_id: member.league_id,
    user_id: member.user_id,
    display_name: member.display_name,
    role: member.role,
    matches_joined: 0,
    batsman_points: 0,
    bowler_points: 0,
    score_points: 0,
    team_points: 0,
    total_points: 0,
  }));

  const rowByUserId = Object.fromEntries(rows.map((row) => [row.user_id, row]));

  for (const prediction of predictions) {
    const row = rowByUserId[prediction.user_id];
    const match = matches.find((item) => item.id === prediction.match_id);
    const result = match?.match_results;

    if (!row) {
      continue;
    }

    row.matches_joined += 1;

    if (!result) {
      continue;
    }

    const batsmanKey = normalizeName(prediction.batsman_name);
    const bowlerKey = normalizeName(prediction.bowler_name);
    row.batsman_points += Number(result.batsman_runs?.[batsmanKey] || 0);
    row.bowler_points += Number(result.bowler_wickets?.[bowlerKey] || 0) * 20;
    row.score_points += Number(result.first_innings_total) === Number(prediction.predicted_score) ? 10 : 0;
    row.team_points += result.winner_team === prediction.team_pick ? 50 : 0;
    row.total_points =
      row.batsman_points + row.bowler_points + row.score_points + row.team_points;
  }

  return rows.sort(
    (left, right) => right.total_points - left.total_points || left.display_name.localeCompare(right.display_name),
  );
}

function hasCricketApiConfig() {
  return !state.demoMode && Boolean(String(APP_CONFIG.CRICKET_API_KEY || "").trim());
}

function getLiveWindowState(match, prediction) {
  const currentBall = toOptionalInteger(match?.current_innings_ball);
  const currentOverDisplay =
    cleanNullableText(match?.current_over_display, 20) ||
    (currentBall !== null ? formatBallsAsOvers(currentBall) : null);
  const startsAtMs = match?.starts_at ? new Date(match.starts_at).getTime() : null;
  const submissionStartsAt =
    startsAtMs && !Number.isNaN(startsAtMs)
      ? new Date(startsAtMs - CORE_OPEN_WINDOW_MS).toISOString()
      : null;
  const submissionWindowOpen = submissionStartsAt
    ? Date.now() >= new Date(submissionStartsAt).getTime()
    : true;
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
    Boolean(prediction?.core_locked_due_to_pre_xi) ||
    (currentBall !== null ? currentBall >= CORE_LOCK_BALL : coreLockedByTime);
  const scoreLocked = currentBall !== null ? currentBall >= SCORE_LOCK_BALL : scoreLockedByTime;
  const scoreWindowOpen =
    !scoreLocked &&
    (currentBall !== null ? currentBall >= CORE_LOCK_BALL : scoreWindowOpenByTime);
  const coreWindowOpen = submissionWindowOpen && !coreLocked;

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

  if (!liveWindow.submissionWindowOpen) {
    return `Opens ${formatDate(liveWindow.submissionStartsAt) || "2 hours before start"}`;
  }

  return formatDate(match?.picks_deadline_at) || "Waiting for live clock";
}

function formatScoreLockLabel(match, liveWindow) {
  if (liveWindow.currentBall !== null) {
    return liveWindow.scoreLocked
      ? `Locked at 7.1 overs (${liveWindow.currentOverDisplay || "live"})`
      : `Open until 7.1 overs (${liveWindow.currentOverDisplay || "live"})`;
  }

  if (!liveWindow.scoreWindowOpen && !liveWindow.scoreLocked) {
    return `Opens after core lock (${formatDate(match?.picks_deadline_at) || "3.1 overs"})`;
  }

  return formatDate(match?.score_deadline_at) || "Waiting for live clock";
}

function getPlayingXiGroups(match) {
  const payload = match?.playing_xi && typeof match.playing_xi === "object"
    ? match.playing_xi
    : buildEmptyPlayingXi();

  return [
    {
      teamName: match?.team_a || "Team A",
      players: normalizePlayerList(payload.team_a, match?.team_a || "Team A"),
    },
    {
      teamName: match?.team_b || "Team B",
      players: normalizePlayerList(payload.team_b, match?.team_b || "Team B"),
    },
  ];
}

function getSelectablePlayers(match, role, prediction) {
  const currentValue =
    role === "batsman" ? prediction?.batsman_name || "" : prediction?.bowler_name || "";
  const currentKey = normalizeName(currentValue);
  const taken = new Set(
    getPredictionsForMatch(match.id)
      .filter((entry) => entry.user_id !== state.user?.id)
      .map((entry) =>
        normalizeName(role === "batsman" ? entry.batsman_name : entry.bowler_name),
      )
      .filter(Boolean),
  );

  return getPlayingXiGroups(match).map((group) => ({
    teamName: group.teamName,
    players: group.players.filter((player) => {
      const playerKey = normalizeName(player.name);
      return !taken.has(playerKey) || playerKey === currentKey;
    }),
  }));
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

function getMatchSyncSummary(match) {
  const liveWindow = getLiveWindowState(match, null);
  const playerCount = getPlayingXiGroups(match).reduce(
    (count, group) => count + group.players.length,
    0,
  );
  const sourceLabel =
    match?.provider === "ipl-official"
      ? "Official IPL"
      : match?.provider === "hybrid"
        ? "Official IPL + CricAPI"
        : match?.external_match_id
          ? "CricAPI"
          : "Manual";

  return {
    source: sourceLabel,
    playingXiLabel: playerCount ? `${playerCount} squad players synced` : "Waiting for squads",
    liveClock: liveWindow.currentOverDisplay
      ? `${liveWindow.currentOverDisplay} overs`
      : match?.innings_started_at
        ? "Innings started"
        : "Not started",
    lastSynced: formatDate(match?.last_synced_at) || "Not synced yet",
  };
}

function shouldAutoSyncMatch(match) {
  if (!match?.external_match_id || !match?.auto_sync_enabled || match?.match_results) {
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
    const fixtures = await fetchProviderFixtures();
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
      flash(
        `IPL schedule synced. ${created} created, ${updated} refreshed.`,
        "success",
      );
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

  if (!hasCricketApiConfig()) {
    throw new Error("Add a cricket API key in app/config.js to sync live match data.");
  }

  markMatchSyncing(match.id, true, background);

  try {
    const latestSnapshot = await fetchProviderMatchSnapshot(match.external_match_id);
    const enrichedSnapshot = await enrichFixtureWithPlayingXi(latestSnapshot, match);
    await upsertSyncedMatchRow(match, enrichedSnapshot);

    if (!match.match_results) {
      await settleSyncedMatchIfReady(match, enrichedSnapshot);
    }

    if (!skipReload) {
      await loadLeagueBundle();
      render();
    }

    if (flashSuccess) {
      flash("Live match data synced.", "success");
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

async function saveMatchSyncError(matchId, error) {
  if (!matchId || !state.client) {
    return;
  }

  const message = cleanText(error?.message || "Sync failed.", 300);
  await state.client.from("matches").update({ sync_error: message }).eq("id", matchId);
}

async function upsertSyncedMatchRow(existingMatch, fixture) {
  const defaultNotes =
    "Match synced from the official IPL fixture feed. When a CricAPI match ID is available, squads, live overs, and automatic settlement stay connected to the 3.1 and 7.1 over rules.";
  const notes =
    !existingMatch?.notes ||
    /match synced from cricapi|match synced from the official ipl fixture feed/i.test(
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
    status: fixture.status || existingMatch?.status || "scheduled",
    notes,
    provider: fixture.provider || existingMatch?.provider || "manual",
    external_match_id: fixture.external_match_id || existingMatch?.external_match_id || null,
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

  return startsAt - Date.now() <= CORE_OPEN_WINDOW_MS;
}

async function settleSyncedMatchIfReady(match, snapshot) {
  if (computeProviderMatchStatus(snapshot) !== "completed") {
    return;
  }

  const scorecard = await fetchMatchScorecard(snapshot.external_match_id);
  const settlement = extractSettlementPayload(scorecard, match, snapshot);
  if (!settlement) {
    return;
  }

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
  const [officialFixtures, providerFixtures] = await Promise.all([
    fetchOfficialIplFixtures(seriesYear),
    fetchCricketApiSeasonFixtures(seriesYear),
  ]);

  return mergeOfficialFixturesWithProviderData(officialFixtures, providerFixtures).sort(
    (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
  );
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
  const response = await fetch(url, {
    headers: {
      Accept: "application/javascript, text/javascript, */*;q=0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Official IPL feed returned ${response.status}.`);
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

async function fetchProviderMatchSnapshot(externalMatchId) {
  for (const endpoint of ["currentMatches", "matches", "cricScore"]) {
    try {
      const payload = await fetchCricketApi(endpoint, { offset: 0 });
      const rawMatch = asArray(payload?.data).find(
        (item) => String(resolveProviderMatchId(item)) === String(externalMatchId),
      );

      if (rawMatch) {
        return normalizeProviderMatch(rawMatch);
      }
    } catch (error) {
      console.warn(`Unable to fetch ${endpoint} for ${externalMatchId}`, error);
    }
  }

  throw new Error("Live provider could not find this match right now.");
}

async function fetchPlayingXiSnapshot(externalMatchId, fixture) {
  const payload = await fetchCricketApi("match_squad", { id: externalMatchId });
  return extractPlayingXiFromPayload(payload, fixture);
}

async function fetchMatchScorecard(externalMatchId) {
  return fetchCricketApi("match_scorecard", { id: externalMatchId });
}

async function fetchCricketApi(endpoint, params = {}) {
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
    external_match_id: null,
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
  const text = String(oversValue || "").trim();
  if (!text) {
    return null;
  }

  const [oversPart, ballsPart = "0"] = text.split(".");
  const overs = Number.parseInt(oversPart, 10);
  const balls = Number.parseInt(ballsPart.slice(0, 1) || "0", 10);

  if (Number.isNaN(overs) || Number.isNaN(balls)) {
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

function normalizePlayerEntry(entry, fallbackTeam) {
  if (typeof entry === "string") {
    const name = cleanText(entry, 80);
    return name ? { name, team: fallbackTeam } : null;
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const name = cleanText(
    entry?.name || entry?.fullName || entry?.playerName || entry?.player || "",
    80,
  );
  if (!name) {
    return null;
  }

  return {
    name,
    team: cleanText(
      entry?.teamName || entry?.team || entry?.team_name || fallbackTeam || "",
      80,
    ),
    role: cleanNullableText(entry?.role || entry?.playerRole || entry?.skill, 40),
  };
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
  const root = scorecardPayload?.data ?? scorecardPayload ?? {};
  const batsmanRuns = extractBatsmanRuns(root);
  const bowlerWickets = extractBowlerWickets(root);
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
    notes: "Settled automatically from CricAPI scorecard.",
  };
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
    snapshot?.raw?.winner,
    snapshot?.raw?.winningTeam,
    snapshot?.raw?.matchWinner,
    snapshot?.raw?.status,
    root?.status,
  ];

  for (const candidate of candidates) {
    const teamName = matchTeamFromText(candidate, match);
    if (teamName) {
      return teamName;
    }
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

function extractBatsmanRuns(root) {
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

      const key = normalizeName(name);
      payload[key] = Math.max(payload[key] || 0, runs);
    }
  }

  return payload;
}

function extractBowlerWickets(root) {
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

      const key = normalizeName(name);
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

function parseScoreLines(rawText) {
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

    payload[normalizeName(name)] = value;
  }

  return payload;
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

function flash(message, tone = "info") {
  state.notice = { message, tone };
  render();
  window.clearTimeout(flash.timerId);
  flash.timerId = window.setTimeout(() => {
    state.notice = null;
    render();
  }, 4200);
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

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}
