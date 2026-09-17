declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TAROT_AI_PROVIDER?: string;
    OPENAI_API_KEY?: string;
    OPENAI_TAROT_MODEL?: string;
    GEMINI_API_KEY?: string;
    GEMINI_TAROT_MODEL?: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_TAROT_MODEL?: string;
  }
}
