import { redirect } from "next/navigation";

// Default route → /today. Middleware redirects to /login if unauthenticated.
export default function RootPage() {
  redirect("/today");
}
