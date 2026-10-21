import * as React from "react"
import { cn } from "@/lib/utils"

export interface MuvxLogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: "horizontal" | "mark" | "stacked" | "text"
  className?: string
}

/**
 * Geometric "M" brand logomark component.
 * Uses `fill="currentColor"` so it seamlessly adapts to light/dark themes,
 * badges, sidebar icons, and button pills.
 */
export function MuvxLogoMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="271 174 1929 989"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      style={{ fillRule: "evenodd", clipRule: "evenodd" }}
      aria-label="Muvx mark"
      {...props}
    >
      <g transform="matrix(1.872823,0,0,1.993223,11090.323828,4774.801141)">
        <g>
          <g transform="matrix(0.90625,0,0,0.813212,-6026.21875,-2970.496583)">
            <rect x="275" y="961" width="192" height="439" />
          </g>
          <g transform="matrix(0.90625,0,0,0.813212,-6026.21875,-2970.496583)">
            <rect x="275" y="961" width="192" height="439" />
          </g>
          <g transform="matrix(0.639539,-0.642089,2.362047,2.352668,-8404.666055,-4632.292428)">
            <path d="M275,1273.807L275,1062.992L467,1115.392L467,1221.822L275,1273.807Z" />
          </g>
          <g transform="matrix(1,0,0,1,-8248,-3240)">
            <path d="M3254.399,1408L3028,1182.5L3028,936.915L3500.963,1408L3254.399,1408Z" />
          </g>
          <g transform="matrix(0.90625,0,0,0.334852,-5810.21875,-2300.792711)">
            <rect x="275" y="961" width="192" height="439" />
          </g>
        </g>
      </g>
    </svg>
  )
}

/**
 * Full official Muvx TMS brand logo.
 * Variants:
 * - "horizontal": Sleek horizontal lockup (mark + "muvx tms")
 * - "mark": Standalone geometric "M" mark
 * - "stacked": Original stacked mark above wordmark
 * - "text": Standalone wordmark
 */
export function MuvxLogo({
  variant = "horizontal",
  className,
  ...props
}: MuvxLogoProps) {
  if (variant === "mark") {
    return <MuvxLogoMark className={className} {...props} />
  }

  if (variant === "stacked") {
    return (
      <img
        src="/brand/logo.svg"
        alt="MuvxTMS"
        className={cn("h-auto w-auto object-contain", className)}
        loading="eager"
      />
    )
  }

  if (variant === "text") {
    return (
      <img
        src="/brand/logo-text.svg"
        alt="MuvxTMS"
        className={cn("h-auto w-auto object-contain", className)}
        loading="eager"
      />
    )
  }

  // Default "horizontal"
  return (
    <img
      src="/brand/logo-horizontal.svg"
      alt="MuvxTMS"
      className={cn("h-8 w-auto object-contain", className)}
      loading="eager"
    />
  )
}

export default MuvxLogo
