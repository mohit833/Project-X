const DEFAULT_COMPETITION_URL = "https://scores.iplt20.com/ipl/mc/competition.js";
const DEFAULT_FEED_BASE_URL =
  "https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds";
const DEFAULT_TEAM_BASE_URL = "https://www.iplt20.com/teams";
const ALLOWED_HOSTS = new Set([
  "scores.iplt20.com",
  "ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com",
]);
const ALLOWED_TEAM_SLUGS = new Set([
  "chennai-super-kings",
  "delhi-capitals",
  "gujarat-titans",
  "kolkata-knight-riders",
  "lucknow-super-giants",
  "mumbai-indians",
  "punjab-kings",
  "rajasthan-royals",
  "royal-challengers-bengaluru",
  "sunrisers-hyderabad",
]);

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  try {
    const kind = String(req.query.kind || "").trim();

    if (kind === "competition") {
      const payload = await fetchJsonpPayload(DEFAULT_COMPETITION_URL);
      res.status(200).send(JSON.stringify(payload));
      return;
    }

    if (kind === "schedule") {
      const competitionId = String(req.query.competitionId || "").trim();
      if (!competitionId) {
        res.status(400).send(JSON.stringify({ error: "competitionId is required." }));
        return;
      }

      const requestedFeedBaseUrl = String(req.query.feedBaseUrl || "").trim();
      const feedBaseUrl = requestedFeedBaseUrl || DEFAULT_FEED_BASE_URL;
      const parsedFeedBaseUrl = new URL(feedBaseUrl);

      if (!ALLOWED_HOSTS.has(parsedFeedBaseUrl.hostname)) {
        res.status(400).send(JSON.stringify({ error: "Unsupported official IPL host." }));
        return;
      }

      const scheduleUrl = new URL(`${competitionId}-matchschedule.js`, `${parsedFeedBaseUrl.href.replace(/\/$/, "")}/`);
      const payload = await fetchJsonpPayload(scheduleUrl.toString());
      res.status(200).send(JSON.stringify(payload));
      return;
    }

    if (kind === "team-squad") {
      const teamSlug = String(req.query.teamSlug || "").trim().toLowerCase();
      const season = String(req.query.season || "").replace(/\D+/g, "").slice(0, 4) || String(new Date().getUTCFullYear());

      if (!ALLOWED_TEAM_SLUGS.has(teamSlug)) {
        res.status(400).send(JSON.stringify({ error: "Unsupported official IPL team." }));
        return;
      }

      let html = await fetchText(`${DEFAULT_TEAM_BASE_URL}/${teamSlug}/squad/${season}`);
      let players = parseOfficialTeamSquadHtml(html);

      if (!players.length) {
        html = await fetchText(`${DEFAULT_TEAM_BASE_URL}/${teamSlug}`);
        players = parseOfficialTeamSquadHtml(html);
      }

      res.status(200).send(JSON.stringify({ teamSlug, season, players }));
      return;
    }

    res.status(400).send(JSON.stringify({ error: "Unsupported official IPL request." }));
  } catch (error) {
    res
      .status(500)
      .send(JSON.stringify({ error: error?.message || "Official IPL proxy failed." }));
  }
};

async function fetchJsonpPayload(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/javascript, text/javascript, */*;q=0.1",
      "User-Agent": "IPL-Prediction-League/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Official IPL feed returned ${response.status}.`);
  }

  const text = await response.text();
  return parseJsonpPayload(text);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "IPL-Prediction-League/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Official IPL page returned ${response.status}.`);
  }

  return response.text();
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
    const normalizedName = normalizePick(name);

    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    players.push({
      name,
      role: role || null,
    });
  }

  return players;
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

function normalizePick(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
