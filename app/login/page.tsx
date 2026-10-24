import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getUser } from "@/lib/supabase/serverAuth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Send them to the map.
  let user = null;
  try {
    user = await getUser();
  } catch {
    // Supabase env not configured — show the form anyway with a notice.
  }
  if (user) redirect("/map");

  return (
    <section className="section auth-section">
      <h2>Join Mapachusetts</h2>
      <p className="section-subtitle">
        Create a free account to report live civic events — protests, rallies,
        town halls — on the Massachusetts map and keep your community informed.
      </p>
      <AuthForm />
    </section>
  );
}
