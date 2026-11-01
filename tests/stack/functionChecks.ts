import { beforeAll, describe, expect, it } from "vitest";
import { ANON_KEY, callFunction, PUBLISHABLE_KEY, service, signIn, TestUser, VALID_REQUEST } from "./helpers";

// These hold whether or not an AI key is set, so both function test files run them
export function describeRequestChecks(): void {
  let user: TestUser;

  beforeAll(async () => {
    user = await signIn("checks");
  });

  describe("who can call generate-workout", () => {
    it("refuses a missing token, the anon key, the publishable key and garbage", async () => {
      expect((await callFunction("generate-workout", { body: VALID_REQUEST })).status).toBe(401);
      for (const token of [ANON_KEY, PUBLISHABLE_KEY, "garbage"]) {
        expect((await callFunction("generate-workout", { token, body: VALID_REQUEST })).status, token.slice(0, 12)).toBe(401);
      }
    });
  });

  describe("what generate-workout accepts", () => {
    const refused: [string, { body?: unknown; raw?: string }, number][] = [
      ["a numeric prompt", { body: { ...VALID_REQUEST, prompt: 42 } }, 400],
      ["no prompt", { body: { userTier: "x" } }, 400],
      ["a blank prompt", { body: { ...VALID_REQUEST, prompt: "   " } }, 400],
      ["a prompt over 2,000 characters", { body: { ...VALID_REQUEST, prompt: "x".repeat(2001) } }, 400],
      ["21 equipment keys", { body: { ...VALID_REQUEST, equipment: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, true])) } }, 400],
      ["equipment as an array", { body: { ...VALID_REQUEST, equipment: ["gloves"] } }, 400],
      ["an oversized tier", { body: { ...VALID_REQUEST, userTier: "x".repeat(41) } }, 400],
      ["invalid JSON", { raw: "{not json" }, 400],
      ["a body over 16 KB", { raw: JSON.stringify({ ...VALID_REQUEST, padding: "x".repeat(17000) }) }, 413],
    ];

    it.each(refused)("refuses %s and tells the app to fall back", async (_label, request, status) => {
      const response = await callFunction("generate-workout", { token: user.token, ...request });
      expect(response.status).toBe(status);
      expect(response.json?.fallback).toBe(true);
    });

    it("spends no quota on a refused request", async () => {
      const { count } = await service.from("ai_generation_usage").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      expect(count).toBe(0);
    });
  });
}
