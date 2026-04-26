const { syncActiveMatches } = require("./_lib/match-sync");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).send(JSON.stringify({ ok: false, error: "Method not allowed." }));
      return;
    }

    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const body = await readJsonBody(req);
    const leagueId = String(body?.leagueId || "").trim();

    if (!leagueId) {
      res.status(400).send(JSON.stringify({ ok: false, error: "leagueId is required." }));
      return;
    }

    const accessToken = readBearerToken(req);
    const user = await fetchAuthedUser(supabaseUrl, supabaseServiceRoleKey, accessToken);
    await assertActiveLeagueMembership(
      supabaseUrl,
      supabaseServiceRoleKey,
      leagueId,
      user.id,
    );

    const limit = Math.max(
      Number.parseInt(
        process.env.MEMBER_SYNC_MATCH_LIMIT || process.env.CRON_SYNC_MATCH_LIMIT || "24",
        10,
      ) || 24,
      1,
    );

    const report = await syncActiveMatches({
      supabaseUrl,
      supabaseServiceRoleKey,
      limit,
      leagueId,
    });

    res.status(200).send(
      JSON.stringify({
        ok: true,
        ran_at: new Date().toISOString(),
        report,
      }),
    );
  } catch (error) {
    const status =
      Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
        ? error.status
        : 500;

    res.status(status).send(
      JSON.stringify({
        ok: false,
        error: error?.message || "Server sync failed.",
      }),
    );
  }
};

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

function readBearerToken(req) {
  const authHeader = String(req.headers?.authorization || "").trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    const error = new Error("Authorization token is required.");
    error.status = 401;
    throw error;
  }

  return match[1].trim();
}

async function fetchAuthedUser(supabaseUrl, supabaseServiceRoleKey, accessToken) {
  const response = await fetch(
    `${String(supabaseUrl || "").replace(/\/+$/, "")}/auth/v1/user`,
    {
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = new Error("Your session is invalid. Please sign in again.");
    error.status = response.status === 401 ? 401 : 403;
    throw error;
  }

  const user = await response.json();
  if (!user?.id) {
    const error = new Error("Could not resolve the signed-in user.");
    error.status = 401;
    throw error;
  }

  return user;
}

async function assertActiveLeagueMembership(
  supabaseUrl,
  supabaseServiceRoleKey,
  leagueId,
  userId,
) {
  const url = new URL(
    "/rest/v1/league_members",
    String(supabaseUrl || "").replace(/\/+$/, ""),
  );
  url.searchParams.set("select", "league_id,user_id,is_active");
  url.searchParams.set("league_id", `eq.${leagueId}`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("is_active", "is.true");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = new Error("Could not verify league membership for server sync.");
    error.status = 500;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error("You are not allowed to sync this league.");
    error.status = 403;
    throw error;
  }
}

function readRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    const error = new Error(`${name} is not configured.`);
    error.status = 500;
    throw error;
  }

  return value;
}
