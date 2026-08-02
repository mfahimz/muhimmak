import { redirect } from "next/navigation"

export default function PendingClosuresPage() {
  redirect("/dashboard/sessions?tab=open-visits")
}

