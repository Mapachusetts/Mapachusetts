import { redirect } from "next/navigation";

// The globe moved to the home page hero. Keep this path working by redirecting.
export default function ExplorePage() {
  redirect("/#home");
}
