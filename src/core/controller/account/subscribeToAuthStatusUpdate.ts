import { Empty } from "@shared/proto/cline/common"
import { Controller } from ".."

export async function subscribeToAuthStatusUpdate(_controller: Controller, _request: any): Promise<any> {
	return Empty.create()
}
