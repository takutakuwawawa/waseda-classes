alter table public.posts
  add column if not exists dislike_count integer not null default 0;

update public.posts
set
  like_count = greatest(0, coalesce(like_count, 0)),
  dislike_count = greatest(0, coalesce(dislike_count, 0));

create or replace function public.vote_post(
  p_post_id uuid,
  p_like_delta integer,
  p_dislike_delta integer
)
returns table (
  id uuid,
  like_count integer,
  dislike_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    (p_like_delta = 1 and p_dislike_delta = 0) or
    (p_like_delta = -1 and p_dislike_delta = 0) or
    (p_like_delta = 0 and p_dislike_delta = 1) or
    (p_like_delta = 0 and p_dislike_delta = -1) or
    (p_like_delta = 1 and p_dislike_delta = -1) or
    (p_like_delta = -1 and p_dislike_delta = 1)
  ) then
    raise exception 'invalid vote delta';
  end if;

  return query
  update public.posts as p
  set
    like_count = greatest(0, coalesce(p.like_count, 0) + p_like_delta),
    dislike_count = greatest(0, coalesce(p.dislike_count, 0) + p_dislike_delta)
  where
    p.id = p_post_id and
    p.status = 'approved' and
    p.hidden = false
  returning p.id, p.like_count, p.dislike_count;
end;
$$;

grant execute on function public.vote_post(uuid, integer, integer) to anon, authenticated;
