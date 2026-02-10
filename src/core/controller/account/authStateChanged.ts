import { Empty } from "@shared/proto/cline/common"
import { Controller } from ".."

export async function authStateChanged(_controller: Controller, _request: any): Promise<any> {
	return Empty.create()
}
