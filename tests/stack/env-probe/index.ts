// Only ever deployed to the throwaway test stack, to show which key names the runtime provides.
import { resolvePublicKey, resolveServiceKey } from "../_shared/keys.ts";

const kind = (key: string | undefined) => {
  if (!key) return "missing";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  return "legacy-jwt";
};

Deno.serve(() => {
  const getEnv = (name: string) => Deno.env.get(name);
  return new Response(
    JSON.stringify({
      publicKey: kind(resolvePublicKey(getEnv)),
      serviceKey: kind(resolveServiceKey(getEnv)),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
