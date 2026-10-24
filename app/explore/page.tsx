import ExploreClient from "@/components/ExploreClient";

export const metadata = {
  title: "Explore — Mapachusetts",
  description:
    "Spin the globe and drill down from the U.S. to your city to see the elections and civic events that affect you.",
};

export default function ExplorePage() {
  return (
    <section className="section explore-section">
      <h2>Explore the Map</h2>
      <p className="section-subtitle">
        Start at the globe, click into the United States, and drill down to your
        state, county, and city to see the races and civic events near you.
      </p>
      <ExploreClient />
    </section>
  );
}
