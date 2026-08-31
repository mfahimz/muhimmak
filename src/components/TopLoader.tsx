"use client"

import * as React from "react"
import NextTopLoader from "nextjs-toploader"

export function TopLoader() {
  return (
    <NextTopLoader
      color="#4F46E5"
      height={3}
      showSpinner={false}
    />
  )
}
