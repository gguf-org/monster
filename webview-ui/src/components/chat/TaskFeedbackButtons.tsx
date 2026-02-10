import { StringRequest } from "@shared/proto/cline/common"
import { TaskFeedbackType } from "@shared/WebviewMessage"
import { Button } from "@/components/ui/button"
import React, { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { TaskServiceClient } from "@/services/grpc-client"

interface TaskFeedbackButtonsProps {
	messageTs: number
	isFromHistory?: boolean
	classNames?: string
}

const TaskFeedbackButtons: React.FC<TaskFeedbackButtonsProps> = ({ messageTs, isFromHistory = false, classNames }) => {
	const [feedback, setFeedback] = useState<TaskFeedbackType | null>(null)
	const [shouldShow, setShouldShow] = useState<boolean>(true)

	// Check localStorage on mount to see if feedback was already given for this message
	useEffect(() => {
		try {
			const feedbackHistory = localStorage.getItem("taskFeedbackHistory") || "{}"
			const history = JSON.parse(feedbackHistory)
			// Check if this specific message timestamp has received feedback
			if (history[messageTs]) {
				setShouldShow(false)
			}
		} catch (e) {
			console.error("Error checking feedback history:", e)
		}
	}, [messageTs])

	// Don't show buttons if this is from history or feedback was already given
	if (isFromHistory || !shouldShow) {
		return null
	}

	const handleFeedback = async (type: TaskFeedbackType) => {
		if (feedback !== null) {
			return // Already provided feedback
		}

		setFeedback(type)

		try {
			await TaskServiceClient.taskFeedback(
				StringRequest.create({
					value: type,
				}),
			)

			// Store in localStorage that feedback was provided for this message
			try {
				const feedbackHistory = localStorage.getItem("taskFeedbackHistory") || "{}"
				const history = JSON.parse(feedbackHistory)
				history[messageTs] = true
				localStorage.setItem("taskFeedbackHistory", JSON.stringify(history))
			} catch (e) {
				console.error("Error updating feedback history:", e)
			}
		} catch (error) {
			console.error("Error sending task feedback:", error)
		}
	}

	return (
		<div className={cn("flex items-center justify-end shrink-0", classNames)}>
			<div className="flex gap-0 opacity-50 hover:opacity-100">
				<div className="scale-85 origin-center">
					<Button
						variant="ghost"
						size="icon"
						className="rounded-full hover:bg-muted"
						aria-label="This was helpful"
						disabled={feedback !== null}
						onClick={() => handleFeedback("thumbs_up")}
						title="This was helpful">
						<span className="text-muted-foreground">
							<span
								className={`codicon ${feedback === "thumbs_up" ? "codicon-thumbsup-filled" : "codicon-thumbsup"}`}
							/>
						</span>
					</Button>
				</div>
				<div className="scale-85 origin-center">
					<Button
						variant="ghost"
						size="icon"
						className="rounded-full hover:bg-muted"
						aria-label="This wasn't helpful"
						disabled={feedback !== null && feedback !== "thumbs_down"}
						onClick={() => handleFeedback("thumbs_down")}
						title="This wasn't helpful">
						<span className="text-muted-foreground">
							<span
								className={`codicon ${feedback === "thumbs_down" ? "codicon-thumbsdown-filled" : "codicon-thumbsdown"}`}
							/>
						</span>
					</Button>
				</div>
			</div>
		</div>
	)
}

export default TaskFeedbackButtons
