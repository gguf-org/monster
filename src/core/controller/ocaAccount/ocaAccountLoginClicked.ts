import { Empty, String as ProtoString } from "@shared/proto/cline/common"
import { Controller } from ".."

export async function ocaAccountLoginClicked(_controller: Controller, _request: Empty): Promise<ProtoString> {
	return ProtoString.create({ value: "" })
}
