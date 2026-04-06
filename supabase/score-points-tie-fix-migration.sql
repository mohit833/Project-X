create or replace view public.prediction_points
with (security_invoker = true)
as
with scored_predictions as (
  select
    p.id as prediction_id,
    p.league_id,
    p.match_id,
    p.member_id,
    p.user_id,
    public.score_map_lookup(mr.batsman_runs, p.batsman_name) as batsman_points,
    public.score_map_lookup(mr.bowler_wickets, p.bowler_name) * 20 as bowler_points,
    case
      when mr.winner_team is not null and lower(mr.winner_team) = lower(coalesce(p.team_pick, '')) then 50
      else 0
    end as team_points,
    mr.first_innings_total,
    p.predicted_score,
    case
      when mr.first_innings_total is not null and p.predicted_score is not null
        then abs(mr.first_innings_total - p.predicted_score)
      else null
    end as score_delta
  from public.predictions p
  left join public.match_results mr
    on mr.match_id = p.match_id
),
best_scores as (
  select
    scored_predictions.*,
    min(score_delta) filter (where score_delta is not null) over (partition by match_id) as best_score_delta
  from scored_predictions
),
resolved_score_ties as (
  select
    best_scores.*,
    count(*) filter (
      where score_delta is not null
        and best_score_delta is not null
        and score_delta = best_score_delta
    ) over (partition by match_id) as best_score_tie_count
  from best_scores
),
resolved_scores as (
  select
    prediction_id,
    league_id,
    match_id,
    member_id,
    user_id,
    batsman_points,
    bowler_points,
    case
      when first_innings_total is null or predicted_score is null then 0
      when best_score_delta is null or best_score_tie_count <= 0 then 0
      when score_delta = best_score_delta then 10 / best_score_tie_count
      else 0
    end as score_points,
    team_points
  from resolved_score_ties
)
select
  prediction_id,
  league_id,
  match_id,
  member_id,
  user_id,
  batsman_points,
  bowler_points,
  score_points,
  team_points,
  batsman_points + bowler_points + score_points + team_points as total_points
from resolved_scores;

notify pgrst, 'reload schema';
