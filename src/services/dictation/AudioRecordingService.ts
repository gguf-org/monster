import { ChildProcess, spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Logger } from "@services/logging/Logger"
import { AUDIO_PROGRAM_CONFIG } from "@/shared/audioProgramConstants"

function isExecutable(filePath: string): boolean {
	try {
		fs.accessSync(filePath, fs.constants.X_OK)
		return true
	} catch {
		return false
	}
}

export class AudioRecordingService {
	private recordingProcess: ChildProcess | null = null
	private startTime: number = 0
	private outputFile: string = ""
	private isRecordingActive: boolean = false

	constructor() {}

	/**
	 * Discovers the default audio input device on Windows using DirectShow
	 */
	private async getWindowsAudioDevice(ffmpegPath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const process = spawn(ffmpegPath, ["-list_devices", "true", "-f", "dshow", "-i", "dummy"])
			let output = ""

			process.stderr.on("data", (data) => {
				output += data.toString()
			})

			process.on("close", () => {
				// Parse output for audio devices
				// matches: [dshow @ ...] "Device Name" (audio)
				const audioRegex = /"([^"]+)" \(audio\)/
				const match = output.match(audioRegex)
				
				if (match && match[1]) {
					resolve(match[1])
				} else {
					// Fallback to "default" if parsing fails implementation
					Logger.warn("Could not find specific audio device in ffmpeg output, falling back to 'default'")
					// On some systems "default" might work for dshow too, or we might fail
					// but it's better than rejecting if we can't find a match
					resolve("default")
				}
			})

			process.on("error", (err) => {
				reject(err)
			})
		})
	}

	/**
	 * Determines if recording is currently active by checking explicit flag and process state
	 */
	private get isRecording(): boolean {
		return this.isRecordingActive && this.recordingProcess !== null
	}

	/**
	 * Resets the recording state variables
	 */
	private resetRecordingState(): void {
		this.recordingProcess = null
		this.startTime = 0
		this.isRecordingActive = false
	}

	/**
	 * Cleans up the temporary audio file
	 */
	private async cleanupTempFile(): Promise<void> {
		if (this.outputFile && fs.existsSync(this.outputFile)) {
			try {
				fs.unlinkSync(this.outputFile)
				Logger.info("Temporary audio file cleaned up")
			} catch (error) {
				Logger.warn("Failed to cleanup temporary audio file: " + (error instanceof Error ? error.message : String(error)))
			} finally {
				this.outputFile = ""
			}
		}
	}

	/**
	 * Terminates the recording process gracefully
	 */
	private async terminateProcess(): Promise<void> {
		if (!this.recordingProcess) {
			return
		}

		Logger.info("Terminating recording process...")
		this.recordingProcess.kill("SIGINT")

		// Wait for the process to finish with timeout
		await new Promise<void>((resolve) => {
			const timeoutId = setTimeout(() => {
				Logger.warn("Process termination timed out after 5 seconds")
				resolve()
			}, 5000)

			this.recordingProcess?.on("exit", (code) => {
				clearTimeout(timeoutId)
				Logger.info(`Recording process exited with code: ${code}`)
				resolve()
			})
		})
	}

	/**
	 * Performs comprehensive cleanup of recording resources
	 * @param options - Cleanup options
	 * @param options.keepFile - If true, preserves the temporary file
	 */
	private async performCleanup(options?: { keepFile?: boolean }): Promise<void> {
		await this.terminateProcess()
		this.resetRecordingState()

		if (!options?.keepFile) {
			await this.cleanupTempFile()
		}
	}

	async startRecording(): Promise<{ success: boolean; error?: string }> {
		try {
			// Defensive cleanup before starting - ensures clean state
			if (this.recordingProcess || this.outputFile) {
				Logger.info("Performing pre-recording cleanup of stale resources...")
				await this.performCleanup()
			}

			if (this.isRecording) {
				return { success: false, error: "Already recording" }
			}

			// Check if recording software is available
			const checkResult = this.checkRecordingDependencies()
			if (!checkResult.available) {
				return { success: false, error: checkResult.error }
			}

			// Create temporary file for audio output
			const tempDir = os.tmpdir()
			this.outputFile = path.join(tempDir, `cline_recording_${Date.now()}.webm`)

			Logger.info("Starting audio recording...")

			// Get the recording program path
			const recordProgram = this.getRecordProgram()
			if (!recordProgram) {
				return { success: false, error: "Recording program not found" }
			}
			Logger.info(`Using recording program: ${recordProgram.path}`)

			// Discover device name on Windows
			let deviceName: string | undefined
			if (os.platform() === "win32") {
				try {
					Logger.info("Attempting to discover Windows audio device...")
					deviceName = await this.getWindowsAudioDevice(recordProgram.path)
					Logger.info(`Discovered Windows audio device: ${deviceName}`)
				} catch (error) {
					Logger.warn(`Failed to discover Windows audio device: ${error instanceof Error ? error.message : String(error)}`)
				}
			}

			// Set up recording arguments
			const args = recordProgram.getArgs(this.outputFile, deviceName)

			// Spawn the recording process
			this.recordingProcess = spawn(recordProgram.path, args)
			this.startTime = Date.now()
			this.isRecordingActive = true

			// Handle process errors
			this.recordingProcess.on("error", (error) => {
				Logger.error(`Recording process error: ${error.message}`)
				this.resetRecordingState()
			})

			// Handle process exit
			this.recordingProcess.on("exit", (code) => {
				if (code !== 0 && code !== null) {
					Logger.warn(`Recording process exited with code: ${code}`)
				}
				this.isRecordingActive = false
			})

			this.recordingProcess.stderr?.on("data", (data) => {
				const message = data.toString().trim()
				if (message && !message.includes("In:") && !message.includes("Out:")) {
					Logger.info(`Recording stderr: ${message}`)
				}
			})

			Logger.info("Audio recording started successfully")
			return { success: true }
		} catch (error) {
			await this.performCleanup()
			const errorMessage = error instanceof Error ? error.message : String(error)
			Logger.error("Failed to start audio recording: " + errorMessage)
			return { success: false, error: `Failed to start recording: ${errorMessage}` }
		}
	}

	async stopRecording(): Promise<{ success: boolean; audioBase64?: string; error?: string }> {
		try {
			if (!this.isRecording) {
				return { success: false, error: "Not currently recording" }
			}

			Logger.info("Stopping audio recording...")

			// Terminate the process but keep the file for reading
			await this.terminateProcess()
			this.resetRecordingState()

			// Wait a moment for file to be fully written
			await new Promise((resolve) => setTimeout(resolve, 500))

			// Read the audio file and convert to base64
			if (!fs.existsSync(this.outputFile)) {
				return { success: false, error: "Recording file not found" }
			}

			const audioBuffer = fs.readFileSync(this.outputFile)
			const audioBase64 = audioBuffer.toString("base64")

			// Clean up temporary file after reading
			await this.cleanupTempFile()

			Logger.info("Audio recording stopped and converted to base64")
			return { success: true, audioBase64 }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			Logger.error("Failed to stop audio recording: " + errorMessage)

			// Ensure cleanup happens even on error
			await this.performCleanup()

			return { success: false, error: `Failed to stop recording: ${errorMessage}` }
		}
	}

	async cancelRecording(): Promise<{ success: boolean; error?: string }> {
		try {
			if (!this.isRecording) {
				return { success: false, error: "Not currently recording" }
			}

			Logger.info("Canceling audio recording...")

			// Perform full cleanup including file deletion
			await this.performCleanup()

			Logger.info("Audio recording canceled successfully")
			return { success: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			Logger.error("Failed to cancel audio recording: " + errorMessage)

			// Ensure cleanup happens even on error
			await this.performCleanup()

			return { success: false, error: `Failed to cancel recording: ${errorMessage}` }
		}
	}

	getRecordingStatus(): { isRecording: boolean; durationSeconds: number; error?: string } {
		const durationSeconds = this.isRecording ? (Date.now() - this.startTime) / 1000 : 0
		return {
			isRecording: this.isRecording,
			durationSeconds,
		}
	}

	private checkRecordingDependencies(): { available: boolean; error?: string } {
		const program = this.getRecordProgram()
		if (!program) {
			const platform = os.platform() as keyof typeof AUDIO_PROGRAM_CONFIG
			const config = AUDIO_PROGRAM_CONFIG[platform]
			const error = config ? config.error : `Audio recording is not supported on platform: ${platform}`
			return { available: false, error }
		}
		return { available: true }
	}

	private getRecordProgram(): { path: string; getArgs: (outputFile: string, deviceName?: string) => string[] } | undefined {
		const platform = os.platform() as keyof typeof AUDIO_PROGRAM_CONFIG
		const config = AUDIO_PROGRAM_CONFIG[platform]

		if (!config) {
			return undefined
		}

		// 1. Check if the command is in the system's PATH
		const pathDirs = (process.env.PATH || "").split(path.delimiter)
		for (const dir of pathDirs) {
			const fullPath = path.join(dir, config.command)
			if (fs.existsSync(fullPath) && isExecutable(fullPath)) {
				return { path: fullPath, getArgs: config.getArgs }
			}
		}

		// 2. Check fallback paths if not in PATH
		for (const p of config.fallbackPaths) {
			if (fs.existsSync(p) && isExecutable(p)) {
				return { path: p, getArgs: config.getArgs }
			}
		}

		return undefined
	}

	/**
	 * Public cleanup method for service shutdown
	 */
	cleanup(): void {
		// Use async cleanup but don't await since this is often called in sync contexts
		this.performCleanup().catch((error) => {
			Logger.error("Error during cleanup: " + (error instanceof Error ? error.message : String(error)))
		})
	}
}

export const audioRecordingService = new AudioRecordingService()
