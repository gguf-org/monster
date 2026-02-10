/**
 * Minimal ClineAccountService stub for backend functionality
 */

export class ClineAccountService {
	private static instance: ClineAccountService | null = null
	public readonly baseUrl: string = "https://api.cline.bot"

	private constructor() {}

	public static getInstance(): ClineAccountService {
		if (!ClineAccountService.instance) {
			ClineAccountService.instance = new ClineAccountService()
		}
		return ClineAccountService.instance
	}

	/**
	 * Stub for transcribeAudio - returns error since auth is removed
	 */
	async transcribeAudio(_audioBase64: string, _language?: string): Promise<{ text: string }> {
		throw new Error("Voice transcription requires authentication. Please configure an API key.")
	}
}
