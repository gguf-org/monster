import { BannerActionType, type BannerCardData } from "@shared/cline/banner"
import axios from "axios"
import { ClineEnv } from "@/config"
import type { Controller } from "@/core/controller"
import { HostProvider } from "@/hosts/host-provider"
import { getAxiosSettings } from "@/shared/net"
import { AuthService } from "../auth/AuthService"
import { buildBasicClineHeaders } from "../EnvUtils"
import { getDistinctId } from "../logging/distinctId"
import { Logger } from "../logging/Logger"

/**
 * Service for fetching and evaluating banner messages
 */
export class BannerService {
	private static instance: BannerService | null = null
	private readonly _baseUrl = ClineEnv.config().apiBaseUrl
	private _controller: Controller
	private _authService?: AuthService
	private _cachedBanners: any[] = []
	private _lastFetchTime: number = 0
	private actionTypes: Set<string>

	private constructor(controller: Controller) {
		this._controller = controller
		this.actionTypes = new Set<string>(Object.values(BannerActionType))
	}

	/**
	 * Initializes the BannerService singleton with required dependencies
	 * @param controller The controller instance for accessing state and services
	 * @returns The initialized BannerService instance
	 * @throws Error if already initialized
	 */
	public static initialize(controller: Controller): BannerService {
		if (BannerService.instance) {
			throw new Error("BannerService has already been initialized.")
		}
		BannerService.instance = new BannerService(controller)
		return BannerService.instance
	}

	/**
	 * Returns the singleton instance of BannerService
	 * @throws Error if not initialized
	 */
	public static get(): BannerService {
		if (!BannerService.instance) {
			throw new Error("BannerService not initialized. Call BannerService.initialize() first.")
		}
		return BannerService.instance
	}

	/**
	 * Checks if BannerService has been initialized
	 */
	public static isInitialized(): boolean {
		return !!BannerService.instance
	}

	/**
	 * Resets the BannerService instance (primarily for testing)
	 */
	public static reset(): void {
		BannerService.instance = null
	}

	/**
	 * Sets the AuthService instance for testing purposes
	 * In production, AuthService is loaded dynamically when needed
	 */
	public setAuthService(authService: AuthService): void {
		this._authService = authService
	}

	/**
	 * Gets the current IDE type
	 * @returns IDE type (vscode, jetbrains, cli, or unknown)
	 */
	private async getIdeType(): Promise<string> {
		try {
			const hostVersion = await HostProvider.env.getHostVersion({})

			// Use clineType field which contains values like "VSCode Extension", "Cline for JetBrains", "CLI", etc.
			const clineType = hostVersion.clineType?.toLowerCase() || ""

			if (clineType.includes("vscode")) {
				return "vscode"
			}
			if (clineType.includes("jetbrains")) {
				return "jetbrains"
			}
			if (clineType.includes("cli")) {
				return "cli"
			}

			return "unknown"
		} catch (error) {
			Logger.error("BannerService: Error getting IDE type", error)
			return "unknown"
		}
	}

	/**
	 * Clears the banner cache
	 */
	public clearCache(): void {
		this._cachedBanners = []
		this._lastFetchTime = 0
		Logger.log("BannerService: Cache cleared")
	}

	/**
	 * Sends a banner event to the telemetry endpoint
	 * @param bannerId The ID of the banner
	 * @param eventType The type of event (now we only support dismiss, in the future we might want to support seen, click...)
	 */
	public async sendBannerEvent(bannerId: string, eventType: "dismiss"): Promise<void> {
		try {
			const url = new URL("/banners/v1/events", this._baseUrl).toString()

			// Get IDE type for surface
			const ideType = await this.getIdeType()
			let surface: string
			if (ideType === "cli") {
				surface = "cli"
			} else if (ideType === "jetbrains") {
				surface = "jetbrains"
			} else {
				surface = "vscode"
			}

			const instanceId = this.getInstanceDistinctId()

			const payload = {
				banner_id: bannerId,
				instance_id: instanceId,
				surface,
				event_type: eventType,
			}

			await axios.post(url, payload, {
				timeout: 10000,
				headers: {
					"Content-Type": "application/json",
					...(await buildBasicClineHeaders()),
				},
				...getAxiosSettings(),
			})

			Logger.log(`BannerService: Sent ${eventType} event for banner ${bannerId}`)
		} catch (error) {
			Logger.error(`BannerService: Error sending banner event`, error)
		}
	}

	/**
	 * Marks a banner as dismissed and stores it in state
	 * @param bannerId The ID of the banner to dismiss
	 */
	public async dismissBanner(bannerId: string): Promise<void> {
		try {
			const dismissedBanners = this._controller.stateManager.getGlobalStateKey("dismissedBanners") || []

			if (dismissedBanners.some((b) => b.bannerId === bannerId)) {
				Logger.log(`BannerService: Banner ${bannerId} already dismissed`)
				return
			}
			const newDismissal = {
				bannerId,
				dismissedAt: Date.now(),
			}

			this._controller.stateManager.setGlobalState("dismissedBanners", [...dismissedBanners, newDismissal])

			await this.sendBannerEvent(bannerId, "dismiss")

			this.clearCache()

			Logger.log(`BannerService: Banner ${bannerId} dismissed`)
		} catch (error) {
			Logger.error(`BannerService: Error dismissing banner`, error)
		}
	}

	/**
	 * Checks if a banner has been dismissed by the user
	 * @param bannerId The ID of the banner to check
	 * @returns true if the banner has been dismissed
	 */
	public isBannerDismissed(bannerId: string): boolean {
		try {
			const dismissedBanners = this._controller.stateManager.getGlobalStateKey("dismissedBanners") || []
			return dismissedBanners.some((b) => b.bannerId === bannerId)
		} catch (error) {
			Logger.error(`BannerService: Error checking if banner is dismissed`, error)
			return false
		}
	}

	/**
	 * Gets banners that haven't been dismissed by the user
	 * @param forceRefresh If true, bypasses cache and fetches fresh data
	 * @returns Array of non-dismissed banners converted to BannerCardData format
	 *
	 * TEMPORARILY DISABLED: Returning empty array to prevent API calls
	 */
	public async getActiveBanners(_forceRefresh = false): Promise<BannerCardData[]> {
		// Disable all banner fetching to prevent blocking the extension
		return []
	}

	/**
	 * Gets the distinct ID for the current user
	 * @returns distinct ID string
	 */
	private getInstanceDistinctId(): string {
		try {
			return getDistinctId()
		} catch (error) {
			Logger.error("BannerService: Error getting distinct ID", error)
			return "unknown"
		}
	}
}
