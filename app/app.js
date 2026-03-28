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
    status: "live",
    notes:
      "Admin manually sets lock times based on TV/Hotstar rule. Use this screen as the source of truth.",
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

document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
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
    teardownRealtime();
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
    render();
    return;
  }

  const currentSelection = getSelectedMatch();
  if (!currentSelection) {
    const liveMatch = state.matches.find((match) => computeMatchStatus(match) === "live");
    state.selectedMatchId = liveMatch?.id || state.matches[0].id;
  }

  setupRealtime(leagueId);
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
        ${renderSetupPanel()}
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
            The app locks duplicate picks, respects timing windows, and keeps the full leaderboard in one place.
          </p>
          <div class="hero-actions">
            <a class="btn" href="#dashboard">Start the league</a>
            <a class="ghost-btn" href="#setup">Deployment steps</a>
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
                <p>Admin lock times keep the game fair when TV and streaming are out of sync.</p>
              </div>
            </div>
            <div class="chip-list">
              <span class="chip"><strong>No duplicates</strong>First come, first serve</span>
              <span class="chip"><strong>Pre-XI picks lock</strong>No edits after early core picks</span>
              <span class="chip"><strong>Server timestamps</strong>No phone clock cheating</span>
              <span class="chip"><strong>Free hosting</strong>Vercel + Supabase</span>
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
              <p>Pick the match everyone is currently playing.</p>
            </div>
          </div>
          ${
            state.matches.length
              ? `<div class="match-list">${state.matches
                  .map((item) => renderMatchCard(item))
                  .join("")}</div>`
              : `<div class="empty-state">No matches yet. ${
                  isAdmin ? "Create the first match below." : "Ask your admin to add one."
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
                    ? "No matches yet. Create the first one below."
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
        <span class="chip"><strong>${match.match_results ? "Scored" : "Pending"}</strong>Result status</span>
      </div>
    </button>
  `;
}

function renderMatchDetail(match, prediction, isAdmin) {
  const status = computeMatchStatus(match);
  const entries = getPredictionsForMatch(match.id);
  const coreLocked = isCoreLocked(match, prediction);
  const scoreLocked = isScoreLocked(match, prediction);
  const allWindowsLocked = coreLocked && scoreLocked;
  const scoreResult = match.match_results;

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
        <span class="chip"><strong>XI announced</strong>${escapeHtml(formatDate(match.playing_xi_announced_at) || "Not set")}</span>
        <span class="chip"><strong>Core picks lock</strong>${escapeHtml(formatDate(match.picks_deadline_at) || "Not set")}</span>
        <span class="chip"><strong>Score lock</strong>${escapeHtml(formatDate(match.score_deadline_at) || "Not set")}</span>
        <span class="chip"><strong>Invite fairness</strong>Server timestamps decide all ties</span>
      </div>

      ${
        match.notes
          ? `<p class="footnote">${escapeHtml(match.notes)}</p>`
          : ""
      }

      <div class="grid-2">
        <div class="panel">
          <div class="section-head">
            <div>
              <h4>Your prediction</h4>
              <p>${coreLocked ? "Core picks are locked for this match." : "Post or update your picks inside the open window."}</p>
            </div>
          </div>
          ${
            state.demoMode
              ? `<div class="notice notice-info">Demo mode is read-only. Configure Supabase to save real entries.</div>`
              : !state.user
                ? `<div class="empty-state">Sign in to submit picks.</div>`
                : `
                  <form class="form-grid" id="prediction-form">
                    <input type="hidden" name="match_id" value="${match.id}" />
                    <div class="field">
                      <label for="batsman-name">Batsman</label>
                      <input id="batsman-name" name="batsman_name" placeholder="Virat Kohli" value="${escapeAttribute(
                        prediction?.batsman_name || "",
                      )}" ${coreLocked ? "disabled" : ""} />
                    </div>
                    <div class="field">
                      <label for="bowler-name">Bowler</label>
                      <input id="bowler-name" name="bowler_name" placeholder="Jasprit Bumrah" value="${escapeAttribute(
                        prediction?.bowler_name || "",
                      )}" ${coreLocked ? "disabled" : ""} />
                    </div>
                    <div class="field">
                      <label for="team-pick">Winning team</label>
                      <select id="team-pick" name="team_pick" ${coreLocked ? "disabled" : ""}>
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
                        Enter batsman, bowler, and team together. Exact score can be added later until the score lock.
                        If your core picks were submitted before the playing XI announcement, they become permanently locked.
                      </small>
                    </div>
                    <div class="field span-2">
                      <button class="btn" type="submit" ${allWindowsLocked ? "disabled" : ""}>${
                        allWindowsLocked ? "Prediction locked" : "Save prediction"
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
              <p>These values are already locked by other players for this match.</p>
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

      ${
        scoreResult
          ? `
            <div class="panel">
              <div class="section-head">
                <div>
                  <h4>Scored result</h4>
                  <p>Points have been calculated for this match.</p>
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
            ? `<div class="notice notice-info">Admin will enter results here once the match is complete.</div>`
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
  const leagueId = match?.league_id || state.activeLeagueId || "";

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h3>Admin tools</h3>
          <p>Use these forms to add matches, lock windows, and settle points.</p>
        </div>
      </div>
      <div class="stack">
        <form class="admin-card" id="create-match-form">
          <div class="section-head">
            <div>
              <h4>Create match</h4>
              <p>Add upcoming fixtures for your league.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="create-team-a">Team A</label>
              <input id="create-team-a" name="team_a" placeholder="Chennai Super Kings" required />
            </div>
            <div class="field">
              <label for="create-team-b">Team B</label>
              <input id="create-team-b" name="team_b" placeholder="Mumbai Indians" required />
            </div>
            <div class="field">
              <label for="create-title">Title</label>
              <input id="create-title" name="title" placeholder="CSK vs MI" />
            </div>
            <div class="field">
              <label for="create-venue">Venue</label>
              <input id="create-venue" name="venue" placeholder="Chepauk" />
            </div>
            <div class="field">
              <label for="create-starts-at">Match starts at</label>
              <input id="create-starts-at" type="datetime-local" name="starts_at" required />
            </div>
            <div class="field">
              <label for="create-xi-at">Playing XI announced at</label>
              <input id="create-xi-at" type="datetime-local" name="playing_xi_announced_at" />
            </div>
            <div class="field">
              <label for="create-picks-at">Core picks lock</label>
              <input id="create-picks-at" type="datetime-local" name="picks_deadline_at" required />
            </div>
            <div class="field">
              <label for="create-score-at">Score lock</label>
              <input id="create-score-at" type="datetime-local" name="score_deadline_at" required />
            </div>
            <div class="field span-2">
              <label for="create-notes">Notes</label>
              <textarea id="create-notes" name="notes" placeholder="Optional reminder about lock rules or rain rules."></textarea>
            </div>
            <input type="hidden" name="league_id" value="${leagueId}" />
            <div class="field span-2">
              <button class="btn" type="submit">Create match</button>
            </div>
          </div>
        </form>
        ${
          match
            ? `
              <form class="timeline-card" id="timeline-form">
                <div class="section-head">
                  <div>
                    <h4>Edit lock windows</h4>
                    <p>Set the official source-of-truth timestamps for this match.</p>
                  </div>
                </div>
                <div class="form-grid">
                  <input type="hidden" name="match_id" value="${match.id}" />
                  <div class="field">
                    <label for="timeline-status">Status</label>
                    <select id="timeline-status" name="status">
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
                    <label for="timeline-starts-at">Starts at</label>
                    <input id="timeline-starts-at" type="datetime-local" name="starts_at" value="${escapeAttribute(
                      toDateTimeInput(match.starts_at),
                    )}" />
                  </div>
                  <div class="field">
                    <label for="timeline-innings-at">Innings started at</label>
                    <input id="timeline-innings-at" type="datetime-local" name="innings_started_at" value="${escapeAttribute(
                      toDateTimeInput(match.innings_started_at),
                    )}" />
                  </div>
                  <div class="field">
                    <label for="timeline-xi-at">Playing XI announced at</label>
                    <input id="timeline-xi-at" type="datetime-local" name="playing_xi_announced_at" value="${escapeAttribute(
                      toDateTimeInput(match.playing_xi_announced_at),
                    )}" />
                  </div>
                  <div class="field">
                    <label for="timeline-picks-at">Core picks lock</label>
                    <input id="timeline-picks-at" type="datetime-local" name="picks_deadline_at" value="${escapeAttribute(
                      toDateTimeInput(match.picks_deadline_at),
                    )}" required />
                  </div>
                  <div class="field">
                    <label for="timeline-score-at">Score lock</label>
                    <input id="timeline-score-at" type="datetime-local" name="score_deadline_at" value="${escapeAttribute(
                      toDateTimeInput(match.score_deadline_at),
                    )}" required />
                  </div>
                  <div class="field span-2">
                    <button class="btn" type="submit">Save match timeline</button>
                  </div>
                </div>
              </form>

              <form class="admin-card" id="result-form">
                <div class="section-head">
                  <div>
                    <h4>Settle result</h4>
                    <p>Enter normalized scoring data once the match is complete.</p>
                  </div>
                </div>
                <div class="form-grid">
                  <input type="hidden" name="match_id" value="${match.id}" />
                  <div class="field">
                    <label for="result-winner">Winner</label>
                    <select id="result-winner" name="winner_team" required>
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
                    <input id="result-total" type="number" min="0" name="first_innings_total" value="${escapeAttribute(
                      match.match_results?.first_innings_total ?? "",
                    )}" required />
                  </div>
                  <div class="field span-2">
                    <label for="result-batsmen">Batsman runs</label>
                    <textarea id="result-batsmen" name="batsman_runs" placeholder="Virat Kohli: 72&#10;Ajinkya Rahane: 29">${escapeHtml(
                      mapToLines(match.match_results?.batsman_runs),
                    )}</textarea>
                    <small>Use one line per player in the format <code>Name: runs</code>.</small>
                  </div>
                  <div class="field span-2">
                    <label for="result-bowlers">Bowler wickets</label>
                    <textarea id="result-bowlers" name="bowler_wickets" placeholder="Varun Chakravarthy: 3&#10;Jasprit Bumrah: 2">${escapeHtml(
                      mapToLines(match.match_results?.bowler_wickets),
                    )}</textarea>
                    <small>Use one line per player in the format <code>Name: wickets</code>.</small>
                  </div>
                  <div class="field span-2">
                    <label for="result-notes">Result notes</label>
                    <textarea id="result-notes" name="notes" placeholder="Optional note for rain, DLS, abandoned games, or disputes.">${escapeHtml(
                      match.match_results?.notes || "",
                    )}</textarea>
                  </div>
                  <div class="field span-2">
                    <button class="btn" type="submit">Save scored result</button>
                  </div>
                </div>
              </form>
            `
            : `
              <div class="empty-state">
                Create a match first, then the lock-window and scoring forms for that match will appear here.
              </div>
            `
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

    if (form.id === "prediction-form") {
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
  render();
  form.reset();
  flash("League created. Share the invite code with your friends.", "success");
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

  const now = Date.now();
  const picksDeadline = match.picks_deadline_at
    ? new Date(match.picks_deadline_at).getTime()
    : null;
  const scoreDeadline = match.score_deadline_at
    ? new Date(match.score_deadline_at).getTime()
    : null;
  const startsAt = match.starts_at ? new Date(match.starts_at).getTime() : null;

  if (scoreDeadline && now > scoreDeadline) {
    return "locked";
  }

  if (startsAt && now >= startsAt) {
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
  if (prediction?.core_locked_due_to_pre_xi) {
    return true;
  }

  if (!match?.picks_deadline_at) {
    return false;
  }

  return Date.now() > new Date(match.picks_deadline_at).getTime();
}

function isScoreLocked(match, prediction) {
  if (!match?.score_deadline_at) {
    return false;
  }

  return Date.now() > new Date(match.score_deadline_at).getTime();
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
