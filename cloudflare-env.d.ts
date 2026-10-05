declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SECRET_KEY?: string;
    RALLY_ADMIN_EMAILS?: string;
  }
}
