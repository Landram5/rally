declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    WRITE_LIMITER: RateLimit;
    AUTH_LIMITER: RateLimit;
    USER_WRITE_LIMITER: RateLimit;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SECRET_KEY?: string;
    RALLY_ADMIN_EMAILS?: string;
  }
}
