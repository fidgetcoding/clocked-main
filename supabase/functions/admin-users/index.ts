import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { resolvePublicKey, resolveServiceKey } from "../_shared/keys.ts";
import { PAGE_SIZE, readAllPages } from "../_shared/pages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is an admin
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      resolvePublicKey((name) => Deno.env.get(name))!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check admin role using the has_role function
    const { data: isAdmin } = await supabaseAnon.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      resolveServiceKey((name) => Deno.env.get(name))!
    );

    const url = new URL(req.url);

    if (req.method === "GET") {
      // Every user, profile and admin role, a page at a time. Any failed read is an error, not a shorter list:
      // a missing role row would show an admin as a regular user.
      type ProfileRow = {
        user_id: string; name: string | null; handle: string | null; role: string | null; experience_level: string | null;
        prestige: string | null; current_level: number | null; equipment: unknown; goals: unknown; total_xp: number | null;
        workouts_completed: number | null; current_streak: number | null; created_at: string;
      };
      let authUsers: { users: User[] };
      let profiles: ProfileRow[];
      let adminRoles: { user_id: string; role: string }[];
      try {
        const [users, profileRows, roleRows] = await Promise.all([
          readAllPages<User>(async (index) => {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: index + 1, perPage: PAGE_SIZE });
            return { rows: data?.users ?? null, error };
          }),
          readAllPages<ProfileRow>(async (_index, from, to) => {
            const { data, error } = await supabaseAdmin
              .from("profiles")
              .select("user_id, name, handle, role, experience_level, prestige, current_level, equipment, goals, total_xp, workouts_completed, current_streak, created_at")
              .order("user_id")
              .range(from, to);
            return { rows: data, error };
          }),
          readAllPages<{ user_id: string; role: string }>(async (_index, from, to) => {
            const { data, error } = await supabaseAdmin.from("user_roles").select("user_id, role").order("user_id").order("role").range(from, to);
            return { rows: data, error };
          }),
        ]);
        authUsers = { users };
        profiles = profileRows;
        adminRoles = roleRows;
      } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Couldn't load users" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      const adminSet = new Set(adminRoles?.filter((r) => r.role === "admin").map((r) => r.user_id) || []);

      const users = authUsers.users.map((u) => {
        const profile = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          name: profile?.name || "Unknown",
          handle: profile?.handle || null,
          role: adminSet.has(u.id) ? "admin" : "user",
          profile_role: profile?.role || "fighter",
          experience_level: profile?.experience_level || null,
          prestige: profile?.prestige || null,
          current_level: profile?.current_level || 1,
          equipment: profile?.equipment || {},
          goals: profile?.goals || [],
          total_xp: profile?.total_xp || 0,
          workouts_completed: profile?.workouts_completed || 0,
          current_streak: profile?.current_streak || 0,
        };
      });

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      // Create a new user
      let body: { email?: unknown; password?: unknown; name?: unknown };
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Request body must be valid JSON" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { email, password, name } = body;

      if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
        return new Response(JSON.stringify({ error: "Email and password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate name input
      const trimmedName = (typeof name === "string" ? name : "").trim().replace(/<[^>]*>/g, "");
      if (trimmedName.length > 100) {
        return new Response(JSON.stringify({ error: "Name must be 100 characters or less" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: trimmedName || "Fighter" },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ user: newUser.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const targetUserId = url.searchParams.get("userId");

      if (!targetUserId || !UUID_PATTERN.test(targetUserId)) {
        return new Response(JSON.stringify({ error: "A valid userId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-deletion
      if (targetUserId === userId) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("admin-users failed:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
