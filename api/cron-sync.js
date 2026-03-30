const { syncActiveMatches } = require("./_lib/match-sync");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  try {
    assertAuthorizedCronRequest(req);

    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const limit = Math.max(Number.parseInt(process.env.CRON_SYNC_MATCH_LIMIT || "40", 10) || 40, 1);
    const report = await syncActiveMatches({
      supabaseUrl,
      supabaseServiceRoleKey,
      limit,
    });

    res.status(200).send(
      JSON.stringify({
        ok: true,
        ran_at: new Date().toISOString(),
        ...report,
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
        error: error?.message || "Cron sync failed.",
      }),
    );
  }
};

function assertAuthorizedCronRequest(req) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (!cronSecret) {
    const error = new Error("CRON_SECRET is not configured.");
    error.status = 500;
    throw error;
  }

  const authHeader = String(req.headers?.authorization || "").trim();
  if (authHeader !== `Bearer ${cronSecret}`) {
    const error = new Error("Unauthorized cron request.");
    error.status = 401;
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
