import { Empty } from "@shared/proto/cline/common"
import { Controller } from ".."

export async function ocaAccountLogoutClicked(_controller: Controller, _request: Empty): Promise<Empty> {
	return Empty.create()
}
