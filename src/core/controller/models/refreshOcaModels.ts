/**
 * Stub file for removed OCA models refresh functionality
 */
import { OcaCompatibleModelInfo } from "@shared/proto/cline/models"
import { StringRequest } from "@shared/proto/cline/common"
import { Controller } from ".."

export async function refreshOcaModels(_controller: Controller, _request: StringRequest): Promise<OcaCompatibleModelInfo> {
	// OCA provider removed - return empty model info
	return OcaCompatibleModelInfo.create({ error: "OCA provider not supported" })
}
