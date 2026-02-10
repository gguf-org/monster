import type { ApiConfiguration } from "@shared/api"
import { fileExistsAtPath } from "@utils/fs"
import * as fs from "fs/promises"
import * as path from "path"
import { HostProvider } from "@/hosts/host-provider"

/**
 * Interface matching coder.config.json schema
 */
export interface CoderConfig {
	coder: {
		providers: Array<{
			name: string
			baseUrl: string
			apiKey?: string
			models: string[]
		}>
		mcpServers?: Array<{
			name: string
			command: string
			args: string[]
			env?: Record<string, string>
		}>
	}
}

/**
 * Service to load and parse coder.config.json
 */
export class CoderConfigService {
	private static instance: CoderConfigService
	private config?: CoderConfig
	private configPath?: string

	private constructor() { }

	public static getInstance(): CoderConfigService {
		if (!CoderConfigService.instance) {
			CoderConfigService.instance = new CoderConfigService()
		}
		return CoderConfigService.instance
	}

	/**
	 * Load coder.config.json from workspace or user home
	 */
	public async loadConfig(): Promise<CoderConfig | undefined> {
		// Try to find coder.config.json in workspace folders
		const workspacePathsResponse = await HostProvider.workspace.getWorkspacePaths({})
		const workspacePaths = workspacePathsResponse.paths || []

		if (workspacePaths.length > 0) {
			for (const workspacePath of workspacePaths) {
				const configPath = path.join(workspacePath, "coder.config.json")
				if (await fileExistsAtPath(configPath)) {
					this.configPath = configPath
					return await this.readConfigFile(configPath)
				}
			}
		}

		// Try user home directory
		const homeDir = process.env.HOME || process.env.USERPROFILE
		if (homeDir) {
			const configPath = path.join(homeDir, "coder.config.json")
			if (await fileExistsAtPath(configPath)) {
				this.configPath = configPath
				return await this.readConfigFile(configPath)
			}
		}

		console.log("[CoderConfigService] No coder.config.json found")
		return undefined
	}

	private async readConfigFile(configPath: string): Promise<CoderConfig | undefined> {
		try {
			const content = await fs.readFile(configPath, "utf-8")
			const parsedConfig = JSON.parse(content) as CoderConfig

			// Sanitize baseUrls in providers (remove /v1 suffix if present)
			if (parsedConfig.coder?.providers) {
				parsedConfig.coder.providers = parsedConfig.coder.providers.map((provider) => {
					if (provider.baseUrl && provider.baseUrl.endsWith("/v1")) {
						return {
							...provider,
							baseUrl: provider.baseUrl.slice(0, -3),
						}
					}
					return provider
				})
			}

			this.config = parsedConfig
			console.log(`[CoderConfigService] Loaded config from ${configPath}`)
			return this.config
		} catch (error) {
			console.error(`[CoderConfigService] Failed to read config from ${configPath}:`, error)
			return undefined
		}
	}

	/**
	 * Get the loaded config
	 */
	public getConfig(): CoderConfig | undefined {
		return this.config
	}

	/**
	 * Map CoderConfig to ApiConfiguration
	 * This creates a basic mapping - you may need to extend this based on your needs
	 */
	public mapToApiConfiguration(config: CoderConfig, currentConfig: Partial<ApiConfiguration>): Partial<ApiConfiguration> {
		if (!config.coder.providers || config.coder.providers.length === 0) {
			return currentConfig
		}

		// Use the first provider as default
		const provider = config.coder.providers[0]
		const updatedConfig: Partial<ApiConfiguration> = { ...currentConfig }

		// Map based on provider name or baseUrl
		const providerName = provider.name.toLowerCase()

		if (providerName.includes("openrouter") || provider.baseUrl.includes("openrouter")) {
			updatedConfig.planModeApiProvider = "openrouter"
			updatedConfig.actModeApiProvider = "openrouter"
			updatedConfig.openRouterApiKey = provider.apiKey
			if (provider.models.length > 0) {
				updatedConfig.planModeOpenRouterModelId = provider.models[0]
				updatedConfig.actModeOpenRouterModelId = provider.models[0]
			}
		} else if (providerName.includes("ollama") || provider.baseUrl.includes("ollama") || provider.baseUrl.includes("11434")) {
			updatedConfig.planModeApiProvider = "ollama"
			updatedConfig.actModeApiProvider = "ollama"
			updatedConfig.ollamaBaseUrl = provider.baseUrl
			updatedConfig.ollamaApiKey = provider.apiKey
			if (provider.models.length > 0) {
				updatedConfig.planModeOllamaModelId = provider.models[0]
				updatedConfig.actModeOllamaModelId = provider.models[0]
			}
		} else if (providerName.includes("openai") || provider.baseUrl.includes("openai")) {
			updatedConfig.planModeApiProvider = "openai"
			updatedConfig.actModeApiProvider = "openai"
			updatedConfig.openAiBaseUrl = provider.baseUrl
			updatedConfig.openAiApiKey = provider.apiKey
			if (provider.models.length > 0) {
				updatedConfig.planModeOpenAiModelId = provider.models[0]
				updatedConfig.actModeOpenAiModelId = provider.models[0]
			}
		} else if (providerName.includes("lmstudio") || provider.baseUrl.includes("1234")) {
			updatedConfig.planModeApiProvider = "lmstudio"
			updatedConfig.actModeApiProvider = "lmstudio"
			updatedConfig.lmStudioBaseUrl = provider.baseUrl
			if (provider.models.length > 0) {
				updatedConfig.planModeLmStudioModelId = provider.models[0]
				updatedConfig.actModeLmStudioModelId = provider.models[0]
			}
		} else if (providerName.includes("z.ai") || provider.baseUrl.includes("z.ai")) {
			updatedConfig.planModeApiProvider = "zai"
			updatedConfig.actModeApiProvider = "zai"
			updatedConfig.zaiApiKey = provider.apiKey
			if (provider.models.length > 0) {
				updatedConfig.planModeApiModelId = provider.models[0]
				updatedConfig.actModeApiModelId = provider.models[0]
			}
		}

		return updatedConfig
	}

	/**
	 * Get MCP servers from config
	 */
	public getMcpServers(): CoderConfig["coder"]["mcpServers"] {
		return this.config?.coder.mcpServers || []
	}
}
