const appRoot = document.getElementById("app");
const appUrl = new URL("./app.js", import.meta.url);
const configUrl = new URL("./config.js", import.meta.url);

loadPatchedApp().catch((error) => {
  console.error("App bootstrap failed", error);

  if (!appRoot) {
    return;
  }

  appRoot.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#09172d;color:#f5f7fb;font-family:'Space Grotesk',sans-serif;">
      <div style="max-width:560px;padding:24px 28px;border:1px solid rgba(255,255,255,0.16);border-radius:20px;background:rgba(7,16,31,0.9);box-shadow:0 24px 80px rgba(0,0,0,0.45);">
        <h1 style="margin:0 0 12px;font-size:1.5rem;">Indian Prediction League</h1>
        <p style="margin:0 0 8px;line-height:1.6;">The app could not finish loading right now.</p>
        <p style="margin:0;color:#9fb4d1;line-height:1.6;">Please refresh once more. If it still fails, ask the admin to redeploy the latest files.</p>
      </div>
    </div>
  `;
});

async function loadPatchedApp() {
  const response = await fetch(appUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to fetch app bundle (${response.status}).`);
  }

  const rawSource = await response.text();
  const repairedSource = repairSource(rawSource, configUrl.href);
  const blob = new Blob([repairedSource], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    await import(blobUrl);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  }
}

function repairSource(source, absoluteConfigUrl) {
  return source
    .replace('from "./config.js"', `from "${absoluteConfigUrl}"`)
    .replace('from"./config.js"', `from "${absoluteConfigUrl}"`)
    .replace(/`:'\n([\s\S]*?)\n(\s*)'\}/g, "`:`\n$1\n$2`}")
    .replace(/return'\n([\s\S]*?)\n(\s*)';const/g, "return`\n$1\n$2`;const")
    .replace(
      'value="${e?.league_id||a.activeLeagueId||"")}"',
      'value="${e?.league_id||a.activeLeagueId||""}"',
    );
}
