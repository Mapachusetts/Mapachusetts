import { redirect } from "next/navigation";

/**
 * Candidate profiles now live in the research UI on the home page.
 * Keep old /politicians/[slug] links working by sending them there.
 */
export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/?candidate=${encodeURIComponent(slug)}#research`);
}
