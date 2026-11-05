// Real JWTs through the real PostgREST, GoTrue and Storage, after a real `db push`.
import { beforeAll, describe, expect, it } from "vitest";
import { anon, isDenied, service, signIn, TestUser } from "./helpers";

const PUBLIC_CLUB = "ea000000-0000-0000-0000-000000000001";
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64",
);
const FIVE_MB = 5242880;

let alpha: TestUser;
let beta: TestUser;
let gamma: TestUser;
const stamp = `w-${Date.now()}`;

beforeAll(async () => {
  [alpha, beta, gamma] = await Promise.all([signIn("alpha"), signIn("beta"), signIn("gamma")]);
  await service.from("profiles").update({ name: "Alpha Fighter", weight_kg: 80, equipment: { gloves: true } }).eq("user_id", alpha.id);
  await service.from("profiles").update({ name: "Beta Boxer", handle: "betaboxer" }).eq("user_id", beta.id);
});

describe("signup", () => {
  it("creates a profile row for every new account", async () => {
    const { data } = await service.from("profiles").select("user_id").in("user_id", [alpha.id, beta.id, gamma.id]);
    expect(data).toHaveLength(3);
  });

  it("issues a JWT that names the user", () => {
    const claims = JSON.parse(Buffer.from(alpha.token.split(".")[1], "base64url").toString());
    expect(claims.sub).toBe(alpha.id);
    expect(claims.role).toBe("authenticated");
  });
});

describe("profiles", () => {
  it("lets you read only your own full row", async () => {
    const { data } = await alpha.client.from("profiles").select("user_id,weight_kg");
    expect(data).toEqual([{ user_id: alpha.id, weight_kg: 80 }]);
  });

  it("resolves other fighters through safe columns only", async () => {
    const { data, error } = await alpha.client.rpc("get_public_profiles", { target_user_ids: [alpha.id, beta.id] });
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(Object.keys(data[0]).sort()).toEqual(["avatar_url", "handle", "id", "name", "user_id"]);
  });

  it("searches other fighters, leaves you out, and treats % as a literal", async () => {
    const found = await alpha.client.rpc("search_public_profiles", { search_query: "box" });
    expect(found.data?.map((row: { name: string }) => row.name)).toEqual(["Beta Boxer"]);
    expect((await alpha.client.rpc("search_public_profiles", { search_query: "alpha" })).data).toEqual([]);
    expect((await alpha.client.rpc("search_public_profiles", { search_query: "%%" })).data).toEqual([]);
  });

  it("keeps anonymous callers away from every profile path", async () => {
    expect(isDenied((await anon.rpc("get_public_profiles", { target_user_ids: [alpha.id] })).error)).toBe(true);
    expect(isDenied((await anon.rpc("search_public_profiles", { search_query: "box" })).error)).toBe(true);
    expect(isDenied((await anon.from("profiles_public").select("*")).error)).toBe(true);
  });
});

describe("function grants", () => {
  const calls = (): [string, Record<string, unknown>][] => [
    ["get_public_profile", { target_user_id: alpha.id }],
    ["get_total_training_seconds", { target_user_id: alpha.id }],
    ["get_tier_user_counts", {}],
    ["has_role", { _user_id: alpha.id, _role: "admin" }],
    ["get_workout_rating_summary", { target_workout_id: "w1" }],
    ["get_follow_counts", { target_user_id: alpha.id }],
    ["get_club_member_counts", {}],
    ["get_club_ranks", { target_club_id: "ea000000-0000-0000-0000-000000000001" }],
  ];

  it("refuses anonymous callers and allows accounts", async () => {
    for (const [name, args] of calls()) {
      expect(isDenied((await anon.rpc(name, args)).error), `anon ${name}`).toBe(true);
      expect((await alpha.client.rpc(name, args)).error, `account ${name}`).toBeNull();
    }
  });

  it("still lets anonymous visitors read clubs after has_role was revoked", async () => {
    const { data, error } = await anon.from("clubs").select("id,name");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps the AI quota out of reach of every client", async () => {
    expect(isDenied((await anon.from("ai_generation_usage").select("*")).error)).toBe(true);
    expect(isDenied((await alpha.client.from("ai_generation_usage").select("*")).error)).toBe(true);
    const spend = await alpha.client.rpc("consume_ai_generation_quota", { _user_id: alpha.id, _daily_limit: 99 });
    expect(isDenied(spend.error)).toBe(true);
  });
});

describe("ratings", () => {
  const rate = (user: TestUser, rating: number) =>
    user.client.from("workout_ratings").upsert({ user_id: user.id, workout_id: stamp, rating }, { onConflict: "user_id,workout_id" });

  beforeAll(async () => {
    await rate(alpha, 5);
    await rate(beta, 2);
  });

  it("lets you change your rating", async () => {
    expect((await rate(alpha, 4)).error).toBeNull();
  });

  it("shows only your own row, and nothing to anonymous callers", async () => {
    expect((await alpha.client.from("workout_ratings").select("user_id").eq("workout_id", stamp)).data).toHaveLength(1);
    expect((await anon.from("workout_ratings").select("*").eq("workout_id", stamp)).data ?? []).toHaveLength(0);
  });

  it("summarises as an average and a count, with no user ids", async () => {
    const { data } = await alpha.client.rpc("get_workout_rating_summary", { target_workout_id: stamp });
    expect(Number(data[0].average_rating)).toBe(3);
    expect(Number(data[0].rating_count)).toBe(2);
    expect(Object.keys(data[0])).toHaveLength(2);
  });
});

describe("clubs and community posts", () => {
  let privateClub: { id: string };
  let tinyClub: { id: string };

  const postAs = (user: TestUser, row: Record<string, unknown>) =>
    user.client.from("community_posts").insert({ user_id: user.id, type: "preset_shared", ...row }).select().single();

  beforeAll(async () => {
    privateClub = (await service.from("clubs").insert({ name: `Private ${stamp}`, type: "private" }).select().single()).data;
    tinyClub = (await service.from("clubs").insert({ name: `Tiny ${stamp}`, type: "public", member_cap: 1 }).select().single()).data;
    await service.from("club_members").insert({ club_id: privateClub.id, user_id: alpha.id });
  });

  it("reads members without a policy recursion error", async () => {
    expect((await beta.client.from("club_members").select("*")).error).toBeNull();
  });

  it("hides private club members from outsiders and anonymous callers", async () => {
    expect((await beta.client.from("club_members").select("*").eq("club_id", privateClub.id)).data).toEqual([]);
    expect((await alpha.client.from("club_members").select("*").eq("club_id", privateClub.id)).data).toHaveLength(1);
    expect((await anon.from("club_members").select("*")).data ?? []).toEqual([]);
  });

  it("refuses joining as an admin, joining a private club, and adding someone else", async () => {
    expect(isDenied((await gamma.client.from("club_members").insert({ club_id: PUBLIC_CLUB, user_id: gamma.id, role: "admin" })).error)).toBe(true);
    expect(isDenied((await gamma.client.from("club_members").insert({ club_id: privateClub.id, user_id: gamma.id })).error)).toBe(true);
    expect(isDenied((await gamma.client.from("club_members").insert({ club_id: PUBLIC_CLUB, user_id: alpha.id })).error)).toBe(true);
  });

  it("lets you join a public club as a member, as the app does", async () => {
    const { data, error } = await gamma.client.from("club_members").insert({ club_id: PUBLIC_CLUB, user_id: gamma.id }).select().single();
    expect(error).toBeNull();
    expect(data.role).toBe("member");
    const { count } = await alpha.client.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", PUBLIC_CLUB);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("enforces the member cap with a readable message", async () => {
    expect((await beta.client.from("club_members").insert({ club_id: tinyClub.id, user_id: beta.id })).error).toBeNull();
    const over = await gamma.client.from("club_members").insert({ club_id: tinyClub.id, user_id: gamma.id });
    expect(over.error?.message).toMatch(/member limit/);
  });

  it("does not let two simultaneous joins overfill the cap", async () => {
    await beta.client.from("club_members").delete().eq("club_id", tinyClub.id).eq("user_id", beta.id);
    const joins = await Promise.all(
      [alpha, gamma].map((user) => user.client.from("club_members").insert({ club_id: tinyClub.id, user_id: user.id })),
    );
    const { count } = await service.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", tinyClub.id);
    expect(count).toBe(1);
    expect(joins.filter((join) => join.error)).toHaveLength(1);
  });

  it("controls who posts where, and who reads it", async () => {
    expect((await postAs(alpha, { destination: "feed", message: `feed ${stamp}` })).error).toBeNull();
    expect((await postAs(alpha, { destination: "club", club_id: privateClub.id, message: `club ${stamp}` })).error).toBeNull();
    expect(isDenied((await postAs(beta, { destination: "club", club_id: privateClub.id })).error)).toBe(true);

    const impersonated = await beta.client.from("community_posts").insert({ user_id: alpha.id, type: "preset_shared", destination: "feed" });
    expect(isDenied(impersonated.error)).toBe(true);

    const betaPost = await postAs(beta, { destination: "feed", message: `beta ${stamp}` });
    const moved = await beta.client.from("community_posts").update({ destination: "club", club_id: privateClub.id }).eq("id", betaPost.data.id);
    expect(isDenied(moved.error)).toBe(true);

    const seenByBeta = (await beta.client.from("community_posts").select("message").like("message", `%${stamp}`)).data;
    expect(seenByBeta?.map((row) => row.message).sort()).toEqual([`beta ${stamp}`, `feed ${stamp}`]);
    expect((await alpha.client.from("community_posts").select("message").like("message", `%${stamp}`)).data).toHaveLength(3);
    expect((await anon.from("community_posts").select("*")).data ?? []).toEqual([]);
  });
});

describe("avatars, through the real storage API", () => {
  const upload = (user: TestUser, path: string, body: Buffer, contentType: string) =>
    user.client.storage.from("avatars").upload(path, body, { contentType, upsert: true });

  beforeAll(async () => {
    await upload(alpha, `${alpha.id}/avatar.png`, ONE_PIXEL_PNG, "image/png");
  });

  it("uploads and re-uploads to your own folder", async () => {
    expect((await upload(alpha, `${alpha.id}/avatar.png`, ONE_PIXEL_PNG, "image/png")).error).toBeNull();
  });

  it("refuses overwriting someone else, GIFs, and anything over 5 MB", async () => {
    expect((await upload(beta, `${alpha.id}/avatar.png`, ONE_PIXEL_PNG, "image/png")).error).not.toBeNull();
    expect((await upload(alpha, `${alpha.id}/x.gif`, ONE_PIXEL_PNG, "image/gif")).error).not.toBeNull();
    expect((await upload(alpha, `${alpha.id}/big.png`, Buffer.alloc(FIVE_MB + 1024), "image/png")).error).not.toBeNull();
  });

  it("serves the avatar publicly with no auth", async () => {
    const { data } = alpha.client.storage.from("avatars").getPublicUrl(`${alpha.id}/avatar.png`);
    expect((await fetch(data.publicUrl)).status).toBe(200);
  });

  it("lets only you list your folder", async () => {
    expect((await alpha.client.storage.from("avatars").list(alpha.id)).data?.length).toBeGreaterThanOrEqual(1);
    expect((await beta.client.storage.from("avatars").list(alpha.id)).data ?? []).toEqual([]);
    expect((await anon.storage.from("avatars").list(alpha.id)).data ?? []).toEqual([]);
  });
});

describe("social read functions", () => {
  it("gives anyone signed in the real follow totals, and still not the rows behind them", async () => {
    const [fan, target, bystander] = await Promise.all([signIn("fan"), signIn("target"), signIn("bystander")]);
    expect((await fan.client.from("follows").insert({ follower_id: fan.id, following_id: target.id })).error).toBeNull();

    const counts = async (id: string) => (await bystander.client.rpc("get_follow_counts", { target_user_id: id })).data?.[0];
    expect(await counts(target.id)).toEqual({ followers: 1, following: 0 });
    expect(await counts(fan.id)).toEqual({ followers: 0, following: 1 });
    expect((await bystander.client.from("follows").select("*").eq("following_id", target.id)).data).toEqual([]);
  });

  it("counts members of public clubs for everyone, and private ones only for their members", async () => {
    const stamp = Date.now();
    const open = (await service.from("clubs").insert({ name: `Open ${stamp}`, type: "public" }).select().single()).data!;
    const secret = (await service.from("clubs").insert({ name: `Secret ${stamp}`, type: "private" }).select().single()).data!;
    await service.from("club_members").insert([{ club_id: open.id, user_id: alpha.id }, { club_id: secret.id, user_id: alpha.id }]);

    const seenBy = async (user: TestUser) => {
      const { data } = await user.client.rpc("get_club_member_counts");
      return Object.fromEntries((data ?? []).map((row: { club_id: string; member_count: number }) => [row.club_id, row.member_count]));
    };
    expect((await seenBy(beta))[open.id]).toBe(1);
    expect((await seenBy(beta))[secret.id]).toBeUndefined();
    expect((await seenBy(alpha))[secret.id]).toBe(1);
  });

  it("shows a club's ranks to its members only, best first, with nothing private in them", async () => {
    const stamp = Date.now();
    const club = (await service.from("clubs").insert({ name: `Ranked ${stamp}`, type: "public" }).select().single()).data!;
    const [low, high, outsider] = await Promise.all([signIn("low"), signIn("high"), signIn("outsider")]);
    await service.from("profiles").update({ total_xp: 900 }).eq("user_id", high.id);
    await service.from("club_members").insert([{ club_id: club.id, user_id: low.id }, { club_id: club.id, user_id: high.id }]);

    const { data, error } = await low.client.rpc("get_club_ranks", { target_club_id: club.id });
    expect(error).toBeNull();
    expect(data?.map((row: { user_id: string }) => row.user_id)).toEqual([high.id, low.id]);
    expect(Object.keys(data?.[0] ?? {}).sort()).toEqual(["avatar_url", "name", "total_xp", "user_id"]);
    expect((await outsider.client.rpc("get_club_ranks", { target_club_id: club.id })).data).toEqual([]);
  });
});

describe("atomic writes", () => {
  const workoutsFor = async (user: TestUser, names: string[]) => {
    const { data, error } = await service.from("workouts")
      .insert(names.map((name, sort_order) => ({ user_id: user.id, name: `${stamp}-${name}`, sort_order })))
      .select("id");
    expect(error).toBeNull();
    return data!.map((row: { id: string }) => row.id);
  };
  const orderOf = async (ids: string[]) => {
    const { data } = await service.from("workouts").select("id,sort_order").in("id", ids);
    return Object.fromEntries((data ?? []).map((row: { id: string; sort_order: number }) => [row.id, row.sort_order]));
  };
  const historyFor = async (user: TestUser) => {
    const { data, error } = await user.client.from("workout_history").insert({ user_id: user.id, workout_name: `${stamp}-credit` }).select("id").single();
    expect(error).toBeNull();
    return data!.id as string;
  };
  const totalsOf = async (user: TestUser) => {
    const { data } = await service.from("profiles").select("total_xp,total_pushups,current_streak,longest_streak").eq("user_id", user.id).single();
    return data!;
  };

  it("saves a whole new order at once", async () => {
    const [a, b, c] = await workoutsFor(alpha, ["a", "b", "c"]);
    expect((await alpha.client.rpc("reorder_workouts", { ordered_ids: [c, a, b] })).error).toBeNull();
    expect(await orderOf([a, b, c])).toEqual({ [c]: 0, [a]: 1, [b]: 2 });
  });

  it("changes nothing when the new order includes someone else's workout", async () => {
    const [a, b] = await workoutsFor(alpha, ["x", "y"]);
    const [theirs] = await workoutsFor(beta, ["z"]);
    const { error } = await alpha.client.rpc("reorder_workouts", { ordered_ids: [b, theirs, a] });
    expect(error).not.toBeNull();
    expect(await orderOf([a, b])).toEqual({ [a]: 0, [b]: 1 });
    expect(await orderOf([theirs])).toEqual({ [theirs]: 0 });
  });

  it("counts a logged session once, however many times the save is retried", async () => {
    const before = await totalsOf(gamma);
    const history = await historyFor(gamma);
    const credit = { history_id: history, totals: { total_xp: 120, total_pushups: 15 }, fields: { current_streak: 2, longest_streak: 2 } };
    expect((await gamma.client.rpc("credit_session_to_profile", credit)).data).toBe(true);
    expect((await gamma.client.rpc("credit_session_to_profile", credit)).data).toBe(false);
    expect(await totalsOf(gamma)).toEqual({
      total_xp: before.total_xp + 120, total_pushups: before.total_pushups + 15, current_streak: 2, longest_streak: Math.max(2, before.longest_streak),
    });
  });

  it("keeps both of two sessions logged at the same time", async () => {
    const before = await totalsOf(gamma);
    const [first, second] = await Promise.all([historyFor(gamma), historyFor(gamma)]);
    const results = await Promise.all([first, second].map((history_id) =>
      gamma.client.rpc("credit_session_to_profile", { history_id, totals: { total_xp: 50 }, fields: {} })));
    expect(results.map((result) => result.error)).toEqual([null, null]);
    expect((await totalsOf(gamma)).total_xp).toBe(before.total_xp + 100);
  });

  it("refuses unknown counters, negative amounts, and someone else's session", async () => {
    const history = await historyFor(gamma);
    for (const totals of [{ prestige: 1 }, { total_xp: -10 }, { total_xp: 1.5 }]) {
      expect((await gamma.client.rpc("credit_session_to_profile", { history_id: history, totals, fields: {} })).error).not.toBeNull();
    }
    expect((await gamma.client.rpc("credit_session_to_profile", { history_id: history, totals: {}, fields: { is_admin: true } })).error).not.toBeNull();
    expect((await beta.client.rpc("credit_session_to_profile", { history_id: history, totals: { total_xp: 999 }, fields: {} })).error).not.toBeNull();
    // Nothing above claimed it, so the owner can still log it
    expect((await gamma.client.rpc("credit_session_to_profile", { history_id: history, totals: {}, fields: {} })).data).toBe(true);
  });

  it("adds XP on the server, and only for the caller", async () => {
    const before = await totalsOf(beta);
    const added = await Promise.all([beta.client.rpc("add_profile_xp", { amount: 30 }), beta.client.rpc("add_profile_xp", { amount: 12 })]);
    expect(added.map((result) => result.error)).toEqual([null, null]);
    expect((await totalsOf(beta)).total_xp).toBe(before.total_xp + 42);
    expect((await beta.client.rpc("add_profile_xp", { amount: -5 })).error).not.toBeNull();
  });

  it("keeps anonymous callers out of every new write", async () => {
    expect(isDenied((await anon.rpc("reorder_workouts", { ordered_ids: [] })).error)).toBe(true);
    expect(isDenied((await anon.rpc("add_profile_xp", { amount: 1 })).error)).toBe(true);
    expect(isDenied((await anon.rpc("credit_session_to_profile", { history_id: crypto.randomUUID(), totals: {}, fields: {} })).error)).toBe(true);
  });
});
