import type { ExtensionAPI, OAuthCredentials, OAuthFlowCallbacks } from "@anthropic-ai/sdk";

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
	if (Array.isArray(value)) {
		const lower = value.map((v) => String(v).toLowerCase());
		if (lower.includes("image") || lower.includes("video")) {
			return ["text", "image"];
		}
	}
	return ["text"];
}

function normalizeProviderModel(id: string, value: unknown): ProviderModel | undefined {
	if (!isRecord(value)) return undefined;

	const cost = isRecord(value.cost) ? value.cost : {};
	const limit = isRecord(value.limit) ? value.limit : {};

	return {
		id,
		name: typeof value.name === "string" ? value.name : id,
		reasoning: value.reasoning === true,
		input: normalizeInput(value.input ?? (isRecord(value.modalities) ? value.modalities : undefined)),
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
		const data = await res.json();
		if (!isRecord(data)) return undefined;

		const providerData = data[MODELS_DEV_PROVIDER_KEY];
		if (!isRecord(providerData)) return undefined;

		const models: ProviderModel[] = [];
		for (const [id, value] of Object.entries(providerData)) {
			const model = normalizeProviderModel(id, value);
			if (model) models.push(model);
		}
		return models.length > 0 ? models.sort((a, b) => a.id.localeCompare(b.id)) : undefined;
	} catch {
		return undefined;
	}
}

export default function googleAiStudioExtension(pi: ExtensionAPI) {
	let currentModels = DEFAULT_MODELS;

	function registerWithModels(models: ProviderModel[]) {
		currentModels = models;
		pi.registerProvider({
			id: PROVIDER_ID,
			name: PROVIDER_NAME,
			api: "openai-completions",
			baseUrl: baseUrl,
			apiKeyEnvVarName: "GOOGLE_AI_STUDIO_API_KEY",
			oauth: {
				login: async (callbacks: OAuthFlowCallbacks): Promise<OAuthCredentials | undefined> => {
					const apiKey = await callbacks.promptForText("Enter your Google AI Studio API key:");
					if (!apiKey) return undefined;

					const urlInput = await callbacks.promptForText(`Enter base URL (leave empty for ${baseUrl}):`);
					if (urlInput?.trim()) {
						baseUrl = urlInput.trim().replace(/\/+$/, "");
						registerWithModels(currentModels);
					}

					return {
						access: apiKey,
						refresh: apiKey,
						expires: Date.now() + 3650 * 24 * 60 * 60 * 1000,
					};
				},
				refresh: async (credentials: OAuthCredentials): Promise<OAuthCredentials> => credentials,
			},
			models: models.map((m) => ({
				id: m.id,
				name: m.name,
				reasoning: m.reasoning,
				input: m.input,
				cost: m.cost,
				contextWindow: m.contextWindow,
				maxTokens: m.maxTokens,
			})),
		});
	}

	registerWithModels(DEFAULT_MODELS);

	fetchModelsFromModelsDev().then((models) => {
		if (models) registerWithModels(models);
	});
}
