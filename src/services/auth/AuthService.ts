/**
 * Minimal AuthService stub for backend Cline API authentication
 * UI components removed - this only handles backend auth tokens
 */

export interface ClineAccountUserInfo {
	id: string
	email?: string
	name?: string
	displayName?: string
}

export class AuthService {
	private static instance: AuthService | null = null
	private authToken: string | null = null
	private userInfo: ClineAccountUserInfo | null = null

	private constructor() {}

	public static getInstance(): AuthService {
		if (!AuthService.instance) {
			AuthService.instance = new AuthService()
		}
		return AuthService.instance
	}

	/**
	 * Get the current auth token for API calls
	 */
	async getAuthToken(): Promise<string | null> {
		return this.authToken
	}

	/**
	 * Get user info (for telemetry and remote config)
	 */
	getInfo(): { user: ClineAccountUserInfo | null } | null {
		if (!this.userInfo) {
			return null
		}
		return { user: this.userInfo }
	}

	/**
	 * Get user organizations (for remote config permissions)
	 */
	getUserOrganizations(): Array<{ organizationId: string; roles?: string[] }> | null {
		return null
	}

	/**
	 * Set auth token (can be called by config loaders if needed)
	 */
	setAuthToken(token: string | null) {
		this.authToken = token
	}

	/**
	 * Set user info
	 */
	setUserInfo(info: ClineAccountUserInfo | null) {
		this.userInfo = info
	}

	/**
	 * Get active organization ID (for telemetry)
	 */
	getActiveOrganizationId(): string | null {
		return null
	}
}
