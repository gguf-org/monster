import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer [&_svg]:size-2 overflow-hidden transition-all duration-200 active:scale-95",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow hover:scale-[1.02] active:scale-95",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:scale-[1.02] active:scale-95",
				error: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:scale-[1.02] active:scale-95",
				outline:
					"border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-95",
				"outline-primary":
					"border border-primary text-primary bg-background shadow-sm hover:bg-primary hover:text-primary-foreground hover:scale-[1.02] active:scale-95",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
				text: "text-foreground hover:bg-accent hover:text-accent-foreground",
				icon: "hover:bg-accent hover:text-accent-foreground border-0",
				cline: "bg-primary text-primary-foreground hover:bg-primary/90 shadow hover:scale-[1.02] active:scale-95",
				success:
					"bg-primary text-primary-foreground hover:bg-primary/90 shadow hover:scale-[1.02] active:scale-95",
				danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:scale-[1.02] active:scale-95",
			},
			size: {
				default: "py-1.5 px-4 [&_svg]:size-3",
				sm: "py-1 px-3 text-sm [&_svg]:size-2",
				xs: "p-1 text-xs [&_svg]:size-2",
				lg: "py-4 px-8 [&_svg]:size-4 font-medium",
				icon: "px-0.5 m-0 [&_svg]:size-2",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

// The variants name of buttonVariants
export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button"
		return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
	},
)
Button.displayName = "Button"

export { Button, buttonVariants }
