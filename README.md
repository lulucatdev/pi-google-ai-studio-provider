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

During `/login`, you will be prompted for an optional custom base URL. This is useful for relay/proxy setups (e.g., [Pincc CRS](https://github.com/Wei-Shaw/claude-relay-service)).

You can also set the base URL via environment variable:

```bash
export GOOGLE_AI_STUDIO_BASE_URL="https://your-relay.example.com/gemini/v1beta/openai"
```

The default base URL is `https://generativelanguage.googleapis.com/v1beta/openai` (Google's OpenAI-compatible endpoint).
