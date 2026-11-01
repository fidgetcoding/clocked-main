// The functions really running under `supabase functions serve`, calling a fake AI provider over
// HTTP. No real model is involved: this proves the plumbing and failure handling, not AI quality.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ANON_KEY, callFunction, fakeAiRequests, PUBLISHABLE_KEY, resetFakeAi, service, signIn, TestUser, VALID_REQUEST } from "./helpers";
import { describeRequestChecks } from "./functionChecks";

const DAILY_LIMIT = 25;
const today = () => new Date().toISOString().slice(0, 10);

const usageOf = async (id: string): Promise<number> =>
  (await service.from("ai_generation_usage").select("request_count").eq("user_id", id).maybeSingle()).data?.request_count ?? 0;
const setUsage = (id: string, count: number) =>
  service.from("ai_generation_usage").update({ request_count: count }).eq("user_id", id).eq("usage_date", today());

describeRequestChecks();

describe("the runtime", () => {
  it("hands the functions the keys they resolve, and they are real keys", async () => {
    const user = await signIn("probe");
    const response = await callFunction("env-probe", { token: user.token });
    expect(response.status).toBe(200);
    expect(response.json?.publicKey).not.toBe("missing");
    expect(response.json?.serviceKey).not.toBe("missing");
    console.log("Key branch the local runtime used:", JSON.stringify(response.json));
  });
});

describe("generate-workout against the provider", () => {
  let user: TestUser;

  const generate = (prompt: string) => callFunction("generate-workout", { token: user.token, body: { ...VALID_REQUEST, prompt } });

  beforeAll(async () => {
    user = await signIn("provider");
  });

  beforeEach(resetFakeAi);

  it("returns the provider's workout for a real signed-in user", async () => {
    const response = await generate("3 round heavy bag");
    expect(response.status).toBe(200);
    expect(response.json?.name).toBe("Fake AI Heavy Bag");
  });

  it("accepts the publishable key as the apikey, as the browser client sends it", async () => {
    const response = await callFunction("generate-workout", { token: user.token, apikey: PUBLISHABLE_KEY, body: VALID_REQUEST });
    expect(response.status).toBe(200);
  });

  it("sends the configured model, key and token budget to the configured URL", async () => {
    await generate("3 round heavy bag");
    const [request] = await fakeAiRequests();
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/v1/chat/completions");
    expect(request.authorization).toBe("Bearer fake-key-not-real");
    expect(request.model).toBe("fake-model");
    expect(request.maxTokens).toBe(8192);
    expect(request.userMessage).toContain("3 round heavy bag");
    expect(request.userMessage).toContain("Equipment: gloves");
  });

  it("strips markdown fences from the provider's answer", async () => {
    const response = await generate("[fake:fenced]");
    expect(response.status).toBe(200);
    expect(response.json?.name).toBe("Fake AI Heavy Bag");
  });

  const failures: [string, string, number][] = [
    ["a provider 500", "[fake:http500]", 502],
    ["a dropped connection", "[fake:drop]", 502],
    ["a provider that hangs", "[fake:hang]", 504],
    ["an empty answer", "[fake:empty]", 422],
    ["prose instead of JSON", "[fake:notjson]", 422],
    ["JSON that is not an object", "[fake:null]", 422],
    ["a workout with no phases", "[fake:invalid]", 422],
    ["a provider body that is not JSON", "[fake:badbody]", 502],
  ];

  it.each(failures)("turns %s into a fallback the app can use", async (_label, prompt, status) => {
    const response = await generate(prompt);
    expect(response.status).toBe(status);
    expect(response.json?.fallback).toBe(true);
  });
});

describe("the daily quota", () => {
  it("allows the 25th request, refuses the 26th without counting it, and leaves others alone", async () => {
    const [capped, other] = await Promise.all([signIn("capped"), signIn("other")]);
    const generate = (user: TestUser) => callFunction("generate-workout", { token: user.token, body: VALID_REQUEST });

    expect((await generate(capped)).status).toBe(200);
    expect(await usageOf(capped.id)).toBe(1);

    await setUsage(capped.id, DAILY_LIMIT - 1);
    expect((await generate(capped)).status).toBe(200);

    const refused = await generate(capped);
    expect(refused.status).toBe(429);
    expect(refused.json?.fallback).toBe(true);
    expect(await usageOf(capped.id)).toBe(DAILY_LIMIT);

    expect((await generate(other)).status).toBe(200);
  });

  it("lets exactly the remaining requests through a burst of simultaneous ones", async () => {
    const user = await signIn("burst");
    await callFunction("generate-workout", { token: user.token, body: VALID_REQUEST });
    await setUsage(user.id, DAILY_LIMIT - 3);

    const burst = await Promise.all(
      Array.from({ length: 8 }, () => callFunction("generate-workout", { token: user.token, body: VALID_REQUEST })),
    );
    expect(burst.filter((response) => response.status === 200)).toHaveLength(3);
    expect(burst.filter((response) => response.status === 429)).toHaveLength(5);
  });
});

describe("browser preflight", () => {
  const preflight = (name: string) => callFunction(name, { method: "OPTIONS", raw: "" });

  it("lets a browser call generate-workout", async () => {
    const response = await preflight("generate-workout");
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("lets a browser call admin-users, including DELETE", async () => {
    const response = await preflight("admin-users");
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-methods")).toContain("DELETE");
  });
});

describe("admin-users", () => {
  let admin: TestUser;
  let member: TestUser;

  beforeAll(async () => {
    [admin, member] = await Promise.all([signIn("admin"), signIn("member")]);
    await service.from("user_roles").insert({ user_id: admin.id, role: "admin" });
  });

  it("refuses a missing token, the anon key and a regular member", async () => {
    expect((await callFunction("admin-users", { method: "GET" })).status).toBe(401);
    expect([401, 403]).toContain((await callFunction("admin-users", { method: "GET", token: ANON_KEY })).status);
    const asMember = await callFunction("admin-users", { method: "GET", token: member.token });
    expect(asMember.status).toBe(403);
    const deleteAsMember = await callFunction("admin-users", { method: "DELETE", token: member.token, query: `?userId=${admin.id}` });
    expect(deleteAsMember.status).toBe(403);
  });

  it("lists real users for a real admin", async () => {
    const response = await callFunction("admin-users", { method: "GET", token: admin.token });
    expect(response.status).toBe(200);
    const users = response.json?.users as { id: string; role: string }[];
    expect(users.find((listed) => listed.id === admin.id)?.role).toBe("admin");
    expect(users.find((listed) => listed.id === member.id)?.role).toBe("user");
  });

  it("creates a user whose profile the signup trigger fills in", async () => {
    const email = `created-${Date.now()}@example.com`;
    const response = await callFunction("admin-users", { token: admin.token, body: { email, password: "throwaway-pass-1", name: "<b>New</b> Fighter" } });
    expect(response.status).toBe(200);
    const created = response.json?.user as { id: string };
    const { data } = await service.from("profiles").select("user_id").eq("user_id", created.id);
    expect(data).toHaveLength(1);
  });

  it("answers bad requests with a 400, not a crash", async () => {
    expect((await callFunction("admin-users", { token: admin.token, body: { email: "only@example.com" } })).status).toBe(400);
    expect((await callFunction("admin-users", { token: admin.token, raw: "{not json" })).status).toBe(400);
    expect((await callFunction("admin-users", { token: admin.token, body: { email: "not-an-email", password: "throwaway-pass-1" } })).status).toBe(400);
    expect((await callFunction("admin-users", { method: "DELETE", token: admin.token })).status).toBe(400);
    expect((await callFunction("admin-users", { method: "DELETE", token: admin.token, query: "?userId=not-a-uuid" })).status).toBe(400);
  });

  it("refuses deleting yourself and unknown methods", async () => {
    const self = await callFunction("admin-users", { method: "DELETE", token: admin.token, query: `?userId=${admin.id}` });
    expect(self.status).toBe(400);
    expect((await callFunction("admin-users", { method: "PUT", token: admin.token, body: {} })).status).toBe(405);
  });

  it("deletes a user and everything hanging off their account", async () => {
    const doomed = await signIn("doomed");
    const response = await callFunction("admin-users", { method: "DELETE", token: admin.token, query: `?userId=${doomed.id}` });
    expect(response.status).toBe(200);
    expect((await service.from("profiles").select("user_id").eq("user_id", doomed.id)).data).toEqual([]);
    expect((await doomed.client.auth.signInWithPassword({ email: doomed.email, password: "wrong" })).error).not.toBeNull();
  });
});
