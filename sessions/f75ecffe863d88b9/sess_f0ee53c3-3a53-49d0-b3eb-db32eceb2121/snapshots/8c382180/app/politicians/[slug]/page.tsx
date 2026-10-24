import { redirect } from "next/navigation";

/** Old /politicians/[slug] links now open the candidate's research profile. */
export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/candidates/${encodeURIComponent(slug)}`);
}
