import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
    React.ElementRef<typeof SliderPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
    const initialValue = Array.isArray(props.value) ? props.value : (Array.isArray(props.defaultValue) ? props.defaultValue : [0]);

    return (
        <SliderPrimitive.Root
            ref={ref}
            className={cn(
                "relative flex w-full touch-none select-none items-center",
                className
            )}
            {...props}
        >
            <SliderPrimitive.Track
                className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
            >
                <SliderPrimitive.Range className="absolute h-full bg-blue-600 dark:bg-blue-500" />
            </SliderPrimitive.Track>
            {initialValue.map((_, index) => (
                <SliderPrimitive.Thumb
                    key={index}
                    className="block h-5 w-5 rounded-full border-2 border-blue-600 bg-white ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-blue-500 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                />
            ))}
        </SliderPrimitive.Root>
    )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
