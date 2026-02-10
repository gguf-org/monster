import type { ClineMessage } from "@shared/ExtensionMessage"
import type { Mode } from "@shared/storage/types"
import { Button } from "@/components/ui/button"
import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { VirtuosoHandle } from "react-virtuoso"
import { ButtonActionType, getButtonConfig } from "../../shared/buttonConfig"
import type { ChatState, MessageHandlers } from "../../types/chatTypes"

interface ActionButtonsProps {
	task?: ClineMessage
	messages: ClineMessage[]
	chatState: ChatState
	messageHandlers: MessageHandlers
	mode: Mode
	scrollBehavior: {
		scrollToBottomSmooth: () => void
		disableAutoScrollRef: React.MutableRefObject<boolean>
		showScrollToBottom: boolean
		virtuosoRef: React.RefObject<VirtuosoHandle>
	}
}

/**
 * Action buttons area including scroll-to-bottom and approve/reject buttons
 */
export const ActionButtons: React.FC<ActionButtonsProps> = ({
	task,
	messages,
	chatState,
	mode,
	messageHandlers,
	scrollBehavior,
}) => {
	const { inputValue, selectedImages, selectedFiles, setSendingDisabled } = chatState
	const [isProcessing, setIsProcessing] = useState(false)

	// Memoize last messages to avoid unnecessary recalculations
	const [lastMessage, secondLastMessage] = useMemo(() => {
		const len = messages.length
		return len > 0 ? [messages[len - 1], messages[len - 2]] : [undefined, undefined]
	}, [messages])

	// Memoize button configuration to avoid recalculation on every render
	const buttonConfig = useMemo(() => {
		return lastMessage ? getButtonConfig(lastMessage, mode) : { sendingDisabled: false, enableButtons: false }
	}, [lastMessage, mode])

	// Single effect to handle all configuration updates
	useEffect(() => {
		setSendingDisabled(buttonConfig.sendingDisabled)
		setIsProcessing(false)
	}, [buttonConfig, setSendingDisabled])

	// Clear input when transitioning from command_output to api_req
	// This happens when user provides feedback during command execution
	useEffect(() => {
		if (lastMessage?.type === "say" && lastMessage.say === "api_req_started" && secondLastMessage?.ask === "command_output") {
			chatState.setInputValue("")
			chatState.setSelectedImages([])
			chatState.setSelectedFiles([])
		}
	}, [lastMessage?.type, lastMessage?.say, secondLastMessage?.ask, chatState])

	const handleActionClick = useCallback(
		(action: ButtonActionType, text?: string, images?: string[], files?: string[]) => {
			if (isProcessing) {
				return
			}
			setIsProcessing(true)

			// Special handling for cancel action
			if (action === "cancel") {
				setIsProcessing(false)
			}

			messageHandlers.executeButtonAction(action, text, images, files)
		},
		[messageHandlers, isProcessing],
	)

	// Keyboard event handler
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault()
				event.stopPropagation()
				messageHandlers.executeButtonAction("cancel")
			}
		},
		[messageHandlers],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	if (!task) {
		return null
	}

	const { showScrollToBottom, scrollToBottomSmooth, disableAutoScrollRef } = scrollBehavior

	const { primaryText, secondaryText, primaryAction, secondaryAction, enableButtons } = buttonConfig
	const hasButtons = primaryText || secondaryText
	const isStreaming = task.partial === true
	const canInteract = enableButtons && !isProcessing

	// Early return for scroll button to avoid unnecessary computation
	if (showScrollToBottom || !hasButtons) {
		const handleScrollToBottom = () => {
			scrollToBottomSmooth()
			disableAutoScrollRef.current = false
		}
		// Show scroll to top button when there are no action buttons
		const handleScrollToTop = () => {
			scrollBehavior.virtuosoRef.current?.scrollTo({
				top: 0,
				behavior: "smooth",
			})
			disableAutoScrollRef.current = true
			// Virtual rendering may not have all items rendered when at bottom,
			// so scroll again after a delay to ensure we reach the true top
			setTimeout(() => {
				scrollBehavior.virtuosoRef.current?.scrollTo({
					top: 0,
					behavior: "smooth",
				})
			}, 300)
		}

		return (
			<div className="flex px-3.5">
				<Button
					variant="ghost"
					aria-label={showScrollToBottom ? "Scroll to bottom" : "Scroll to top"}
					className="text-lg w-full h-[25px] flex justify-center items-center rounded-xs bg-muted hover:bg-muted/80"
					onClick={showScrollToBottom ? handleScrollToBottom : handleScrollToTop}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault()
							if (showScrollToBottom) {
								handleScrollToBottom()
							} else {
								handleScrollToTop()
							}
						}
					}}>
					{showScrollToBottom ? (
						<span className="codicon codicon-chevron-down" />
					) : (
						<span className="codicon codicon-chevron-up" />
					)}
				</Button>
			</div>
		)
	}

	const opacity = canInteract || isStreaming ? 1 : 0.5

	return (
		<div className="flex px-3.5 gap-2" style={{ opacity }}>
			{primaryText && primaryAction && (
				<Button
					variant="default"
					className={secondaryText ? "flex-1" : "flex-1 w-full"}
					disabled={!canInteract}
					onClick={() => handleActionClick(primaryAction, inputValue, selectedImages, selectedFiles)}>
					{primaryText}
				</Button>
			)}
			{secondaryText && secondaryAction && (
				<Button
					variant="secondary"
					className={primaryText ? "flex-1" : "flex-1 w-full"}
					disabled={!canInteract}
					onClick={() => handleActionClick(secondaryAction, inputValue, selectedImages, selectedFiles)}>
					{secondaryText}
				</Button>
			)}
		</div>
	)
}
