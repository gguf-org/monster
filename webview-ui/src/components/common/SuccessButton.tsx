import { Button } from "@/components/ui/button"

interface SuccessButtonTWProps extends React.ComponentProps<typeof Button> {}

const SuccessButtonTW: React.FC<SuccessButtonTWProps> = (props) => {
	return (
		<Button
			variant="default"
			{...props}
			className={`${props.className || ""}`.trim()}
		/>
	)
}

export default SuccessButtonTW
