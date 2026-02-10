import { Empty } from "@shared/proto/cline/common"
import { Controller } from ".."

export async function getRedirectUrl(_controller: Controller, _request: any): Promise<any> {
	return Empty.create()
}
