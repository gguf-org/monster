import { Empty } from "@shared/proto/cline/common"
import { Controller } from ".."

/**
 * Stub for account logout - auth UI removed
 */
export async function accountLogoutClicked(_controller: Controller, _request: Empty): Promise<Empty> {
	// Auth UI removed - this is now a no-op
	return Empty.create()
}
