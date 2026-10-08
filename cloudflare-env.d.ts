declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    WRITE_LIMITER: RateLimit;
    AUTH_LIMITER: RateLimit;
    USER_WRITE_LIMITER: RateLimit;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    RESEND_API_KEY?: string;
    NOTIFICATION_FROM?: string;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SECRET_KEY?: string;
    RALLY_ADMIN_EMAILS?: string;
  }
}
