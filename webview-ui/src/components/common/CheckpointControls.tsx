import { CheckpointRestoreRequest } from "@shared/proto/cline/checkpoints"
import { Int64Request } from "@shared/proto/cline/common"
import { useEffect, useRef, useState } from "react"
import { useClickAway } from "react-use"
import { Button } from "@/components/ui/button"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"
import { CheckpointsServiceClient } from "@/services/grpc-client"

interface CheckpointOverlayProps {
	messageTs?: number
}

export const CheckpointOverlay = ({ messageTs }: CheckpointOverlayProps) => {
	const [compareDisabled, setCompareDisabled] = useState(false)
	const [restoreTaskDisabled, setRestoreTaskDisabled] = useState(false)
	const [restoreWorkspaceDisabled, setRestoreWorkspaceDisabled] = useState(false)
	const [restoreBothDisabled, setRestoreBothDisabled] = useState(false)
	const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
	const [hasMouseEntered, setHasMouseEntered] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const tooltipRef = useRef<HTMLDivElement>(null)
	const { onRelinquishControl } = useExtensionState()

	useClickAway(containerRef, () => {
		if (showRestoreConfirm) {
			setShowRestoreConfirm(false)
			setHasMouseEntered(false)
		}
	})

	// Use the onRelinquishControl hook instead of message event
	useEffect(() => {
		return onRelinquishControl(() => {
			setCompareDisabled(false)
			setRestoreTaskDisabled(false)
			setRestoreWorkspaceDisabled(false)
			setRestoreBothDisabled(false)
			setShowRestoreConfirm(false)
		})
	}, [onRelinquishControl])

	const handleRestoreTask = async () => {
		setRestoreTaskDisabled(true)
		try {
			await CheckpointsServiceClient.checkpointRestore(
				CheckpointRestoreRequest.create({
					number: messageTs,
					restoreType: "task",
				}),
			)
		} catch (err) {
			console.error("Checkpoint restore task error:", err)
			setRestoreTaskDisabled(false)
		}
	}

	const handleRestoreWorkspace = async () => {
		setRestoreWorkspaceDisabled(true)
		try {
			await CheckpointsServiceClient.checkpointRestore(
				CheckpointRestoreRequest.create({
					number: messageTs,
					restoreType: "workspace",
				}),
			)
		} catch (err) {
			console.error("Checkpoint restore workspace error:", err)
			setRestoreWorkspaceDisabled(false)
		}
	}

	const handleRestoreBoth = async () => {
		setRestoreBothDisabled(true)
		try {
			await CheckpointsServiceClient.checkpointRestore(
				CheckpointRestoreRequest.create({
					number: messageTs,
					restoreType: "taskAndWorkspace",
				}),
			)
		} catch (err) {
			console.error("Checkpoint restore both error:", err)
			setRestoreBothDisabled(false)
		}
	}

	const handleMouseEnter = () => {
		setHasMouseEntered(true)
	}

	const handleMouseLeave = () => {
		if (hasMouseEntered) {
			setShowRestoreConfirm(false)
			setHasMouseEntered(false)
		}
	}

	const handleControlsMouseLeave = (e: React.MouseEvent) => {
		const tooltipElement = tooltipRef.current

		if (tooltipElement && showRestoreConfirm) {
			const tooltipRect = tooltipElement.getBoundingClientRect()

			// If mouse is moving towards the tooltip, don't close it
			if (
				e.clientY >= tooltipRect.top &&
				e.clientY <= tooltipRect.bottom &&
				e.clientX >= tooltipRect.left &&
				e.clientX <= tooltipRect.right
			) {
				return
			}
		}

		setShowRestoreConfirm(false)
		setHasMouseEntered(false)
	}

	return (
		<div
			className="absolute top-[3px] right-[6px] flex gap-[6px] opacity-0 bg-sidebar-background p-[3px_0_3px_3px] hover:opacity-100 transition-opacity"
			onMouseLeave={handleControlsMouseLeave}>
			<Button
				variant="secondary"
				className={cn("h-6 w-6 p-0", compareDisabled && "cursor-wait")}
				disabled={compareDisabled}
				onClick={async () => {
					setCompareDisabled(true)
					try {
						await CheckpointsServiceClient.checkpointDiff(
							Int64Request.create({
								value: messageTs,
							}),
						)
					} catch (err) {
						console.error("CheckpointDiff error:", err)
					} finally {
						setCompareDisabled(false)
					}
				}}
				title="Compare">
				<span className="codicon codicon-diff-multiple" />
			</Button>
			<div ref={containerRef} className="relative">
				<Button
					variant="secondary"
					className="h-6 w-6 p-0"
					onClick={() => setShowRestoreConfirm(true)}
					title="Restore">
					<span className="codicon codicon-discard" />
				</Button>
				{showRestoreConfirm && (
					<div
						ref={tooltipRef}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
						className="absolute top-full right-0 bg-code-block-background border border-editor-group-border p-3 rounded-xs mt-2 w-[calc(100vw-57px)] min-w-0 max-w-[100vw] z-50 shadow-xl before:content-[''] before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 after:content-[''] after:absolute after:-top-[6px] after:right-[6px] after:w-[10px] after:h-[10px] after:bg-code-block-background after:border-l after:border-t after:border-editor-group-border after:rotate-45 after:z-[1]">
						<div className="border-b border-editor-group-border pb-1 mb-2.5 last:border-0 last:mb-0 last:pb-0">
							<Button
								variant="secondary"
								disabled={restoreBothDisabled}
								onClick={handleRestoreBoth}
								className={cn("w-full mb-2.5", restoreBothDisabled && "cursor-wait")}>
								Restore Task and Workspace
							</Button>
							<p className="m-0 mb-0.5 text-description text-[11px] leading-[14px]">
								Restores the task and your project's files back to a snapshot taken at this point
							</p>
						</div>
						<div className="border-b border-editor-group-border pb-1 mb-2.5 last:border-0 last:mb-0 last:pb-0">
							<Button
								variant="secondary"
								disabled={restoreTaskDisabled}
								onClick={handleRestoreTask}
								className={cn("w-full mb-2.5", restoreTaskDisabled && "cursor-wait")}>
								Restore Task Only
							</Button>
							<p className="m-0 mb-0.5 text-description text-[11px] leading-[14px]">
								Deletes messages after this point (does not affect workspace)
							</p>
						</div>
						<div className="border-b border-editor-group-border pb-1 mb-2.5 last:border-0 last:mb-0 last:pb-0">
							<Button
								variant="secondary"
								disabled={restoreWorkspaceDisabled}
								onClick={handleRestoreWorkspace}
								className={cn("w-full mb-2.5", restoreWorkspaceDisabled && "cursor-wait")}>
								Restore Workspace Only
							</Button>
							<p className="m-0 mb-0.5 text-description text-[11px] leading-[14px]">
								Restores your project's files to a snapshot taken at this point (task may become out of sync)
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
