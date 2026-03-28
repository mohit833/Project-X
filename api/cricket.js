const DEFAULT_CRICKET_API_BASE_URL = "https://api.cricapi.com/v1";
const DEFAULT_CRICKET_API_KEY = "8db084ef-3c67-48d0-b567-87665c0ba3b2";
const ALLOWED_ENDPOINTS = new Set([
  "series",
  "series_info",
  "currentMatches",
  "matches",
  "cricScore",
  "match_squad",
  "match_scorecard",
]);

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  try {
    const endpoint = String(req.query.endpoint || "").replace(/^\//, "").trim();
    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      res.status(400).send(JSON.stringify({ error: "Unsupported cricket endpoint." }));
      return;
    }

    const baseUrl = String(
      process.env.CRICKET_API_BASE_URL || DEFAULT_CRICKET_API_BASE_URL,
    ).replace(/\/$/, "");
    const apiKey = String(process.env.CRICKET_API_KEY || DEFAULT_CRICKET_API_KEY).trim();

    if (!apiKey) {
      res.status(500).send(JSON.stringify({ error: "CRICKET_API_KEY is not configured." }));
      return;
    }

    const url = new URL(`${baseUrl}/${endpoint}`);
    url.searchParams.set("apikey", apiKey);

    for (const [key, value] of Object.entries(req.query)) {
      if (key === "endpoint" || value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "IPL-Prediction-League/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Cricket API returned ${response.status}.`);
    }

    const payload = await response.json();
    res.status(200).send(JSON.stringify(payload));
  } catch (error) {
    res.status(500).send(JSON.stringify({ error: error?.message || "Cricket proxy failed." }));
  }
};
