// The functions really running under `supabase functions serve`, with no AI key set.
import { describe, expect, it } from "vitest";
import { callFunction, service, signIn, VALID_REQUEST } from "./helpers";
import { describeRequestChecks } from "./functionChecks";

describeRequestChecks();

describe("with no AI key", () => {
  it("answers a valid request with a clear 503 and a fallback, and spends no quota", async () => {
    const user = await signIn("nokey");
    const response = await callFunction("generate-workout", { token: user.token, body: VALID_REQUEST });
    expect(response.status).toBe(503);
    expect(response.json?.fallback).toBe(true);
    expect(response.json?.error).toMatch(/AI_API_KEY/);

    const { count } = await service.from("ai_generation_usage").select("*", { count: "exact", head: true }).eq("user_id", user.id);
    expect(count).toBe(0);
  });
});
