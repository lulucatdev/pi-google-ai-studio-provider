# pi-google-ai-studio-provider

Google AI Studio provider for [pi](https://github.com/mariozechner/pi). Models fetched from [models.dev](https://models.dev) on startup with hardcoded fallback.

## Install

```
pi install pi-google-ai-studio-provider
```

## Authentication

Use the `/login` command in pi to select **Google AI Studio** and paste your API key from [Google AI Studio](https://aistudio.google.com/apikey).

Alternatively, set the `GOOGLE_AI_STUDIO_API_KEY` environment variable.

## Custom Base URL

To use a custom relay or proxy server instead of the official Google API, set the base URL via environment variable **before starting pi**:

```bash
# For relays that support OpenAI-compatible format (with /openai path)
export GOOGLE_AI_STUDIO_BASE_URL="https://your-relay.example.com/gemini/v1beta/openai"

# For relays that only support native Google API format (without /openai path)
export GOOGLE_AI_STUDIO_BASE_URL="https://your-relay.example.com/gemini"
pi
```

The default base URL is `https://generativelanguage.googleapis.com/v1beta/openai` (Google's OpenAI-compatible endpoint).

**Auto-detection:** The plugin automatically detects which API format to use based on the base URL:
- If URL contains `/openai` → uses OpenAI-compatible format (`/chat/completions`)
- If URL does not contain `/openai` → uses native Google API format (`:generateContent`)

**Note:** The base URL must be set via environment variable. Changes made after pi has started will not take effect until restart.
