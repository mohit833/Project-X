# IPL Prediction League

A multiplayer IPL prediction web app for friend groups. It supports:

- invite-code based private leagues
- one batsman, one bowler, one winning team, and one exact 1st innings score per player
- no duplicate batsman, bowler, or score picks for the same match
- pre-playing-XI core picks that lock permanently
- admin-controlled match windows for fairness across TV and streaming delay
- match scoring and season leaderboard
- installable mobile web app support

## Stack

- Static frontend: plain HTML, CSS, and browser JavaScript
- Backend: Supabase Auth + Postgres + Realtime
- Hosting: Vercel static hosting

This keeps the app cheap and easy to deploy for a private friends league.

## Project structure

- `index.html`: entry page
- `app/app.js`: UI and Supabase integration
- `app/styles.css`: styling
- `app/config.js`: local configuration
- `supabase/schema.sql`: database schema, RLS policies, RPC functions, and leaderboard views

## Quick start

1. Create a free Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. In Supabase, open `Authentication -> URL Configuration`:
   - set `Site URL` to your production app URL later, for example `https://your-app.vercel.app`
   - add `http://localhost:8080/**` to Redirect URLs for local testing
   - add your Vercel production URL pattern or exact URL to Redirect URLs
4. Edit `app/config.js`:
   - set `SUPABASE_URL`
   - set `SUPABASE_ANON_KEY`
   - set `DEMO_MODE: false`
5. Serve the folder locally:

```bash
cd /Users/mohitmb/Downloads/ipl-prediction-league
python3 -m http.server 8080
```

6. Open `http://localhost:8080`.

## Deploy for free

### Vercel

1. Push this folder to GitHub, or upload/import it directly into Vercel.
2. Use the project root `/Users/mohitmb/Downloads/ipl-prediction-league`.
3. Because this is a static app, no framework preset is required.
4. After deploy, share the Vercel URL with your friends.

## Deployment checklist

1. Supabase project created
2. `supabase/schema.sql` executed
3. Realtime publication enabled for:
   - `matches`
   - `predictions`
   - `league_members`
   - `match_results`
4. Supabase Auth Site URL and Redirect URLs configured
5. `app/config.js` updated with project URL and anon key
6. Vercel project deployed from this folder
7. Production Vercel URL copied back into Supabase Auth Site URL and Redirect URLs

## Mobile install

After the app is hosted:

1. Open the link on Android Chrome or iPhone Safari.
2. Use the in-app install button if it appears.
3. If Safari does not show the button, use Share -> Add to Home Screen.

## How league flow works

1. League admin signs in and creates a league.
2. Friends sign in with email magic links and join with the invite code.
3. Admin creates matches and sets:
   - `playing_xi_announced_at`
   - `picks_deadline_at`
   - `score_deadline_at`
4. Players submit:
   - batsman
   - bowler
   - winning team
   - exact first innings total
5. Admin enters result data after the match.
6. Leaderboard updates automatically.

## Important fairness rules in this build

- All lock checks use server-side timestamps in Postgres.
- Duplicate batsman, bowler, and score predictions are blocked by database constraints.
- If a player submits core picks before `playing_xi_announced_at`, those core picks cannot be changed later.
- Exact score can still be added later if it was left blank, as long as the score window is still open.
- Match result scoring is manual in this MVP. That avoids unreliable free cricket APIs deciding lock times incorrectly.

## Recommended admin policy

For your exact WhatsApp rule about TV vs Hotstar delay, the cleanest MVP approach is:

- let the admin set official timestamps manually
- mention in match notes what timing source was used
- use the app timestamps as the final source of truth

That avoids disputes if streaming is delayed.

## Possible next improvements

- import match schedule automatically from a cricket API
- capture playing XI from API instead of manual entry
- add Google sign-in
- add player pools so users choose from dropdowns instead of typing names
- add abandoned match / DLS handling options
- convert to PWA so friends can add it to the home screen
