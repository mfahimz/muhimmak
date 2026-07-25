/**
 * SKELETON LOADING PATTERN FOR NEXT.JS ROUTE SEGMENTS:
 * 
 * To add a loading state for any new route, create a `loading.tsx` file inside that route's 
 * folder. Build the loading interface using this `Skeleton` primitive component to closely 
 * approximate the actual page layout. 
 * 
 * Next.js will automatically render `loading.tsx` within the Suspense boundary of the layout 
 * while the page segment's async server data fetching (or other asynchronous work) is in progress. 
 * No manual wiring, state variables, or useEffect bindings are needed.
 */

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
