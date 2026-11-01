import { createClient, SupabaseClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing. Run these through npm run test:stack.`);
  return value;
}

export const API_URL = required("STACK_API_URL");
export const ANON_KEY = required("STACK_ANON_KEY");
export const PUBLISHABLE_KEY = required("STACK_PUBLISHABLE_KEY");
export const FAKE_AI_URL = process.env.STACK_FAKE_AI_URL ?? "";

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const service = createClient(API_URL, required("STACK_SERVICE_ROLE_KEY"), noSession);
export const anon = createClient(API_URL, ANON_KEY, noSession);

export interface TestUser {
  id: string;
  email: string;
  token: string;
  client: SupabaseClient;
}

let counter = 0;

/** A real account with a real JWT from the real auth server. */
export async function signIn(tag: string): Promise<TestUser> {
  const email = `${tag}-${Date.now()}-${counter++}@example.com`;
  const password = `throwaway-${Math.random().toString(36).slice(2)}`;
  const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) throw error ?? new Error("No user created");

  const client = createClient(API_URL, ANON_KEY, noSession);
  const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !data.session) throw signInError ?? new Error("No session");

  return { id: created.user.id, email, token: data.session.access_token, client };
}

export const isDenied = (error: { message: string } | null): boolean =>
  !!error && /permission denied|row-level security/i.test(error.message);

export interface FunctionResponse {
  status: number;
  json: Record<string, unknown> | null;
  text: string;
  headers: Headers;
}

export async function callFunction(
  name: string,
  options: { token?: string; body?: unknown; raw?: string; method?: string; query?: string; apikey?: string } = {},
): Promise<FunctionResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: options.apikey ?? ANON_KEY };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const method = options.method ?? "POST";
  const res = await fetch(`${API_URL}/functions/v1/${name}${options.query ?? ""}`, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : (options.raw ?? JSON.stringify(options.body ?? {})),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Not every response is JSON, and the tests that care assert on the text
  }
  return { status: res.status, json, text, headers: res.headers };
}

export const VALID_REQUEST = {
  prompt: "3 round heavy bag",
  userTier: "beginner",
  experienceLevel: "beginner",
  equipment: { gloves: true, wraps: false },
};

export interface FakeAiRequest {
  method: string;
  path: string;
  authorization: string;
  model: string;
  maxTokens: number;
  userMessage: string;
}

export const fakeAiRequests = async (): Promise<FakeAiRequest[]> => (await fetch(`${FAKE_AI_URL}/requests`)).json();
export const resetFakeAi = async (): Promise<void> => {
  await fetch(`${FAKE_AI_URL}/reset`);
};
