const DEFAULT_COMPETITION_URL = "https://scores.iplt20.com/ipl/mc/competition.js";
const DEFAULT_FEED_BASE_URL =
  "https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds";
const ALLOWED_HOSTS = new Set([
  "scores.iplt20.com",
  "ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com",
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

function parseJsonpPayload(source) {
  const text = String(source || "").trim();
  const startIndex = text.indexOf("(");
  const endIndex = text.lastIndexOf(")");

  if (startIndex < 0 || endIndex <= startIndex) {
    throw new Error("Official IPL feed returned an unexpected format.");
  }

  return JSON.parse(text.slice(startIndex + 1, endIndex));
}
