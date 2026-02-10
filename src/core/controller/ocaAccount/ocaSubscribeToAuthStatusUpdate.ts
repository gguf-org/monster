import { Empty } from "@shared/proto/cline/common"
import { StreamingResponseHandler } from "@/core/controller/grpc-handler"
import { AuthState } from "@shared/proto/cline/account"
import { Controller } from ".."

export async function ocaSubscribeToAuthStatusUpdate(
	_controller: Controller,
	_request: Empty,
	_responseStream: StreamingResponseHandler<AuthState>,
): Promise<void> {
	// No-op stub
}
