import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const PROVIDER_ID = "google-ai-studio";
const PROVIDER_NAME = "Google AI Studio";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const MODELS_DEV_URL = "https://models.dev/api.json";
const MODELS_DEV_PROVIDER_KEY = "google";

type ProviderModel = {
	id: string;
	name: string;
	reasoning: boolean;
	input: Array<"text" | "image">;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	};
	contextWindow: number;
	maxTokens: number;
};

const DEFAULT_MODELS: ProviderModel[] = [
	{
		id: "gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 1.25, output: 10, cacheRead: 0.31, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 65536,
	},
	{
		id: "gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0.15, output: 0.6, cacheRead: 0.0375, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 65536,
	},
	{
		id: "gemini-2.0-flash",
		name: "Gemini 2.0 Flash",
		reasoning: false,
		input: ["text", "image"],
		cost: { input: 0.1, output: 0.4, cacheRead: 0.025, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 8192,
	},
	{
		id: "gemini-2.0-flash-lite",
		name: "Gemini 2.0 Flash Lite",
		reasoning: false,
		input: ["text", "image"],
		cost: { input: 0.075, output: 0.3, cacheRead: 0.01875, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 8192,
	},
];

let baseUrl = process.env.GOOGLE_AI_STUDIO_BASE_URL || DEFAULT_BASE_URL;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function normalizeInput(value: unknown): Array<"text" | "image"> {
	if (!isRecord(value) || !Array.isArray(value.input)) return ["text"];
	const inputs = value.input.filter((item): item is string => typeof item === "string");
	return inputs.includes("image") || inputs.includes("video") ? ["text", "image"] : ["text"];
}

function normalizeProviderModel(id: string, value: unknown): ProviderModel | undefined {
	if (!isRecord(value)) return undefined;

	const cost = isRecord(value.cost) ? value.cost : {};
	const limit = isRecord(value.limit) ? value.limit : {};

	return {
		id,
		name: typeof value.name === "string" ? value.name : id,
		reasoning: value.reasoning === true,
		input: normalizeInput(value.modalities),
		cost: {
			input: toFiniteNumber(cost.input ?? cost.input_price),
			output: toFiniteNumber(cost.output ?? cost.output_price),
			cacheRead: toFiniteNumber(cost.cacheRead ?? cost.cache_read),
			cacheWrite: toFiniteNumber(cost.cacheWrite ?? cost.cache_write),
		},
		contextWindow: toFiniteNumber(limit.context ?? limit.contextWindow, 1048576),
		maxTokens: toFiniteNumber(limit.output ?? limit.maxTokens, 8192),
	};
}

async function fetchModelsFromModelsDev(): Promise<ProviderModel[] | undefined> {
	try {
		const res = await fetch(MODELS_DEV_URL);
		if (!res.ok) return undefined;
		const data = (await res.json()) as Record<string, unknown>;
		const provider = data[MODELS_DEV_PROVIDER_KEY];
		if (!isRecord(provider) || !isRecord(provider.models)) return undefined;

		const models = Object.entries(provider.models as Record<string, unknown>)
			.map(([id, val]) => normalizeProviderModel(id, val))
			.filter((m): m is ProviderModel => Boolean(m))
			.sort((a, b) => a.id.localeCompare(b.id));

		return models.length > 0 ? models : undefined;
	} catch {
		return undefined;
	}
}

export default function googleAiStudioExtension(pi: ExtensionAPI) {
	let currentModels = DEFAULT_MODELS;

	const providerConfig = (models: ProviderModel[]) => ({
		baseUrl: baseUrl,
		apiKey: "GOOGLE_AI_STUDIO_API_KEY",
		api: "openai-completions" as const,
		models,
		oauth: {
			name: PROVIDER_NAME,
			login: async (callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> => {
				const key = (
					await callbacks.onPrompt({ message: `Paste ${PROVIDER_NAME} API key:` })
				).trim();
				if (!key) throw new Error("No API key provided.");

				return {
					access: key,
					refresh: key,
					expires: Date.now() + 3650 * 24 * 60 * 60 * 1000,
				};
			},
			refreshToken: async (credentials: OAuthCredentials): Promise<OAuthCredentials> => credentials,
			getApiKey: (credentials: OAuthCredentials) => credentials.access,
		},
	});

	function registerWithModels(models: ProviderModel[]) {
		currentModels = models;
		pi.registerProvider(PROVIDER_ID, providerConfig(models));
	}

	registerWithModels(DEFAULT_MODELS);

	fetchModelsFromModelsDev().then((models) => {
		if (models) registerWithModels(models);
	});

	pi.registerCommand("gai-base-url", {
		description: "Set or show Google AI Studio base URL",
		handler: async (args, ctx) => {
			let url = args.trim().replace(/\/+$/, "");
			if (!url) {
				url = (await ctx.ui.input("Google AI Studio Base URL", baseUrl))?.trim().replace(/\/+$/, "") ?? "";
			}
			if (!url) {
				ctx.ui.notify(`Current: ${baseUrl}`, "info");
				return;
			}
			baseUrl = url;
			registerWithModels(currentModels);
			ctx.ui.notify(`Base URL set to: ${baseUrl}`, "info");
		},
	});
}
