declare namespace Cloudflare {
  interface Env {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    OPENAI_IMAGE_MODEL?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    ALLOWED_EMAILS?: string;
    LOCAL_DEV_EMAIL?: string;
    ASSETS?: Fetcher;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
