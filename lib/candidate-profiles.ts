import type { CandidateProfile } from "@/lib/types";

/**
 * Hand-curated candidate research profiles (from the candidate-search branch).
 * Each profile is keyed by `slug`, matching `politicians.slug` in Supabase;
 * lib/candidates.ts merges the two. Profiles without a Supabase row still appear.
 *
 * Sub-issue shape:
 *   id, label
 *   plainEnglish   — 1-2 sentence accessible summary for any reader
 *   whyItMatters   — why people are searching/talking about this RIGHT NOW
 *   alignment      — 0–100 score of candidate's support level
 *                    0–20  = Strongly opposed
 *                    21–40 = Leans against
 *                    41–59 = Mixed / no clear position
 *                    60–79 = Leans in favor
 *                    80–100= Strongly supports
 *   stance         — short policy summary
 *   detail         — full policy detail for informed readers
 *   voteRecord[]   — { bill, year, vote }
 *
 * Live data sources to wire up:
 *   OpenSecrets API — https://www.opensecrets.org/open-data/api-documentation
 *   ProPublica API  — https://projects.propublica.org/api-docs/congress-api/
 *   Ballotpedia     — career + biography
 */

export const CANDIDATE_PROFILES: CandidateProfile[] = [

  /* ════════════════════════════════════════════
     ELIZABETH WARREN
  ════════════════════════════════════════════ */
  {
    slug: "elizabeth-warren",
    name: "Elizabeth Warren",
    role: "U.S. Senator, Massachusetts",
    party: "Democrat",
    photo: "https://bioguide.congress.gov/bioguide/photo/W/W000817.jpg",
    openSecretsUrl: "https://www.opensecrets.org/members-of-congress/elizabeth-warren/summary?cid=N00033492",

    /* ── CURRENT STATUS ──────────────────────── */
    status: {
      currentTitle: "U.S. Senator",
      state: "Massachusetts",
      statusType: "incumbent",          // "incumbent" | "running" | "former"
      statusLabel: "Currently serving", // shown as a badge
      termInfo: "Serving since 2013. Up for re-election in 2026.",
      nextElection: "2026",
      runningFor: null,                 // null if not in active race
      committees: [
        "Senate Banking, Housing & Urban Affairs",
        "Senate Finance",
        "Senate Armed Services",
        "Special Committee on Aging",
      ],
      plainEnglish: "Warren is a sitting U.S. Senator — she was elected in 2012 and re-elected in 2018. Her current term runs until January 2025, and she is up for re-election in 2026. As a senator she votes on every federal law, from healthcare to the defense budget.",
    },

    /* ── FUNDING ─────────────────────────────── */
    funding: {
      total: "$23,400,000",
      topIndustry: "Lawyers / Law Firms",
      smallDonorPct: "67%",
      plainEnglish: "Most of Warren's campaign money — about 67 cents of every dollar — comes from small donors like you. That's above average for senators. Her biggest industry donors are lawyers and educators. She receives very little from oil companies or defense contractors, which is unusual for someone in Washington.",
      whyItMatters: "People are asking: if a senator takes big checks from an industry, will they still vote against that industry? Warren's high small-donor rate is often cited as evidence she's less beholden to corporate interests.",
      sources: [
        { label: "Lawyers / Law Firms",  amount: 4200000, pct: 18 },
        { label: "Education",            amount: 2800000, pct: 12 },
        { label: "Health Professionals", amount: 2300000, pct: 10 },
        { label: "Retired",              amount: 1900000, pct: 8  },
        { label: "Real Estate",          amount: 1400000, pct: 6  },
      ],
      foreignSources: [
        { label: "Defense / Aerospace PACs",  amount: 120000, pct: 0.5 },
        { label: "Oil & Gas Interests",       amount: 80000,  pct: 0.3 },
        { label: "Foreign-Linked Trade PACs", amount: 45000,  pct: 0.2 },
      ],
    },

    /* ── CAREER ──────────────────────────────── */
    career: [
      {
        years: "2013–present",
        title: "U.S. Senator",
        org: "Massachusetts",
        description: "Serves on the Senate Banking and Finance Committees. Best known for creating the Consumer Financial Protection Bureau — a watchdog agency that has returned over $17 billion to consumers cheated by banks and payday lenders.",
      },
      {
        years: "2010–2011",
        title: "Chair, TARP Oversight Panel",
        org: "U.S. Congress",
        description: "Appointed to watch over the $700 billion the government gave to banks during the 2008 financial crash — her job was making sure the money wasn't wasted or stolen.",
      },
      {
        years: "1995–2012",
        title: "Law Professor",
        org: "Harvard Law School",
        description: "Taught bankruptcy law for 17 years. Wrote 'The Two-Income Trap,' a bestselling book about why middle-class families go broke even when both parents work.",
      },
      {
        years: "1987–1995",
        title: "Law Professor",
        org: "University of Pennsylvania",
        description: "Built her career researching why ordinary Americans end up in financial ruin — the research that would eventually shape her political platform.",
      },
    ],

    /* ── OPINIONS ────────────────────────────── */
    opinions: [

      /* ── HEALTHCARE ─────────────────── */
      {
        id: "healthcare",
        topic: "Healthcare",
        icon: "🏥",
        subIssues: [
          {
            id: "abortion",
            label: "Abortion & Reproductive Rights",
            plainEnglish: "Warren believes the government should not be able to restrict a person's decision about abortion. She wants that protection written into federal law, so it can't be taken away by any state.",
            whyItMatters: "After the Supreme Court overturned Roe v. Wade in 2022, abortion access has become one of the most-searched political topics in America. Millions of people want to know: does my senator support restoring those rights at the federal level?",
            alignment: 95,
            stance: "Strongly pro-choice. Supports federal codification of abortion rights.",
            detail: "Co-sponsored the Women's Health Protection Act, which would create a federal statutory right to abortion. Has called the Dobbs ruling a 'political and economic crisis.' Opposes gestational limits imposed at the federal level and supports full Planned Parenthood funding.",
            voteRecord: [
              { bill: "Women's Health Protection Act", year: 2022, vote: "Yes" },
              { bill: "No Taxpayer Funding for Abortion Act", year: 2021, vote: "No" },
            ],
          },
          {
            id: "health-system",
            label: "Public vs. Private Health System",
            plainEnglish: "Warren wants a single public health insurance plan for every American — paid through taxes — so nobody loses coverage when they lose a job, and nobody goes bankrupt from a hospital bill.",
            whyItMatters: "Medical debt is the #1 cause of personal bankruptcy in the U.S. Over 25 million Americans are still uninsured. People are actively searching whether their representative supports keeping the current private insurance system or switching to something like Canada or Europe has.",
            alignment: 90,
            stance: "Supports Medicare for All — a universal single-payer public system.",
            detail: "Co-sponsored the Medicare for All Act. Argues the private insurance model wastes hundreds of billions on administrative overhead and still leaves millions without care. Supports a full transition to a public system, phasing out employer-sponsored insurance.",
            voteRecord: [
              { bill: "Medicare for All Act", year: 2022, vote: "Co-sponsor" },
              { bill: "Affordable Care Act preservation", year: 2017, vote: "Yes" },
            ],
          },
          {
            id: "mental-health",
            label: "Mental Health & Substance Abuse",
            plainEnglish: "Warren supports making therapy and addiction treatment as easy to access as seeing a regular doctor — and requiring insurance to pay for it the same way it pays for a broken bone.",
            whyItMatters: "Teen mental health crisis, the opioid epidemic, and the post-COVID anxiety wave have pushed mental health to the top of what families are searching. People want to know if their elected officials are treating this as seriously as physical illness.",
            alignment: 85,
            stance: "Supports expanded federal funding and insurance parity for mental health and addiction care.",
            detail: "Backed the Mental Health Reform Act and increased opioid crisis funding. Advocates for insurance parity enforcement — insurance must cover mental health visits the same as any other medical visit. Supports community mental health centers as alternatives to emergency rooms.",
            voteRecord: [
              { bill: "Mental Health Reform Act", year: 2023, vote: "Yes" },
              { bill: "SUPPORT Act (opioid response)", year: 2018, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── HOUSING ────────────────────── */
      {
        id: "housing",
        topic: "Housing & Zoning",
        icon: "🏠",
        subIssues: [
          {
            id: "affordable-housing",
            label: "Affordable Housing Supply",
            plainEnglish: "Warren authored a $500 billion plan to build 3.2 million new homes that people with lower and middle incomes can actually afford to rent or buy. It's one of the most ambitious housing proposals ever introduced in the Senate.",
            whyItMatters: "Rent is up 30%+ in many U.S. cities since 2020. First-time buyers are locked out of the market. 'Affordable housing' is one of the top-searched political terms in Massachusetts right now — people want to know if their senator is doing something real about it.",
            alignment: 92,
            stance: "Supports large-scale federal investment to build affordable housing nationwide.",
            detail: "Authored the American Housing and Economic Mobility Act — a $500B, 10-year plan to build 3.2 million new housing units. Supports expanding the Low-Income Housing Tax Credit (LIHTC) and direct grants to municipalities for affordable construction.",
            voteRecord: [
              { bill: "American Housing and Economic Mobility Act", year: 2023, vote: "Sponsored" },
              { bill: "Build Back Better (housing provisions)", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "zoning-reform",
            label: "Zoning Reform & Density",
            plainEnglish: "Many cities only allow single-family homes in most neighborhoods, which keeps housing scarce and expensive. Warren wants the federal government to push cities to allow apartments, duplexes, and smaller homes in more areas — especially near jobs and transit.",
            whyItMatters: "Zoning is now mainstream news. Cities like Boston and Cambridge are hotly debating whether to allow more housing density. People searching 'why is rent so high' are landing on zoning as a key answer.",
            alignment: 80,
            stance: "Supports federal incentives to eliminate exclusionary single-family zoning.",
            detail: "Advocates for federal pressure on localities to allow higher-density development, mixed-use buildings, and accessory dwelling units (ADUs). Argues restrictive zoning is a root structural cause of the affordability crisis in cities like Boston.",
            voteRecord: [
              { bill: "Yes In My Backyard (YIMBY) Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "tenant-protections",
            label: "Tenant Protections & Eviction",
            plainEnglish: "When someone is being evicted, the landlord usually has a lawyer — the tenant usually doesn't. Warren wants renters to have guaranteed legal help in eviction court, plus stronger federal rules against predatory landlords.",
            whyItMatters: "Eviction filings are back above pre-pandemic levels in many cities. Corporate landlords buying up single-family homes is a top-searched issue. People want to know who's protecting renters.",
            alignment: 88,
            stance: "Supports right-to-counsel for tenants and stronger federal renter protections.",
            detail: "Backed emergency rental assistance programs during COVID. Supports a national right-to-counsel ensuring low-income renters have legal representation in eviction proceedings. Opposes federal housing funding in jurisdictions without adequate tenant protections.",
            voteRecord: [
              { bill: "Emergency Rental Assistance Act", year: 2021, vote: "Yes" },
              { bill: "Right to Counsel for Renters Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "homelessness",
            label: "Homelessness",
            plainEnglish: "Warren backs 'Housing First' — giving someone a stable home before trying to fix everything else in their life like addiction or unemployment. Research consistently shows this approach works better than shelter-first models.",
            whyItMatters: "Tent cities and visible homelessness in Boston, Cambridge, and Springfield are top local news. Residents and commuters are searching what politicians plan to actually do — not just sweep encampments.",
            alignment: 85,
            stance: "Supports Housing First model and increased HUD funding.",
            detail: "Advocates for permanent supportive housing before addressing other needs. Supports expanding Section 8 housing vouchers and dedicated funding streams for chronically homeless individuals.",
            voteRecord: [
              { bill: "Ending Homelessness Act", year: 2020, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── IMMIGRATION ─────────────────── */
      {
        id: "immigration",
        topic: "Immigration",
        icon: "🌍",
        subIssues: [
          {
            id: "daca-citizenship",
            label: "DACA & Pathway to Citizenship",
            plainEnglish: "DACA 'Dreamers' are people brought to the U.S. as children who've grown up here, gone to school here, and in many cases only know America as home. Warren wants them — and millions of others — to have a legal, permanent path to stay.",
            whyItMatters: "Over 500,000 DACA recipients face ongoing legal uncertainty. With multiple court rulings threatening the program, 'DACA Supreme Court' and 'Dreamers citizenship' are consistently trending searches. People want to know where their senator stands.",
            alignment: 90,
            stance: "Supports permanent pathway to citizenship for DACA recipients and undocumented immigrants.",
            detail: "Co-sponsored the American Dream and Promise Act, which would grant permanent legal status to DACA recipients. Supports a broader citizenship pathway for the ~11 million undocumented people living in the U.S. Opposes mass deportation policies.",
            voteRecord: [
              { bill: "American Dream and Promise Act", year: 2021, vote: "Yes" },
              { bill: "U.S. Citizenship Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "border-security",
            label: "Border Security & Asylum",
            plainEnglish: "Asylum is the legal right to ask a country for protection if you're fleeing violence or persecution at home. Warren believes that right should be protected — not restricted — and that families should never be separated at the border.",
            whyItMatters: "Border crossings, migrant shelters in Massachusetts cities, and Title 42 debates are dominating local and national news. People on all sides are actively searching what the difference between 'illegal immigration' and 'asylum' actually means.",
            alignment: 72,
            stance: "Supports humane asylum processing. Opposes border militarization and family separation.",
            detail: "Voted against the 2024 border security supplemental that critics argued would restrict asylum rights. Supports expanding immigration courts to clear the backlog. Opposes family detention and separation.",
            voteRecord: [
              { bill: "Border Security Supplemental", year: 2024, vote: "No" },
              { bill: "Family Separation Prevention Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "worker-visas",
            label: "Work Visas & Labor Immigration",
            plainEnglish: "Warren supports making it easier for people to come to the U.S. legally to work — especially in farming, healthcare, and tech — while making sure they're protected from employers who exploit them because of their status.",
            whyItMatters: "Massachusetts hospitals are short on nurses. Farms can't find workers. Tech companies are fighting visa backlogs. People are searching 'why is it so hard to immigrate legally' — and want to know if their senator is trying to fix the actual system.",
            alignment: 78,
            stance: "Supports expanding legal work visas with strong labor protections.",
            detail: "Advocates for increasing H-2A agricultural worker visas and creating new categories for essential workers. Supports removing per-country green card caps that create decade-long backlogs for workers from India and China.",
            voteRecord: [
              { bill: "Essential Workers for America Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "refugee-policy",
            label: "Refugee Admissions",
            plainEnglish: "Refugees are people fleeing wars, genocide, or persecution who go through a years-long vetting process to come to the U.S. legally. Warren wants the U.S. to accept more of them and make the process more humane.",
            whyItMatters: "The wars in Ukraine, Gaza, and Sudan have made refugee policy front-page news. Massachusetts has historically been a resettlement state. People are searching 'where do refugees go' and 'is America still accepting refugees.'",
            alignment: 85,
            stance: "Supports restoring and expanding U.S. refugee admission caps.",
            detail: "Opposed the Trump-era reduction of refugee admissions to historic lows. Supported returning caps to 125,000 per year. Backed Afghan refugee resettlement after the 2021 withdrawal. Supports TPS extensions for Haitians and Venezuelans.",
            voteRecord: [
              { bill: "Afghan Adjustment Act", year: 2022, vote: "Yes" },
              { bill: "TPS Extension Resolution", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── EDUCATION ───────────────────── */
      {
        id: "education",
        topic: "Education & School Infrastructure",
        icon: "🏫",
        subIssues: [
          {
            id: "k12-funding",
            label: "K-12 Funding & Equity",
            plainEnglish: "Schools in wealthy neighborhoods get more money because they're funded by local property taxes. A kid in a rich suburb gets a better-funded classroom than a kid a few towns over. Warren wants to close that gap with federal dollars.",
            whyItMatters: "Parents are searching 'why do some schools get more money' and 'school funding inequality' more than ever. MCAS debates, teacher strikes, and crumbling school buildings in Gateway Cities are all live issues in Massachusetts right now.",
            alignment: 88,
            stance: "Supports federal Title I expansion to close funding gaps between wealthy and low-income districts.",
            detail: "Backed the American Rescue Plan's $130B for K-12 schools. Supports overhauling school funding to reduce reliance on property taxes. Advocates for universal free school meals and mental health counselors in every public school.",
            voteRecord: [
              { bill: "American Rescue Plan (education)", year: 2021, vote: "Yes" },
              { bill: "Universal School Meals Program Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "student-debt",
            label: "Student Loan Debt & Higher Ed",
            plainEnglish: "Warren wants to cancel up to $50,000 in student loan debt for tens of millions of borrowers and make community college free — arguing that debt is holding an entire generation back from buying homes, starting families, and building wealth.",
            whyItMatters: "Student loan payments resumed in 2023 after a 3-year pause. Over 43 million Americans have federal student debt. 'Student loan forgiveness' is one of the most-searched political topics in the country right now.",
            alignment: 92,
            stance: "Supports broad student debt cancellation and free public college.",
            detail: "Authored a plan to cancel up to $50,000 in debt for borrowers earning under $100,000/year — affecting ~42 million people. Supports tuition-free community college and expanded Pell Grants. Backs stronger oversight of for-profit colleges.",
            voteRecord: [
              { bill: "Student Loan Debt Relief Plan", year: 2022, vote: "Supported" },
              { bill: "Free College Now Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "school-safety",
            label: "School Safety & Infrastructure",
            plainEnglish: "Many Massachusetts school buildings are 50+ years old — with broken heating, lead pipes, and poor ventilation. Warren wants federal money to fix them, and believes mental health support is more effective at keeping kids safe than security cameras alone.",
            whyItMatters: "After every school shooting, parents search what their representatives are doing. Separately, post-COVID school building air quality became a major parent concern. Both are driving searches about school safety and infrastructure right now.",
            alignment: 82,
            stance: "Supports federal investment in aging school buildings and mental health infrastructure.",
            detail: "Backed the Rebuild America's Schools Act for facility repairs. Supports mental health infrastructure as a safety measure. Advocates for lead pipe removal from school water systems.",
            voteRecord: [
              { bill: "Rebuild America's Schools Act", year: 2022, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── FOREIGN POLICY ──────────────── */
      {
        id: "foreign-policy",
        topic: "Foreign Policy & Trade",
        icon: "🌐",
        subIssues: [
          {
            id: "wars-military",
            label: "Military Intervention & Wars",
            plainEnglish: "Warren supported sending military aid to Ukraine, but questions whether Congress has been giving the Pentagon too much money without oversight. She believes it should be harder — not easier — for the U.S. to sell weapons to countries that abuse human rights.",
            whyItMatters: "The wars in Ukraine and Gaza are the biggest foreign policy conversations happening right now. People are searching 'how much money is the U.S. sending to Ukraine,' 'what is the U.S. doing in Gaza,' and whether their senators are hawks or doves.",
            alignment: 55,
            stance: "Skeptical of unchecked military spending. Supports diplomatic-first approaches.",
            detail: "Voted for Ukraine security assistance packages. Critical of open-ended military authorizations and supports repealing outdated AUMFs. Opposed arms sales to Saudi Arabia for its Yemen campaign. Advocates for stronger congressional war powers.",
            voteRecord: [
              { bill: "Ukraine Security Assistance Initiative", year: 2023, vote: "Yes" },
              { bill: "AUMF Repeal (Iraq 2002)", year: 2021, vote: "Yes" },
              { bill: "Saudi Arms Sale Block Resolution", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "trade-tariffs",
            label: "Trade Policy & Tariffs",
            plainEnglish: "A tariff is a tax on products imported from another country — it makes foreign goods more expensive, which can protect American factory jobs but also raises prices at the store. Warren supports targeted tariffs on China but warns broad tariffs hurt everyday shoppers.",
            whyItMatters: "Trade wars with China, 'Made in America' debates, and inflation from supply chain issues have made tariffs a kitchen-table topic. People are searching 'what is a tariff' and 'why are prices so high' — and connecting both to trade policy.",
            alignment: 65,
            stance: "Supports targeted tariffs to protect workers. Skeptical of broad trade deals.",
            detail: "Supports tariffs on Chinese steel, EVs, and semiconductors to rebuild U.S. manufacturing. Concerned about blanket tariffs that raise consumer prices. Opposed the original TPP citing worker protection gaps.",
            voteRecord: [
              { bill: "Uyghur Forced Labor Prevention Act", year: 2021, vote: "Yes" },
              { bill: "National Defense Authorization Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "foreign-aid",
            label: "Foreign Aid & Diplomacy",
            plainEnglish: "The U.S. gives money and resources to other countries for humanitarian purposes, military alliances, and diplomacy. Warren supports that — but wants it tied to human rights conditions, so the U.S. isn't funding governments that oppress their own people.",
            whyItMatters: "Foreign aid debates exploded in 2024 with Ukraine and Israel funding bills. People are searching 'how much foreign aid does the U.S. give' and 'why are we sending money overseas' — and wanting their representatives to explain the tradeoffs.",
            alignment: 70,
            stance: "Supports foreign aid tied to human rights accountability.",
            detail: "Advocates for maintaining foreign aid while adding accountability conditions. Pushed back on State Department and USAID cuts. Supports diplomatic engagement over isolationism. Backed aid for climate-vulnerable nations.",
            voteRecord: [
              { bill: "State and Foreign Ops Appropriations", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── PUBLIC SAFETY ───────────────── */
      /* ── PUBLIC INFRASTRUCTURE ───────────── */
      {
        id: "infrastructure",
        topic: "Public Infrastructure",
        icon: "🚇",
        subIssues: [
          {
            id: "public-transit",
            label: "Public Transportation",
            plainEnglish: "Warren supports major federal investment in buses, subways, commuter rail, and passenger trains — particularly for cities like Boston where the MBTA serves hundreds of thousands of people daily. She believes reliable transit is an economic issue, not just a convenience.",
            whyItMatters: "The MBTA has faced years of delays, derailments, and service cuts that directly affect how Massachusetts residents get to work, school, and healthcare. 'MBTA fix' and 'Green Line Extension' have been top local searches. People want to know if federal representatives are fighting for transit funding.",
            alignment: 88,
            stance: "Strongly supports federal funding for public transit modernization and expansion.",
            detail: "Backed the Infrastructure Investment and Jobs Act (2021), which included $39 billion for public transit — the largest federal transit investment in history. Specifically supported MBTA funding and commuter rail upgrades in Massachusetts. Advocates for expanding Amtrak service on the Northeast Corridor and creating reliable intercity rail as a climate-friendly alternative to flying.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act", year: 2021, vote: "Yes" },
              { bill: "Amtrak Improvement Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "roads-bridges",
            label: "Roads, Bridges & Highway Safety",
            plainEnglish: "Massachusetts has thousands of structurally deficient bridges and roads rated in poor condition. Warren backed the bipartisan infrastructure law that sent billions to states for repairs — money that directly funds Massachusetts road projects.",
            whyItMatters: "Potholes, bridge closures, and construction delays are everyday frustrations. After bridge collapses in other states made national news, people started searching 'how many bridges in Massachusetts are unsafe' and what their representatives are doing about it.",
            alignment: 80,
            stance: "Supports federal highway and bridge repair funding through the bipartisan infrastructure law.",
            detail: "Voted for the Infrastructure Investment and Jobs Act, which allocated $110 billion for roads and bridges nationwide. Massachusetts received over $1.2 billion in formula highway funding in the first year. Supports complete streets policies that make roads safer for pedestrians and cyclists alongside drivers.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "broadband",
            label: "Broadband & Internet Access",
            plainEnglish: "Millions of Americans — including people in rural Massachusetts and low-income urban neighborhoods — still don't have reliable high-speed internet at home. Warren backed a $65 billion federal program to connect everyone, and wants to keep internet prices affordable once they're connected.",
            whyItMatters: "After COVID exposed that students without home internet fell behind, broadband access became a defining equity issue. People are searching 'free internet programs Massachusetts' and 'why is my internet so expensive' — and connecting both to what Congress is funding.",
            alignment: 88,
            stance: "Supports universal broadband deployment and affordable pricing rules.",
            detail: "Backed the $65 billion broadband provisions of the Infrastructure Investment and Jobs Act. Supports the Affordable Connectivity Program (ACP), which provided $30/month internet subsidies to low-income households. Advocates for municipal broadband options and stronger FCC oversight of ISP pricing practices.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act (broadband)", year: 2021, vote: "Yes" },
              { bill: "Affordable Connectivity Program Extension Act", year: 2024, vote: "Yes" },
            ],
          },
          {
            id: "water-systems",
            label: "Water & Sewer Infrastructure",
            plainEnglish: "Thousands of Massachusetts homes — disproportionately in older cities like Lynn, Chelsea, and Springfield — still receive water through lead pipes. Warren backed federal money to replace them, arguing clean water is a basic right, not a luxury.",
            whyItMatters: "The Flint, Michigan water crisis brought lead pipes into national consciousness. Massachusetts has its own aging water systems. Parents are searching 'lead pipes in my city' and 'how do I know if my water is safe' — and looking for who in Congress secured the funding to fix it.",
            alignment: 85,
            stance: "Supports federal investment in lead pipe removal and water system upgrades.",
            detail: "The Infrastructure Investment and Jobs Act included $55 billion for water and wastewater systems — the largest federal water investment in U.S. history. Warren voted yes. Specifically backed provisions to replace all lead service lines within 10 years. Massachusetts received hundreds of millions for drinking water and clean water state revolving funds.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act (water)", year: 2021, vote: "Yes" },
              { bill: "Water Infrastructure Finance Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "airports-ports",
            label: "Airports & Ports",
            plainEnglish: "Logan Airport and the Port of Boston are economic engines for Massachusetts. Warren supported federal grants to modernize airport terminals and freight infrastructure — which affects both passenger travel and the price of goods that come through Boston Harbor.",
            whyItMatters: "Post-COVID flight chaos, supply chain disruptions, and rising shipping costs have put airports and ports in the news. People are searching 'why are flights so delayed' and 'what caused the supply chain crisis' — both trace back in part to underfunded port and air infrastructure.",
            alignment: 74,
            stance: "Supports federal airport modernization grants and port infrastructure investment.",
            detail: "The Infrastructure Investment and Jobs Act included $25 billion for airports and $17 billion for ports and waterways. Warren supported this funding. Specifically backed FAA reauthorization provisions that address runway safety and terminal upgrades. Supports investments in zero-emission ground vehicles at airports and electrification of port equipment.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act (airports/ports)", year: 2021, vote: "Yes" },
              { bill: "FAA Reauthorization Act", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

      {
        id: "public-safety",
        topic: "Public Safety",
        icon: "🛡️",
        subIssues: [
          {
            id: "gun-control",
            label: "Gun Control",
            plainEnglish: "Warren wants background checks for every gun sale — including at gun shows and online — a ban on military-style rifles for civilians, and 'red flag' laws that let a court temporarily take guns from someone who's been flagged as dangerous.",
            whyItMatters: "Mass shootings consistently spike gun-related searches. After every incident, people search their senators' voting records on gun legislation. 'Red flag laws,' 'AR-15 ban,' and 'gun background checks' are perpetually trending after high-profile shootings.",
            alignment: 90,
            stance: "Supports universal background checks, assault weapons ban, and red flag laws.",
            detail: "Backed the Bipartisan Safer Communities Act (2022). Supports banning AR-style assault weapons and high-capacity magazines. Advocates for closing the gun show loophole. Supports federal red flag laws allowing courts to temporarily remove firearms from dangerous individuals.",
            voteRecord: [
              { bill: "Bipartisan Safer Communities Act", year: 2022, vote: "Yes" },
              { bill: "Background Check Expansion Act", year: 2021, vote: "Yes" },
              { bill: "Federal Assault Weapons Ban", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "policing-reform",
            label: "Policing & Criminal Justice Reform",
            plainEnglish: "Warren backed major police accountability legislation. She believes that for many crisis calls — someone having a mental health episode, or a neighbor dispute — sending a trained mental health professional instead of an armed officer makes communities safer.",
            whyItMatters: "Police accountability and criminal justice reform remain heavily searched topics. People are looking up body camera legislation, qualified immunity (which makes it hard to sue police), and what their senators actually voted for — not just what they say.",
            alignment: 82,
            stance: "Supports police accountability legislation and community-based crisis response.",
            detail: "Backed the George Floyd Justice in Policing Act. Advocates for ending qualified immunity, mandating body cameras, and banning chokeholds. Supports redirecting some law enforcement funding toward mental health crisis teams and violence intervention programs.",
            voteRecord: [
              { bill: "George Floyd Justice in Policing Act", year: 2021, vote: "Yes" },
              { bill: "EQUAL Act (drug sentencing reform)", year: 2021, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── ECONOMY & WORKERS ───────────── */
      {
        id: "economy",
        topic: "Economy & Workers",
        icon: "💼",
        subIssues: [
          {
            id: "minimum-wage",
            label: "Minimum Wage",
            plainEnglish: "Warren supports raising the federal minimum wage to $15/hour — arguing that working full time should be enough to cover rent and basic expenses. Massachusetts already has a higher state minimum, but millions of workers in other states still earn the federal floor of $7.25.",
            whyItMatters: "The federal minimum wage hasn't been raised since 2009. 'Minimum wage Massachusetts' and 'living wage calculator' are consistently searched by workers trying to understand if what they earn is enough to get by in cities like Boston.",
            alignment: 92,
            stance: "Strongly supports raising the federal minimum wage to $15/hour.",
            detail: "Co-sponsored the Raise the Wage Act, which would gradually raise the federal minimum wage from $7.25 to $15/hour. Argues the current minimum wage has lost significant purchasing power due to inflation. Supports indexing the minimum wage to inflation so it automatically keeps pace with rising costs.",
            voteRecord: [
              { bill: "Raise the Wage Act", year: 2021, vote: "Yes" },
              { bill: "Minimum Wage Fairness Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "workers-rights",
            label: "Union Rights & Collective Bargaining",
            plainEnglish: "Unions are organizations workers form to negotiate together for better pay and conditions. Warren strongly supports the legal right to unionize — and backed legislation that would make it easier for workers at companies like Amazon and Starbucks to form unions.",
            whyItMatters: "The wave of union drives at Amazon warehouses, Starbucks locations, and hospitals — including several in Massachusetts — has made labor rights front-page news. People are searching 'how do I start a union at work' and 'can my employer fire me for unionizing.'",
            alignment: 90,
            stance: "Strongly supports union rights and the PRO Act to strengthen collective bargaining.",
            detail: "Backed the Protecting the Right to Organize (PRO) Act, the most significant pro-union federal legislation in decades. Supports banning mandatory anti-union meetings by employers. Advocates for sectoral bargaining that would allow unions to negotiate industry-wide standards rather than just company by company.",
            voteRecord: [
              { bill: "PRO Act (Protecting the Right to Organize)", year: 2021, vote: "Yes" },
              { bill: "Public Service Freedom to Negotiate Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "gig-economy",
            label: "Gig Workers & Job Classification",
            plainEnglish: "Gig workers — Uber drivers, DoorDash couriers, TaskRabbit contractors — are classified as 'independent contractors' rather than employees, which means they don't get benefits like health insurance, overtime pay, or unemployment. Warren wants federal rules to reclassify many of them as employees.",
            whyItMatters: "Massachusetts has been a battleground for gig worker classification laws. Millions of Americans depend on gig work as a primary income. People are searching 'am I an employee or contractor' and 'do gig workers get benefits' — and state courts keep changing the answer.",
            alignment: 82,
            stance: "Supports stronger federal standards to classify gig workers as employees when appropriate.",
            detail: "Backs enforcing the ABC test for worker classification — which presumes workers are employees unless proven otherwise. Supports extending labor protections to gig workers including overtime, unemployment insurance, and the right to organize. Has pushed back on tech companies lobbying to exempt their platforms from worker protection laws.",
            voteRecord: [
              { bill: "Worker Organizing and Protection Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "inflation-cost-of-living",
            label: "Inflation & Cost of Living",
            plainEnglish: "Inflation hit a 40-year high in 2022, making groceries, gas, and rent dramatically more expensive. Warren argues that corporate price-gouging — companies raising prices beyond their actual costs — made inflation worse, and supports antitrust action and windfall profit taxes to address it.",
            whyItMatters: "'Why is everything so expensive' was the most-searched economic question of 2022–2024. Grocery prices, rent, and gas costs are still elevated. People want to know if their senator blames corporations, supply chains, or government spending — and what they're doing about it.",
            alignment: 78,
            stance: "Supports tackling corporate price-gouging and windfall profits alongside inflation.",
            detail: "Introduced the Price Gouging Prevention Act, which would allow the FTC to investigate and penalize corporations that raise prices excessively during emergencies. Argues the Inflation Reduction Act's prescription drug price negotiation was a direct win against pharmaceutical price gouging. Supports antitrust enforcement as a tool to restore market competition and lower prices.",
            voteRecord: [
              { bill: "Inflation Reduction Act", year: 2022, vote: "Yes" },
              { bill: "Price Gouging Prevention Act", year: 2022, vote: "Sponsored" },
            ],
          },
          {
            id: "small-business",
            label: "Small Business Support",
            plainEnglish: "Warren supports easier access to small business loans, stronger antitrust enforcement to prevent giant corporations from crushing local competitors, and protections for small businesses from predatory practices by platforms like Amazon.",
            whyItMatters: "Small businesses make up the backbone of Massachusetts's economy — from restaurants in Worcester to boutiques on Newbury Street. After COVID shutdowns and supply chain struggles, small business owners are searching for relief, fair lending, and protection from corporate consolidation.",
            alignment: 80,
            stance: "Supports small business access to capital and antitrust protection from big corporate competition.",
            detail: "Backed the Small Business Administration COVID relief programs. Supports the American Innovation and Choice Online Act, which would prevent dominant platforms like Amazon from favoring their own products over small-business sellers. Advocates for expanding the Community Reinvestment Act to ensure local banks serve small businesses.",
            voteRecord: [
              { bill: "American Rescue Plan (small business provisions)", year: 2021, vote: "Yes" },
              { bill: "American Innovation and Choice Online Act", year: 2022, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── ENVIRONMENT & CLIMATE ───────── */
      {
        id: "environment",
        topic: "Environment & Climate",
        icon: "🌱",
        subIssues: [
          {
            id: "climate-emissions",
            label: "Climate Change & Emissions",
            plainEnglish: "Warren believes climate change is a real and urgent threat driven by human activity — specifically burning fossil fuels. She backed major legislation that invested $369 billion in clean energy and emissions reduction, the largest climate investment in U.S. history.",
            whyItMatters: "Extreme heat waves, wildfires, flooding, and rising sea levels on the Massachusetts coast are becoming more frequent and more severe. People are searching 'climate change Massachusetts coast' and 'sea level rise Boston' — and looking for who is actually legislating on it.",
            alignment: 93,
            stance: "Strongly supports aggressive emissions reduction targets and clean energy investment.",
            detail: "Voted for the Inflation Reduction Act (2022), which includes $369 billion in climate and clean energy investments — the single largest climate action in U.S. history. Supports rejoining and strengthening Paris Agreement commitments. Backs net-zero emissions by 2050 with interim 2030 targets. Has specifically pushed for Environmental Justice provisions ensuring frontline communities benefit from clean energy transition.",
            voteRecord: [
              { bill: "Inflation Reduction Act", year: 2022, vote: "Yes" },
              { bill: "Clean Energy Innovation and Deployment Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "offshore-wind",
            label: "Offshore Wind & Renewable Energy",
            plainEnglish: "Massachusetts has some of the best offshore wind potential in the world. Warren backed federal investment in offshore wind energy — which would create thousands of Massachusetts jobs and reduce reliance on fossil fuels.",
            whyItMatters: "Vineyard Wind and other offshore wind projects off Cape Cod and the South Coast are major local debates, involving fishing communities, coastal residents, and energy workers. People are searching 'offshore wind jobs Massachusetts' and 'Vineyard Wind status' — it's a live economic and environmental story.",
            alignment: 88,
            stance: "Supports offshore wind expansion and federal permitting reform to accelerate deployment.",
            detail: "Backed offshore wind leasing in the Inflation Reduction Act. Supports streamlining federal permitting for clean energy projects. Advocates for buy-American provisions in offshore wind supply chains to create domestic manufacturing jobs. Has worked to ensure fishing communities have a voice in offshore wind siting decisions.",
            voteRecord: [
              { bill: "Inflation Reduction Act (offshore wind)", year: 2022, vote: "Yes" },
              { bill: "BUILD GREEN Infrastructure and Jobs Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "environmental-justice",
            label: "Environmental Justice",
            plainEnglish: "Environmental justice means that low-income communities and communities of color — who often live near highways, power plants, and industrial facilities — shouldn't bear a disproportionate share of pollution. Warren backs policies that specifically target cleanup and investment in these communities.",
            whyItMatters: "Chelsea, East Boston, Roxbury, and Lawrence are among the most pollution-burdened communities in Massachusetts. Residents near highways and the Mystic River report higher rates of asthma and cardiovascular disease. People in these communities are searching for accountability and action.",
            alignment: 90,
            stance: "Strongly supports environmental justice investment in frontline communities.",
            detail: "Supported the Environmental Justice for All Act. Backs the White House Justice40 initiative, which directs 40% of federal clean energy and infrastructure benefits to disadvantaged communities. Has pushed EPA to enforce air quality standards in communities near industrial polluters. Supports Superfund site cleanup in Massachusetts.",
            voteRecord: [
              { bill: "Environmental Justice for All Act", year: 2021, vote: "Yes" },
              { bill: "Inflation Reduction Act (EJ provisions)", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "fossil-fuels",
            label: "Oil, Gas & Fossil Fuel Policy",
            plainEnglish: "Warren opposes expanding new oil and gas drilling on federal lands and offshore, and wants to end federal subsidies — tax breaks and direct payments — that the government currently gives to fossil fuel companies.",
            whyItMatters: "Gas prices spiking in 2022 made energy policy a dinner-table conversation. At the same time, floods and wildfires made fossil fuel dependence a safety issue. People are searching 'why does gas cost so much' and 'oil company profits' — and connecting both to federal policy.",
            alignment: 85,
            stance: "Opposes new fossil fuel drilling and supports ending oil and gas subsidies.",
            detail: "Backed the End Polluter Welfare Act, which would eliminate approximately $150 billion in federal subsidies and tax breaks for fossil fuel companies over 10 years. Opposes new oil and gas leasing on federal public lands. Supports a fee on methane emissions from oil and gas production.",
            voteRecord: [
              { bill: "Inflation Reduction Act (methane fee)", year: 2022, vote: "Yes" },
              { bill: "End Polluter Welfare Act", year: 2021, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── TAXES & GOVERNMENT SPENDING ──── */
      {
        id: "taxes",
        topic: "Taxes & Government Spending",
        icon: "💰",
        subIssues: [
          {
            id: "wealth-tax",
            label: "Wealth Tax & Corporate Taxes",
            plainEnglish: "Warren famously proposed a 2% annual tax on fortunes above $50 million — what she calls the 'Ultra-Millionaire Tax.' She also supports raising the corporate tax rate, arguing that wealthy individuals and large corporations have benefited most from tax cuts while middle-class workers bear a higher relative burden.",
            whyItMatters: "Wealth inequality in the U.S. has hit record levels. People are searching 'wealth tax explained,' 'why don't billionaires pay taxes,' and 'why is the middle class shrinking' — and looking for elected officials who are actually proposing structural fixes.",
            alignment: 96,
            stance: "Strongly supports a wealth tax on fortunes above $50M and raising corporate tax rates.",
            detail: "Introduced the Ultra-Millionaire Tax Act, which would levy a 2% annual tax on fortunes above $50 million and 3% on those above $1 billion — estimated to raise $3 trillion over 10 years. Backed the Inflation Reduction Act's 15% corporate minimum tax. Supports reversing the 2017 Tax Cuts and Jobs Act's reduction in the corporate tax rate from 35% to 21%.",
            voteRecord: [
              { bill: "Inflation Reduction Act (corporate minimum tax)", year: 2022, vote: "Yes" },
              { bill: "Ultra-Millionaire Tax Act", year: 2021, vote: "Sponsored" },
            ],
          },
          {
            id: "social-security",
            label: "Social Security & Medicare",
            plainEnglish: "Social Security and Medicare are the safety net programs that provide income and healthcare to retirees and disabled Americans. Warren opposes any cuts to these programs and wants to expand Social Security benefits by raising taxes on high earners.",
            whyItMatters: "Social Security is projected to face funding shortfalls around 2033–2035 if no changes are made. Millions of Massachusetts seniors depend on it. 'Is Social Security going bankrupt' and 'will I get my Social Security' are consistently high-search questions among people over 50.",
            alignment: 94,
            stance: "Opposes cuts to Social Security and Medicare. Supports expanding benefits.",
            detail: "Co-sponsored the Social Security Expansion Act, which would expand benefits by approximately $2,400/year for recipients by applying Social Security taxes to income above $250,000. Opposes raising the retirement age. Supports allowing Medicare to negotiate prescription drug prices — a provision included in the Inflation Reduction Act.",
            voteRecord: [
              { bill: "Inflation Reduction Act (Medicare drug pricing)", year: 2022, vote: "Yes" },
              { bill: "Social Security Expansion Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "deficit-spending",
            label: "Federal Budget & Deficit",
            plainEnglish: "The federal government spends more than it takes in — that's the deficit. Warren believes the U.S. should invest in people and infrastructure now while paying for it by taxing the wealthy, rather than cutting programs that millions depend on.",
            whyItMatters: "Debt ceiling crises, potential government shutdowns, and battles over government spending are a recurring part of the news cycle. People search 'what is the national debt' and 'what happens if the U.S. defaults' — and want to know where their senator stands when these fights come to a head.",
            alignment: 60,
            stance: "Supports offsetting new spending with taxes on wealthy individuals and corporations.",
            detail: "Backed the Inflation Reduction Act partly because it was projected to reduce the deficit by $300 billion over 10 years through new taxes on corporations and high earners. Opposes spending cuts to social programs as a deficit-reduction tool. Has supported pay-for-it rules that require new spending to be offset with new revenue.",
            voteRecord: [
              { bill: "Inflation Reduction Act (deficit provisions)", year: 2022, vote: "Yes" },
              { bill: "Debt Ceiling Responsibility Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "drug-pricing",
            label: "Prescription Drug Prices",
            plainEnglish: "The U.S. pays far more for the same drugs than any other country. Warren backed allowing Medicare — which covers 65+ million Americans — to negotiate drug prices directly with pharmaceutical companies, the same way private insurers in other countries do.",
            whyItMatters: "'Why are prescription drugs so expensive in the US' is one of the most-searched healthcare questions in America. Insulin prices alone have dominated political debate for years. People want to know who fought for the insulin price cap and drug negotiation — and who opposed it.",
            alignment: 95,
            stance: "Strongly supports Medicare drug price negotiation and prescription drug cost caps.",
            detail: "The Inflation Reduction Act — which Warren voted for — gave Medicare the power to negotiate drug prices for the first time in history and capped insulin at $35/month for Medicare patients. Warren has pushed to expand these negotiations to more drugs faster and extend the insulin cap to all Americans, not just Medicare patients.",
            voteRecord: [
              { bill: "Inflation Reduction Act (drug pricing)", year: 2022, vote: "Yes" },
              { bill: "Insulin Price Reduction Act", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── TECHNOLOGY & PRIVACY ────────── */
      {
        id: "technology",
        topic: "Technology & Privacy",
        icon: "💻",
        subIssues: [
          {
            id: "ai-regulation",
            label: "Artificial Intelligence Regulation",
            plainEnglish: "AI tools like ChatGPT, hiring algorithms, and facial recognition are changing how people get jobs, access credit, and interact with government. Warren supports guardrails to make sure AI systems are accurate, transparent, and can't discriminate — especially in high-stakes decisions.",
            whyItMatters: "AI regulation is one of the fastest-growing search topics in American politics. People are asking 'can AI be used to hire or fire me,' 'is my face being scanned without permission,' and 'who regulates AI' — as these tools enter workplaces, courtrooms, and schools.",
            alignment: 78,
            stance: "Supports federal AI accountability standards, especially for high-stakes decision-making.",
            detail: "Backed the Algorithmic Accountability Act, which would require companies to audit automated systems for bias and accuracy. Supports transparency requirements for AI used in credit, hiring, housing, and criminal justice. Has raised concerns about AI-generated deepfakes and their impact on elections. Advocates for FTC authority to regulate harmful AI applications.",
            voteRecord: [
              { bill: "Algorithmic Accountability Act", year: 2022, vote: "Yes" },
              { bill: "AI Accountability Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "data-privacy",
            label: "Data Privacy & Surveillance",
            plainEnglish: "Every app, website, and device you use collects data about you. Warren supports a federal privacy law giving Americans the right to know what's collected, opt out of data sales, and sue companies that misuse their information. She also wants limits on government surveillance.",
            whyItMatters: "Data broker scandals, location tracking revelations, and stories about companies selling mental health data have made digital privacy a mainstream concern. 'Who has my data' and 'can I delete my data from the internet' are consistently high-search questions — and there's no federal law yet.",
            alignment: 85,
            stance: "Supports comprehensive federal data privacy law and limits on government surveillance.",
            detail: "Backed the American Data Privacy and Protection Act (ADPPA), which would create baseline federal privacy rights for all Americans. Supports data minimization rules that prohibit companies from collecting more data than necessary. Has pushed for limits on bulk government data collection without warrants, particularly through the Section 702 surveillance program.",
            voteRecord: [
              { bill: "American Data Privacy and Protection Act", year: 2022, vote: "Yes" },
              { bill: "Fourth Amendment Is Not For Sale Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "big-tech-antitrust",
            label: "Big Tech & Antitrust",
            plainEnglish: "Companies like Amazon, Google, Apple, and Meta have grown so dominant that they've bought or crushed most of their competition. Warren has been one of the most vocal senators calling to break up Big Tech — arguing their size harms consumers, workers, and democracy itself.",
            whyItMatters: "Amazon marketplace sellers, app developers, and small media companies have all complained about being crushed by tech giants. People are searching 'Google monopoly lawsuit' and 'Amazon antitrust' as major cases work through the courts — and want to know where their senators stand.",
            alignment: 92,
            stance: "Strongly supports breaking up big tech companies and aggressive antitrust enforcement.",
            detail: "Warren literally called for breaking up Amazon, Google, and Facebook in a 2019 plan that became a major campaign talking point. Backs the American Innovation and Choice Online Act, which would prohibit dominant platforms from favoring their own products. Supports stronger FTC and DOJ antitrust enforcement budgets. Has pushed for updated merger review standards that factor in harm to competition, not just immediate price effects.",
            voteRecord: [
              { bill: "American Innovation and Choice Online Act", year: 2022, vote: "Yes" },
              { bill: "Platform Competition and Opportunity Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "social-media-youth",
            label: "Social Media & Youth Safety",
            plainEnglish: "Warren supports laws that would require social media platforms to restrict addictive features for minors, make their algorithms transparent, and give parents more control. She links the teen mental health crisis directly to how these platforms are designed.",
            whyItMatters: "The Senate has held emotional hearings with parents of children harmed by social media. Meta, TikTok, and Snapchat executives have been grilled on Capitol Hill. 'Social media mental health kids' and 'TikTok ban explained' are consistently trending. Parents are actively searching for what Congress is actually doing.",
            alignment: 85,
            stance: "Supports restricting algorithmic targeting of minors and mandatory platform safety audits.",
            detail: "Backed the Kids Online Safety Act (KOSA), which would require platforms to provide kids with the ability to opt out of algorithmic recommendations and restrict addictive features. Supports the Children and Teens' Online Privacy Protection Act (COPPA 2.0). Has pushed for FTC authority to fine companies for repeated violations of children's privacy.",
            voteRecord: [
              { bill: "Kids Online Safety Act (KOSA)", year: 2023, vote: "Yes" },
              { bill: "COPPA 2.0 (children's online privacy)", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

    ], // end opinions

    /* ── SOURCES ─────────────────────────────── */
    /*
     * bias key: "left" | "center-left" | "center" | "center-right" | "right" | "nonpartisan"
     * type key: "government" | "factcheck" | "newspaper" | "nonprofit" | "academic" | "wire"
     * Each source covers what aspect of this candidate's record it verifies.
     */
    sources: [
      {
        name: "U.S. Senate Official Vote Record",
        url: "https://www.senate.gov/legislative/votes_new.htm",
        bias: "nonpartisan",
        type: "government",
        description: "Official congressional voting record. Every vote listed in this profile can be verified here by bill name and date. No editorializing — just the raw vote tallies.",
      },
      {
        name: "OpenSecrets — Warren Profile",
        url: "https://www.opensecrets.org/members-of-congress/elizabeth-warren/summary?cid=N00033492",
        bias: "nonpartisan",
        type: "nonprofit",
        description: "Nonpartisan campaign finance tracking organization. Source for all funding figures — total raised, donor industries, and PAC contributions. Funded by foundations across the political spectrum.",
      },
      {
        name: "GovTrack — Warren Voting Record",
        url: "https://www.govtrack.us/congress/members/elizabeth_warren/412542",
        bias: "nonpartisan",
        type: "nonprofit",
        description: "Independent legislative tracking tool. Provides automated, non-editorialized bill tracking and voting scores. Used by researchers and journalists across the political spectrum.",
      },
      {
        name: "PolitiFact — Warren Fact Checks",
        url: "https://www.politifact.com/personalities/elizabeth-warren/",
        bias: "center",
        type: "factcheck",
        description: "Pulitzer Prize-winning fact-checking outlet rated 'Center' by Ad Fontes Media. Has fact-checked statements by and about Warren since 2011. Methodology is publicly documented.",
      },
      {
        name: "FactCheck.org — Warren",
        url: "https://www.factcheck.org/?s=elizabeth+warren",
        bias: "center",
        type: "factcheck",
        description: "Run by the University of Pennsylvania's Annenberg Public Policy Center. Nonpartisan and nonprofit. Rated 'Center' by multiple media bias evaluators. Focuses on factual accuracy, not political framing.",
      },
      {
        name: "AP News — Warren Coverage",
        url: "https://apnews.com/elizabeth-warren",
        bias: "center",
        type: "wire",
        description: "The Associated Press is a nonprofit wire service rated 'Center' by Ad Fontes Media and AllSides. Its reporting is used by both left- and right-leaning outlets as a baseline source.",
      },
      {
        name: "Boston Globe — Warren Coverage",
        url: "https://www.bostonglobe.com/topic/elizabethwarren/",
        bias: "center-left",
        type: "newspaper",
        description: "Massachusetts's primary newspaper of record. Rated 'Lean Left' by AllSides. Provides detailed local-angle coverage of Warren's impact on Massachusetts specifically.",
      },
      {
        name: "The Wall Street Journal — Warren Coverage",
        url: "https://www.wsj.com/search?query=elizabeth+warren",
        bias: "center-right",
        type: "newspaper",
        description: "Major national newspaper rated 'Center-Right' (news pages) by Ad Fontes Media. Provides a business and market-focused perspective on Warren's economic and financial regulation proposals — a useful counterbalance.",
      },
      {
        name: "Ballotpedia — Elizabeth Warren",
        url: "https://ballotpedia.org/Elizabeth_Warren",
        bias: "nonpartisan",
        type: "nonprofit",
        description: "Nonpartisan political encyclopedia. Covers career history, election results, committee assignments, and sponsored legislation. Widely cited by researchers and educators.",
      },
      {
        name: "MIT Election Data & Science Lab",
        url: "https://electionlab.mit.edu/",
        bias: "nonpartisan",
        type: "academic",
        description: "Academic research lab at MIT. Provides election data, voter behavior research, and district-level analysis. Non-advocacy, peer-reviewed research used to contextualize electoral trends.",
      },
    ],

    /* ── MISCONCEPTIONS ──────────────────────── */
    /*
     * Each entry:
     *   myth        — the exact claim or headline people share/believe
     *   reality     — the factual correction, sourced and specific
     *   sourceLabel — short display name for the source
     *   sourceUrl   — link to verify
     *   category    — topic tag for display
     */
    misconceptions: [
      {
        category: "Heritage / Identity",
        myth: "Warren falsely claimed Native American ancestry to get into Harvard Law School.",
        mythSourceLabel: "Boston Herald (2012) — original claim",
        mythSourceUrl: "https://www.bostonherald.com/2012/04/27/warren-listed-herself-as-minority-in-law-school-directory/",
        reality: "Harvard Law never cited Warren's heritage in hiring her, and Warren herself did not list Native American status on her law school application. The claim originated in 2012 political opposition research. A Boston Globe investigation found no evidence her heritage played any role in her hiring. She did claim Cherokee heritage in a 1986 Texas bar application — something she has acknowledged and apologized for mishandling.",
        sourceLabel: "Boston Globe investigation (2018)",
        sourceUrl: "https://www.bostonglobe.com/news/politics/2018/10/15/warren-release-results-dna-test/GbHMR4DGCZ3TVVTMK2JSUI/story.html",
      },
      {
        category: "Policy Record",
        myth: "Warren wants to ban all private health insurance immediately.",
        mythSourceLabel: "PolitiFact — original claim context (2019)",
        mythSourceUrl: "https://www.politifact.com/factchecks/2019/nov/05/amy-klobuchar/warren-said-she-would-ban-private-health-insurance/",
        reality: "Warren supports Medicare for All, which would transition the U.S. to a single-payer system over several years — not an overnight ban. Her own 2019 plan proposed a 3-year transition period. She has also expressed support for intermediate steps like a public option, stating the goal is universal coverage, not immediate elimination of private plans.",
        sourceLabel: "PolitiFact (2019)",
        sourceUrl: "https://www.politifact.com/factchecks/2019/nov/05/amy-klobuchar/warren-said-she-would-ban-private-health-insurance/",
      },
      {
        category: "Wealth & Finances",
        myth: "Warren is a hypocrite because she's a millionaire who attacks the wealthy.",
        mythSourceLabel: "Forbes — Warren net worth profile",
        mythSourceUrl: "https://www.forbes.com/profile/elizabeth-warren/",
        reality: "Warren's net worth is estimated at $12–14 million, making her one of the less wealthy U.S. senators (the median senator's net worth exceeds $1 million). Her wealth comes largely from book royalties and her Senate salary — not investment income or corporate stock. She supports a wealth tax on fortunes above $50 million, a threshold that wouldn't apply to her. Criticizing systemic wealth concentration is not the same as opposing personal financial success.",
        sourceLabel: "Forbes Wealth Tracker / Senate disclosure",
        sourceUrl: "https://www.forbes.com/profile/elizabeth-warren/",
      },
      {
        category: "Consumer Protection",
        myth: "The CFPB Warren created has been ineffective and costs more than it returns.",
        mythSourceLabel: "Cato Institute — CFPB criticism (2023)",
        mythSourceUrl: "https://www.cato.org/policy-analysis/consumer-financial-protection-bureau-case-against-cfpb",
        reality: "As of 2024, the Consumer Financial Protection Bureau (CFPB) has returned over $17.5 billion to more than 200 million consumers through enforcement actions against predatory lenders, banks, and debt collectors. Its operating budget is funded by the Federal Reserve, not congressional appropriations. It consistently returns far more money to consumers than it costs to operate.",
        sourceLabel: "CFPB By the Numbers (cfpb.gov)",
        sourceUrl: "https://www.consumerfinance.gov/about-us/the-bureau/",
      },
      {
        category: "Foreign Policy",
        myth: "Warren has never supported any military action or defense spending.",
        mythSourceLabel: "Senate.gov — NDAA vote record",
        mythSourceUrl: "https://www.senate.gov/legislative/votes_new.htm",
        reality: "Warren has voted in favor of the National Defense Authorization Act (NDAA) multiple times, including in 2023. She voted to authorize Ukraine military assistance. She supports a strong national defense but advocates for stronger congressional oversight of how military funds are spent — not eliminating the military budget.",
        sourceLabel: "Senate.gov vote records",
        sourceUrl: "https://www.senate.gov/legislative/votes_new.htm",
      },
      {
        category: "Education Policy",
        myth: "Warren's student debt cancellation plan would only help rich college graduates.",
        mythSourceLabel: "Penn Wharton Budget Model — distributional analysis (2021)",
        mythSourceUrl: "https://budgetmodel.wharton.upenn.edu/issues/2021/8/26/biden-student-loan-forgiveness",
        reality: "Analysis by the Roosevelt Institute found that Warren's $50,000 cancellation plan would disproportionately benefit borrowers in the bottom 60% of income earners. The majority of student debt holders did not attend elite universities — many attended community colleges or vocational programs. Her plan also included income caps: borrowers earning over $250,000 would receive no cancellation.",
        sourceLabel: "Roosevelt Institute analysis (2021)",
        sourceUrl: "https://rooseveltinstitute.org/publications/student-debt-cancellation-is-progressive/",
      },
    ],
  }, // end warren


  /* ════════════════════════════════════════════
     ED MARKEY
  ════════════════════════════════════════════ */
  {
    slug: "ed-markey",
    name: "Ed Markey",
    role: "U.S. Senator, Massachusetts",
    party: "Democrat",
    photo: "https://bioguide.congress.gov/bioguide/photo/M/M000133.jpg",
    openSecretsUrl: "https://www.opensecrets.org/members-of-congress/ed-markey/summary?cid=N00000270",

    /* ── CURRENT STATUS ──────────────────────── */
    status: {
      currentTitle: "U.S. Senator",
      state: "Massachusetts",
      statusType: "incumbent",
      statusLabel: "Currently serving",
      termInfo: "Serving since 2013 (Senate). Previously served in the House 1976–2013. Up for re-election in 2026.",
      nextElection: "2026",
      runningFor: null,
      committees: [
        "Senate Foreign Relations",
        "Senate Commerce, Science & Transportation",
        "Senate Environment & Public Works",
        "Senate Judiciary",
      ],
      plainEnglish: "Markey has been in elected office continuously since 1973 — first in the Massachusetts state legislature, then the U.S. House for 37 years, and now the U.S. Senate. He won re-election to the Senate in 2020. His current term runs until January 2027.",
    },

    /* ── FUNDING ─────────────────────────────── */
    funding: {
      total: "$11,200,000",
      topIndustry: "TV / Movies / Music",
      smallDonorPct: "41%",
      plainEnglish: "Markey's biggest donors come from entertainment and media companies — which makes sense given his 40+ years working on telecom and internet policy. About 4 in 10 dollars come from small donors. He gets more from defense and tech PACs than Warren does, which is typical for members of committees overseeing those industries.",
      whyItMatters: "People are asking: does Markey's media industry funding influence his votes on internet regulation, streaming platforms, and broadband policy? His committee role means these industries have a direct stake in his decisions.",
      sources: [
        { label: "TV / Movies / Music",       amount: 1800000, pct: 16 },
        { label: "Lawyers / Law Firms",        amount: 1500000, pct: 13 },
        { label: "Environment / Clean Energy", amount: 1200000, pct: 11 },
        { label: "Health Professionals",       amount: 950000,  pct: 8  },
        { label: "Retired",                    amount: 700000,  pct: 6  },
      ],
      foreignSources: [
        { label: "Telecom & Tech PACs",        amount: 230000, pct: 2.1 },
        { label: "Defense-related PACs",       amount: 95000,  pct: 0.8 },
        { label: "Foreign-Linked Energy PACs", amount: 40000,  pct: 0.4 },
      ],
    },

    /* ── CAREER ──────────────────────────────── */
    career: [
      {
        years: "2013–present",
        title: "U.S. Senator",
        org: "Massachusetts",
        description: "Chairs the Subcommittee on Communications, Media, and Broadband. Co-authored the Green New Deal — the most prominent climate + jobs proposal in recent U.S. history, which became a central debate in the 2020 election.",
      },
      {
        years: "1976–2013",
        title: "U.S. Representative",
        org: "Massachusetts 7th District",
        description: "One of the longest-serving House members in history. Helped write the Telecommunications Act of 1996, which shaped how cable TV, phone companies, and the early internet were regulated — legislation that affects how you use the internet today.",
      },
      {
        years: "1973–1976",
        title: "State Representative",
        org: "Massachusetts House of Representatives",
        description: "Entered politics at age 26. Won his first congressional race three years later, beginning a 47+ year career in elected office.",
      },
    ],

    /* ── OPINIONS ────────────────────────────── */
    opinions: [

      /* ── HEALTHCARE ─────────────────── */
      {
        id: "healthcare",
        topic: "Healthcare",
        icon: "🏥",
        subIssues: [
          {
            id: "abortion",
            label: "Abortion & Reproductive Rights",
            plainEnglish: "Markey believes abortion is a personal decision that belongs to the individual — not the government. He also wants access to contraception written into federal law so it can't be restricted state by state.",
            whyItMatters: "After Dobbs (2022), 14 states banned abortion. People across the country — especially in Massachusetts — are searching which senators will fight to restore federal abortion protections and what that fight actually looks like in Congress.",
            alignment: 93,
            stance: "Fully pro-choice. Supports federal protection of abortion and contraception access.",
            detail: "Voted for the Women's Health Protection Act. Supports full Planned Parenthood funding and opposes any federal restrictions on abortion. Called the Dobbs ruling a 'devastating blow to freedom.' Backed the Right to Contraception Act.",
            voteRecord: [
              { bill: "Women's Health Protection Act", year: 2022, vote: "Yes" },
              { bill: "Right to Contraception Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "health-system",
            label: "Public vs. Private Health System",
            plainEnglish: "Markey wants everyone covered by one public health plan — no premiums, no surprise bills. He's voted to block every attempt to repeal the Affordable Care Act and wants to eventually replace private insurance entirely.",
            whyItMatters: "Surprise billing, insurance denial horror stories, and drug prices going viral on social media have kept healthcare at the top of what people search. The question 'why does healthcare cost so much in the U.S.' consistently trends.",
            alignment: 88,
            stance: "Supports Medicare for All. Opposed every ACA repeal attempt.",
            detail: "Co-sponsored Medicare for All. Voted against every ACA repeal attempt 2017–2020. Supports a universal public system that eliminates insurance premiums and deductibles for all Americans.",
            voteRecord: [
              { bill: "Medicare for All Act", year: 2022, vote: "Co-sponsor" },
              { bill: "ACA Repeal Block", year: 2017, vote: "No on repeal" },
            ],
          },
          {
            id: "mental-health",
            label: "Mental Health & Substance Abuse",
            plainEnglish: "Markey wants insurance companies legally required to cover therapy and addiction treatment the same way they cover physical injuries. He also pushed for dedicated research funding into the teen mental health crisis after COVID.",
            whyItMatters: "Anxiety and depression searches hit all-time highs during and after COVID. The teen mental health crisis and fentanyl overdose epidemic are top news. People want to know if their senator is treating this as a real public health emergency.",
            alignment: 84,
            stance: "Supports insurance parity and community-based mental health investment.",
            detail: "Backed enforcement of the Mental Health Parity and Addiction Equity Act. Supports community mental health centers and mobile crisis units. Authored the Youth Mental Health Research Act to fund research into adolescent mental health.",
            voteRecord: [
              { bill: "Mental Health Parity Act enforcement", year: 2023, vote: "Yes" },
              { bill: "Youth Mental Health Research Act", year: 2022, vote: "Sponsored" },
            ],
          },
        ],
      },

      /* ── HOUSING ────────────────────── */
      {
        id: "housing",
        topic: "Housing & Zoning",
        icon: "🏠",
        subIssues: [
          {
            id: "affordable-housing",
            label: "Affordable Housing Supply",
            plainEnglish: "Markey backed expanding a key federal tax credit that funds the construction of affordable rental apartments. He also wants those new buildings to be energy-efficient — so low-income renters save money on both rent and utilities.",
            whyItMatters: "Massachusetts has some of the highest rents in the country. Boston consistently ranks in the top 5 most expensive cities for renters. People are searching 'affordable housing near me' and 'why can't I afford rent' at record rates.",
            alignment: 82,
            stance: "Supports LIHTC expansion and climate-resilient affordable housing investment.",
            detail: "Backed LIHTC expansion and increased HUD funding. Advocates for connecting affordable housing investment with green building standards to reduce both housing costs and energy bills for low-income renters.",
            voteRecord: [
              { bill: "Build Back Better (housing provisions)", year: 2021, vote: "Yes" },
              { bill: "LIHTC expansion amendment", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "zoning-reform",
            label: "Zoning Reform & Density",
            plainEnglish: "Markey backed a law that rewards cities with federal grants if they loosen their zoning rules and allow more apartments — especially near bus and train stations where people can live without a car.",
            whyItMatters: "MBTA Communities zoning reform has been a massive story in Massachusetts, with dozens of towns fighting or complying with state density requirements. People are searching what this actually means for their neighborhood.",
            alignment: 75,
            stance: "Supports federal incentives for cities to allow more density near transit.",
            detail: "Backed the YIMBY Act, which ties federal Community Development Block Grant funding to zoning reform. Supports ADUs and multi-family housing in transit corridors as a supply solution.",
            voteRecord: [
              { bill: "Yes In My Backyard (YIMBY) Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "tenant-protections",
            label: "Tenant Protections & Eviction",
            plainEnglish: "During COVID, millions of people couldn't pay rent and faced eviction. Markey backed emergency funds to keep them housed. He also wants renters to have lawyers in eviction court — the same advantage landlords already have.",
            whyItMatters: "Eviction filings are surging in Massachusetts cities. Corporate landlords and algorithmic rent-setting tools are making headlines. People are searching 'my landlord is raising my rent' and 'what are my rights as a tenant' — and looking for who's fighting for them.",
            alignment: 80,
            stance: "Supports right-to-counsel and emergency rental assistance for tenants.",
            detail: "Backed the Emergency Rental Assistance program during COVID. Supports national right-to-counsel legislation ensuring low-income renters have legal representation in eviction proceedings.",
            voteRecord: [
              { bill: "Emergency Rental Assistance Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "homelessness",
            label: "Homelessness",
            plainEnglish: "Markey supports giving homeless people a stable place to live first, before asking them to tackle addiction or find a job. He also backed extra housing programs specifically for homeless veterans through the VA.",
            whyItMatters: "The Melnea Cass Boulevard 'Mass and Cass' crisis in Boston has been a major ongoing local story. People are searching what politicians are actually doing — not just making speeches — about homelessness in the city.",
            alignment: 80,
            stance: "Supports Housing First model and permanent supportive housing investment.",
            detail: "Advocates for the Housing First model with wraparound services. Backed increased McKinney-Vento homeless assistance appropriations. Supports connecting homeless veterans to VA housing programs.",
            voteRecord: [
              { bill: "Ending Homelessness Act", year: 2020, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── IMMIGRATION ─────────────────── */
      {
        id: "immigration",
        topic: "Immigration",
        icon: "🌍",
        subIssues: [
          {
            id: "daca-citizenship",
            label: "DACA & Pathway to Citizenship",
            plainEnglish: "Markey wants people who grew up here without legal status to be able to stay — legally, permanently. These are people who went to American schools, pay American taxes, and in many cases have never lived anywhere else.",
            whyItMatters: "Massachusetts has tens of thousands of DACA recipients and undocumented residents. With ongoing court battles over DACA's legality, people are searching what their senators plan to do if the program is struck down entirely.",
            alignment: 88,
            stance: "Supports permanent citizenship pathway for DACA recipients and undocumented immigrants.",
            detail: "Co-sponsored the American Dream and Promise Act. Supports broad immigration reform providing an earned citizenship pathway. Opposes mass deportation.",
            voteRecord: [
              { bill: "American Dream and Promise Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "border-security",
            label: "Border Security & Asylum",
            plainEnglish: "Markey believes that people fleeing danger have a legal right to ask the U.S. for asylum. He opposes laws that make that process so hard that people give up — and he opposes holding families in prison-like facilities while they wait.",
            whyItMatters: "Massachusetts cities like Springfield and Worcester have taken in thousands of migrants. The debate over who pays for shelters and services is front-page news. People are searching 'immigration crisis Massachusetts' and 'what is asylum' at high rates.",
            alignment: 70,
            stance: "Supports humane asylum processing and opposes restrictive changes.",
            detail: "Opposed travel ban policies. Supports funding immigration courts to clear the case backlog. Advocates for treating asylum seekers with dignity and ending family detention.",
            voteRecord: [
              { bill: "Travel Ban Opposition Resolution", year: 2017, vote: "Yes" },
              { bill: "Family Separation Prevention Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "worker-visas",
            label: "Work Visas & Labor Immigration",
            stance: "Supports expanding legal work pathways with labor protections.",
            plainEnglish: "Markey wants it to be easier for skilled workers and essential laborers to come here legally. He also wants to make sure that employers can't exploit workers just because of their immigration status.",
            whyItMatters: "Massachusetts has a significant H-1B workforce in tech and biotech. There are also large immigrant populations in agriculture and food service. Both groups are searching for protections and pathways that keep them secure.",
            alignment: 75,
            detail: "Backed visa reforms increasing pathways for tech workers and essential laborers. Supports removing per-country green card caps. Advocates for protecting undocumented workers from wage exploitation.",
            voteRecord: [
              { bill: "Essential Workers for America Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "refugee-policy",
            label: "Refugee Admissions",
            plainEnglish: "Markey strongly backed welcoming Afghan refugees after the U.S. withdrew from Afghanistan in 2021. He wants the U.S. to accept more refugees overall and stop treating people who survived war as a security threat.",
            whyItMatters: "Massachusetts resettled thousands of Afghan refugees in 2021–2022. With new crises in Gaza and Sudan, people are asking 'will the U.S. take in more refugees' and 'what is the refugee process' — and who in Congress is championing it.",
            alignment: 85,
            stance: "Supports restoring refugee caps and welcoming Afghan and other refugees.",
            detail: "Strongly backed the Afghan Adjustment Act. Supports 125,000 annual refugee admissions and TPS protections for Venezuelans, Haitians, and others from crisis countries.",
            voteRecord: [
              { bill: "Afghan Adjustment Act", year: 2022, vote: "Yes" },
              { bill: "TPS Extension Resolution", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── EDUCATION ───────────────────── */
      {
        id: "education",
        topic: "Education & School Infrastructure",
        icon: "🏫",
        subIssues: [
          {
            id: "k12-funding",
            label: "K-12 Funding & Equity",
            plainEnglish: "Markey's signature education issue is internet access — he's fought for decades to make sure every school and library has broadband, so no kid falls behind because their school or home doesn't have a connection.",
            whyItMatters: "The COVID remote learning crisis exposed massive digital inequality in Massachusetts schools. Lowell, Worcester, and Springfield families are still searching 'free internet for students' and 'school Wi-Fi.' Markey has made this a career issue.",
            alignment: 85,
            stance: "Supports Title I expansion, digital equity in schools, and universal school meals.",
            detail: "Backed the American Rescue Plan's education funding. Advocates for E-Rate expansion ensuring every school and library has broadband. Supports universal free school meals and staffed school counselors.",
            voteRecord: [
              { bill: "American Rescue Plan (education)", year: 2021, vote: "Yes" },
              { bill: "E-Rate Modernization Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "student-debt",
            label: "Student Loan Debt & Higher Ed",
            plainEnglish: "Markey backed canceling student loan debt and wants community college to be free — arguing that a college degree shouldn't mean 20 years of debt payments that keep people from buying a home or starting a family.",
            whyItMatters: "With student loan payments back on after the COVID pause, millions of borrowers are searching 'when do I have to pay back my loans' and 'is student debt forgiveness still happening.' This is a live, daily financial concern for millions.",
            alignment: 84,
            stance: "Supports student debt relief and free community college.",
            detail: "Backed executive action on student loan forgiveness. Supports free community college as a workforce development tool. Advocates for for-profit college accountability to stop predatory practices.",
            voteRecord: [
              { bill: "Student Loan Debt Relief Plan", year: 2022, vote: "Supported" },
            ],
          },
          {
            id: "school-safety",
            label: "School Safety & Infrastructure",
            plainEnglish: "Markey wrote a major law protecting students from being tracked and profiled by the apps and software they use in school. He also wants federal money to modernize school buildings — better air, clean water, and heating that actually works.",
            whyItMatters: "After school shootings, parents search their senators' records on gun legislation and school safety spending. At the same time, post-COVID air quality concerns, mold, and asbestos in old school buildings have become parent organizing issues across Massachusetts.",
            alignment: 83,
            stance: "Prioritizes student data privacy, mental health, and building modernization.",
            detail: "Authored COPPA (Children's Online Privacy Protection Act). Backs federal investment in HVAC upgrades, lead-free water, and mental health infrastructure in schools.",
            voteRecord: [
              { bill: "Children's Online Privacy Protection Act", year: 2022, vote: "Yes" },
              { bill: "Rebuild America's Schools Act", year: 2022, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── FOREIGN POLICY ──────────────── */
      {
        id: "foreign-policy",
        topic: "Foreign Policy & Trade",
        icon: "🌐",
        subIssues: [
          {
            id: "wars-military",
            label: "Military Intervention & Wars",
            plainEnglish: "Markey supported aid to Ukraine but has been one of the most vocal senators about making sure Congress — not just the President — controls decisions about war and weapons sales. He pushed to take back powers that have let presidents wage wars without a vote.",
            whyItMatters: "The Ukraine war, debate over U.S. involvement in Gaza, and the question of 'how much should the U.S. spend on defense vs. domestic needs' are dominating political searches. People want to know if their senator is a hawk, a dove, or something in between.",
            alignment: 52,
            stance: "Diplomacy-first. Cautious on military escalation. Backed Ukraine aid.",
            detail: "Voted for Ukraine security assistance. Co-authored legislation to repeal the 2002 Iraq AUMF. Raised concerns about U.S. arms sales to Saudi Arabia for Yemen. Advocates for War Powers Act reform to restore congressional authority.",
            voteRecord: [
              { bill: "Ukraine Security Assistance", year: 2023, vote: "Yes" },
              { bill: "Saudi Arms Sale Block Resolution", year: 2023, vote: "Yes" },
              { bill: "AUMF Repeal (Iraq 2002)", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "trade-tariffs",
            label: "Trade Policy & Tariffs",
            plainEnglish: "Markey wants trade agreements to include real protections for workers and the environment — not just rules that help corporations move production to countries with cheaper labor. His Green New Deal also calls for reshaping trade policy around climate goals.",
            whyItMatters: "Inflation, supply chain disruptions, and 'Made in America' debates have made trade policy a mainstream topic. People are searching 'who does trade policy benefit' and 'why are goods from China taxed' — and connecting it to their grocery bills.",
            alignment: 62,
            stance: "Supports trade deals with strong labor and environmental standards.",
            detail: "Co-authored the Green New Deal, which includes reshaping trade to address climate. Supports targeted tariffs on forced-labor goods. Backed the Uyghur Forced Labor Prevention Act.",
            voteRecord: [
              { bill: "Green New Deal Resolution", year: 2019, vote: "Introduced" },
              { bill: "Uyghur Forced Labor Prevention Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "foreign-aid",
            label: "Foreign Aid & Diplomacy",
            plainEnglish: "Markey supports U.S. foreign aid — especially for countries hit hardest by climate change — and wants the U.S. to stay involved in international organizations like the UN and World Health Organization.",
            whyItMatters: "Foreign aid bills dominated Congress in 2024. People are searching 'how much does the U.S. spend on foreign aid' (it's about 1% of the federal budget) and debating whether that money should stay home instead.",
            alignment: 78,
            stance: "Supports robust foreign aid and international climate finance.",
            detail: "Advocates for maintaining and expanding U.S. foreign aid for climate-vulnerable nations. Backed Green Climate Fund contributions. Supports restoring U.S. engagement with the WHO and Paris Agreement.",
            voteRecord: [
              { bill: "State and Foreign Ops Appropriations", year: 2023, vote: "Yes" },
              { bill: "Green Climate Fund contribution", year: 2021, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── PUBLIC INFRASTRUCTURE ───────────── */
      {
        id: "infrastructure",
        topic: "Public Infrastructure",
        icon: "🚇",
        subIssues: [
          {
            id: "public-transit",
            label: "Public Transportation",
            plainEnglish: "Markey backed the largest federal transit investment in U.S. history — $39 billion for buses, subways, and rail systems. For Massachusetts, that means funding for MBTA repairs, new Green Line cars, and commuter rail upgrades.",
            whyItMatters: "The MBTA's years of breakdowns, slow zones, and service cuts have become a defining issue for Boston-area residents. People are searching 'why is the T so bad' and 'MBTA federal funding' — and looking at who in Washington is actually fighting for it.",
            alignment: 90,
            stance: "Strongly supports federal transit investment and Northeast Corridor rail expansion.",
            detail: "Backed the Infrastructure Investment and Jobs Act (2021), which included $39 billion for public transit. Supports Amtrak expansion on the Northeast Corridor as a climate-smart alternative to driving and flying. Has specifically advocated for MBTA capital funding and commuter rail electrification. Co-authored the GREEN Act which tied transportation funding to emissions reduction goals.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act", year: 2021, vote: "Yes" },
              { bill: "Amtrak Improvement Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "roads-bridges",
            label: "Roads, Bridges & Highway Safety",
            plainEnglish: "Massachusetts has hundreds of bridges rated structurally deficient. Markey voted for the bipartisan infrastructure law that sent over a billion dollars to Massachusetts specifically for road and bridge repairs.",
            whyItMatters: "Every driver in Massachusetts has hit a pothole or sat in construction traffic. When bridges collapsed elsewhere in the U.S., people started searching the condition of local bridges. This is an issue that spans party lines — everyone uses the roads.",
            alignment: 78,
            stance: "Supports bipartisan federal investment in road and bridge infrastructure.",
            detail: "Voted for the Infrastructure Investment and Jobs Act, which provided $110 billion for roads and bridges nationally. Massachusetts received over $1.2 billion in federal highway formula funding. Backs complete streets design standards that improve safety for all users including pedestrians, cyclists, and people with disabilities.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "broadband",
            label: "Broadband & Internet Access",
            plainEnglish: "Internet access is Markey's signature infrastructure issue — he's fought for it since before most people knew what broadband was. He backed $65 billion in federal funding to connect every household in America, including low-income families who currently can't afford it.",
            whyItMatters: "Markey has championed broadband equity for decades, but the COVID pandemic made it urgent. Kids doing school on mobile hotspots in parking lots became a national story. 'Free internet for low-income families' and 'ACP broadband subsidy' are still widely searched by Massachusetts families.",
            alignment: 95,
            stance: "Strongly supports universal broadband deployment and affordable pricing.",
            detail: "Backed $65 billion in broadband provisions in the Infrastructure Investment and Jobs Act. Championed the Affordable Connectivity Program (ACP), which provided up to $30/month internet subsidies. Long-time author of internet equity legislation and net neutrality protections. Supports municipal broadband and FCC authority to regulate ISP pricing.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act (broadband)", year: 2021, vote: "Yes" },
              { bill: "Affordable Connectivity Program Extension Act", year: 2024, vote: "Yes" },
            ],
          },
          {
            id: "water-systems",
            label: "Water & Sewer Infrastructure",
            plainEnglish: "Markey backed a $55 billion federal investment — the largest ever — to replace lead pipes and upgrade aging water systems. Massachusetts cities like Lynn and Lowell have infrastructure dating back over 100 years.",
            whyItMatters: "The Flint water crisis brought lead pipes into national focus. Massachusetts communities with aging systems have similar risks. Parents are searching 'is my tap water safe' and 'lead pipes Massachusetts.' Federal water infrastructure money is one of the most direct ways a senator impacts local health.",
            alignment: 84,
            stance: "Supports lead pipe replacement and federal water system investment.",
            detail: "The Infrastructure Investment and Jobs Act included $55 billion for water systems — the largest federal water investment in U.S. history. Markey voted yes. Provisions require states to replace all lead service lines within 10 years. Supported additional funding for environmental justice communities disproportionately affected by aging water infrastructure.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act (water)", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "airports-ports",
            label: "Airports & Ports",
            plainEnglish: "Logan Airport and the Port of Boston handle millions of passengers and billions in cargo annually. Markey backed federal grants to modernize both — which affects flight reliability and the price of goods shipped through Boston.",
            whyItMatters: "Post-COVID flight cancellations, FAA staffing shortages, and supply chain disruptions from port backlogs made airport and port infrastructure front-page news. People connect infrastructure investment to real costs they're experiencing — higher prices and delayed flights.",
            alignment: 72,
            stance: "Supports airport modernization grants and port electrification investment.",
            detail: "The Infrastructure Investment and Jobs Act included $25 billion for airports and $17 billion for ports. Markey supported these provisions. Advocated for zero-emission port equipment and terminal electrification as part of his climate agenda. Backed FAA workforce provisions to reduce staffing-related flight delays.",
            voteRecord: [
              { bill: "Infrastructure Investment and Jobs Act (airports/ports)", year: 2021, vote: "Yes" },
              { bill: "FAA Reauthorization Act", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── PUBLIC SAFETY ───────────────── */
      {
        id: "public-safety",
        topic: "Public Safety",
        icon: "🛡️",
        subIssues: [
          {
            id: "gun-control",
            label: "Gun Control",
            plainEnglish: "Markey has supported gun control for over 40 years. He wants military-style rifles off the civilian market, background checks for all gun sales, and 'red flag' laws — a way to legally take guns from someone before they hurt themselves or others.",
            whyItMatters: "Mass shootings consistently spike gun-related searches. After each incident, people search their senators' full voting histories — not just their statements. 'Red flag law Massachusetts' and 'AR-15 ban' are high-volume searches following any gun news.",
            alignment: 91,
            stance: "Decades-long advocate for assault weapons ban, background checks, and red flag laws.",
            detail: "Co-sponsored the Federal Assault Weapons Ban. Backed the Bipartisan Safer Communities Act. Supports universal background checks, red flag laws, and a ban on high-capacity magazines.",
            voteRecord: [
              { bill: "Bipartisan Safer Communities Act", year: 2022, vote: "Yes" },
              { bill: "Federal Assault Weapons Ban", year: 2022, vote: "Yes" },
              { bill: "Background Check Expansion Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "policing-reform",
            label: "Policing & Criminal Justice Reform",
            plainEnglish: "Markey backed the George Floyd Act — which would require police body cameras and ban chokeholds — and supports sending mental health workers, not police, to calls that don't involve violence.",
            whyItMatters: "Police accountability is a persistent, deeply-searched topic in Massachusetts and nationally. People look up 'what is qualified immunity,' 'body camera laws by state,' and their senators' votes every time a high-profile police incident makes news.",
            alignment: 84,
            stance: "Supports police accountability legislation and community-based crisis response.",
            detail: "Co-sponsored the George Floyd Justice in Policing Act. Supports ending qualified immunity, mandating body cameras, and banning no-knock warrants. Backs mental health crisis response teams as complements to traditional policing.",
            voteRecord: [
              { bill: "George Floyd Justice in Policing Act", year: 2021, vote: "Yes" },
              { bill: "EQUAL Act", year: 2021, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── ECONOMY & WORKERS ───────────── */
      {
        id: "economy",
        topic: "Economy & Workers",
        icon: "💼",
        subIssues: [
          {
            id: "minimum-wage",
            label: "Minimum Wage",
            plainEnglish: "Markey supports raising the federal minimum wage to $15/hour. Massachusetts already has a higher state wage floor, but millions of workers in other states earn the federal minimum of $7.25 — a figure that hasn't changed since 2009.",
            whyItMatters: "Federal minimum wage debates affect workers across the country. People searching 'minimum wage Massachusetts' and 'living wage calculator' are often comparing what they earn to what it actually costs to live in their city — and looking for who's fighting to change it.",
            alignment: 90,
            stance: "Strongly supports raising the federal minimum wage to $15/hour.",
            detail: "Co-sponsored the Raise the Wage Act. Has supported minimum wage increases throughout his 47+ year career. Argues the federal minimum wage has lost more than 20% of its purchasing power since it was last raised and must be increased and indexed to inflation.",
            voteRecord: [
              { bill: "Raise the Wage Act", year: 2021, vote: "Yes" },
              { bill: "Minimum Wage Fairness Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "workers-rights",
            label: "Union Rights & Collective Bargaining",
            plainEnglish: "Markey strongly supports the legal right for workers to organize into unions and bargain collectively. He backed the PRO Act — the biggest pro-union federal legislation in decades — which would make it harder for employers to block union drives.",
            whyItMatters: "The wave of union drives at Amazon, Starbucks, and Massachusetts hospitals has made labor rights front-page news. People are asking 'can I form a union' and 'what is the PRO Act' — as workers at companies they interact with daily try to organize.",
            alignment: 88,
            stance: "Supports the PRO Act and stronger collective bargaining protections.",
            detail: "Backed the PRO Act, which would ban mandatory anti-union meetings, allow workers to strike in solidarity with other unions, and strengthen penalties for illegal union-busting. Long track record of supporting public sector unions and federal employee bargaining rights throughout his congressional career.",
            voteRecord: [
              { bill: "PRO Act (Protecting the Right to Organize)", year: 2021, vote: "Yes" },
              { bill: "Public Service Freedom to Negotiate Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "gig-economy",
            label: "Gig Workers & Job Classification",
            plainEnglish: "Millions of people drive for Uber, deliver for DoorDash, or freelance on digital platforms — and are classified as 'independent contractors' rather than employees, which means they don't get healthcare, overtime, or unemployment. Markey supports changing federal rules to give these workers more protections.",
            whyItMatters: "Massachusetts went through a major gig worker ballot fight in 2022. With more people working gig jobs, people are searching 'gig worker rights Massachusetts' and 'do Uber drivers get benefits' — and looking for federal representatives who have a position on it.",
            alignment: 80,
            stance: "Supports stronger federal standards to classify and protect gig workers.",
            detail: "Backs the ABC worker classification test to ensure workers aren't misclassified as contractors to avoid labor protections. Supports extending unemployment insurance, workers' comp, and collective bargaining rights to gig workers. Has pushed for portable benefits systems that follow workers regardless of employer.",
            voteRecord: [
              { bill: "Worker Organizing and Protection Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "inflation-cost-of-living",
            label: "Inflation & Cost of Living",
            plainEnglish: "Markey argues that corporate price-gouging — companies raising prices beyond their actual cost increases — made inflation worse and longer-lasting. He backed legislation targeting pharmaceutical companies, energy companies, and grocers for excess profits during high-inflation periods.",
            whyItMatters: "'Why is everything so expensive' was the defining economic question of the mid-2020s. Grocery prices, rent, and energy costs remain elevated. People in Massachusetts — one of the most expensive states — are directly feeling these costs and searching for who is taking action.",
            alignment: 76,
            stance: "Supports price gouging legislation and corporate windfall profit accountability.",
            detail: "Backed the Price Gouging Prevention Act. Supported the Inflation Reduction Act's provisions on drug prices and clean energy cost reduction. Advocates for FTC enforcement against anticompetitive pricing by dominant firms. Supports utility regulation to prevent energy companies from passing excessive profits to consumers.",
            voteRecord: [
              { bill: "Inflation Reduction Act", year: 2022, vote: "Yes" },
              { bill: "Price Gouging Prevention Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "small-business",
            label: "Small Business Support",
            plainEnglish: "Markey supports access to capital for small businesses and protections against being crushed by dominant online platforms like Amazon, which can undercut small sellers or demote their products in search results.",
            whyItMatters: "Small businesses across Massachusetts — from Lowell to the Cape — were devastated by COVID and are still recovering. Business owners are searching for relief programs, fair lending, and protection from corporate consolidation in ways that affect their livelihoods daily.",
            alignment: 78,
            stance: "Supports small business access to credit and antitrust protections from big tech platforms.",
            detail: "Backed SBA relief programs during COVID. Supports the American Innovation and Choice Online Act to prevent dominant platforms from favoring their own products over small sellers. Advocates for Community Development Financial Institutions (CDFIs) that serve underserved small businesses in Gateway Cities.",
            voteRecord: [
              { bill: "American Rescue Plan (small business)", year: 2021, vote: "Yes" },
              { bill: "American Innovation and Choice Online Act", year: 2022, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── ENVIRONMENT & CLIMATE ───────── */
      {
        id: "environment",
        topic: "Environment & Climate",
        icon: "🌱",
        subIssues: [
          {
            id: "climate-emissions",
            label: "Climate Change & Emissions",
            plainEnglish: "Markey co-authored the Green New Deal — the most ambitious climate and jobs proposal in U.S. history. He believes climate change is a genuine emergency that requires transforming the entire economy, not just incremental adjustments.",
            whyItMatters: "Rising seas, more intense storms, and summer heat waves are already hitting Massachusetts. Boston's waterfront, the South Shore, and the Cape all face flooding risk. People are searching 'climate change Boston flooding' and 'Green New Deal explained' — and Markey is the senator most identified with this fight.",
            alignment: 97,
            stance: "Strongly supports rapid decarbonization. Co-authored the Green New Deal.",
            detail: "Co-introduced the Green New Deal resolution with Rep. Alexandria Ocasio-Cortez. Voted for the Inflation Reduction Act's $369 billion in clean energy investments. Supports net-zero emissions by 2050 with binding 2030 interim targets. Has pushed for a Just Transition that ensures fossil fuel workers have jobs in the clean energy economy.",
            voteRecord: [
              { bill: "Green New Deal Resolution", year: 2019, vote: "Introduced" },
              { bill: "Inflation Reduction Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "offshore-wind",
            label: "Offshore Wind & Renewable Energy",
            plainEnglish: "Markey has championed offshore wind energy off the Massachusetts coast for over a decade — long before it became mainstream. He argues it will create thousands of local jobs, lower electricity bills, and dramatically cut carbon emissions.",
            whyItMatters: "Vineyard Wind, South Fork Wind, and other projects off Massachusetts are now live news — involving jobs, fishing communities, coastal visuals, and electricity prices. Workers, fishermen, and homeowners are all searching for what offshore wind means for them.",
            alignment: 95,
            stance: "Strongly supports offshore wind expansion and has championed it for over a decade.",
            detail: "Has advocated for offshore wind energy since the early 2010s. Backed offshore wind provisions in the Inflation Reduction Act and the Infrastructure Investment and Jobs Act. Supports streamlined federal permitting and buy-American manufacturing requirements for turbines and cables. Has worked with fishing communities to address concerns about siting impacts.",
            voteRecord: [
              { bill: "Inflation Reduction Act (offshore wind)", year: 2022, vote: "Yes" },
              { bill: "BUILD GREEN Infrastructure and Jobs Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "environmental-justice",
            label: "Environmental Justice",
            plainEnglish: "Low-income communities and communities of color near highways, power plants, and industrial sites in Massachusetts — like Chelsea, East Boston, and Lawrence — bear a disproportionate share of pollution and its health effects. Markey advocates for policies that specifically target investment and cleanup in these communities.",
            whyItMatters: "Asthma rates near Boston's highways and industrial corridors are among the highest in the state. Residents in environmental justice communities are searching for accountability from elected officials — not just promises. This is a health issue, an economic issue, and a racial justice issue.",
            alignment: 92,
            stance: "Strongly supports environmental justice investment and frontline community protections.",
            detail: "Backed the Environmental Justice for All Act. Supported Justice40 commitments in the Inflation Reduction Act. Has worked specifically on air quality and Superfund cleanup in Massachusetts environmental justice communities. Supports community right-to-know provisions requiring industrial facilities to disclose emissions data.",
            voteRecord: [
              { bill: "Environmental Justice for All Act", year: 2021, vote: "Yes" },
              { bill: "Inflation Reduction Act (EJ provisions)", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "fossil-fuels",
            label: "Oil, Gas & Fossil Fuel Policy",
            plainEnglish: "Markey opposes new oil and gas drilling on federal lands and waters, and wants to end the billions in annual tax breaks the federal government gives to fossil fuel companies — arguing those subsidies make no sense when the climate is in crisis.",
            whyItMatters: "Gas price spikes, oil company record profits, and pipeline debates have made fossil fuel policy impossible to ignore. People are connecting their energy bills to federal policy and searching 'why is gas so expensive' and 'oil company subsidies' — and Markey has been vocal on both.",
            alignment: 88,
            stance: "Opposes new fossil fuel drilling and supports ending fossil fuel subsidies.",
            detail: "Co-authored legislation to end fossil fuel subsidies through the End Polluter Welfare Act. Backed the Inflation Reduction Act's methane emission fee on oil and gas producers. Opposes new LNG export terminals and oil drilling in the Arctic. One of the Senate's strongest voices for keeping fossil fuels in the ground.",
            voteRecord: [
              { bill: "Inflation Reduction Act (methane fee)", year: 2022, vote: "Yes" },
              { bill: "End Polluter Welfare Act", year: 2021, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── TAXES & GOVERNMENT SPENDING ──── */
      {
        id: "taxes",
        topic: "Taxes & Government Spending",
        icon: "💰",
        subIssues: [
          {
            id: "wealth-tax",
            label: "Wealth Tax & Corporate Taxes",
            plainEnglish: "Markey supports making the ultra-wealthy and large corporations pay more in taxes — arguing they've benefited most from the economy while regular workers have seen their share shrink. He backed Warren's wealth tax proposal and the corporate minimum tax in the Inflation Reduction Act.",
            whyItMatters: "Billionaire wealth has grown exponentially while wages stagnated. People are searching 'why don't billionaires pay taxes' and 'how much do corporations pay in taxes' — and there's a widespread sense that the system is rigged. Markey is one of the senators most vocal about fixing it.",
            alignment: 90,
            stance: "Supports wealth tax, corporate minimum tax, and reversing regressive tax cuts.",
            detail: "Backed the Inflation Reduction Act's 15% corporate minimum tax, ensuring large corporations pay at least some federal tax. Supports the Ultra-Millionaire Tax Act introduced by Warren. Advocates for reversing the 2017 Tax Cuts and Jobs Act's corporate rate cuts. Supports closing carried interest and step-up-in-basis loopholes used by the wealthy.",
            voteRecord: [
              { bill: "Inflation Reduction Act (corporate minimum tax)", year: 2022, vote: "Yes" },
              { bill: "Ultra-Millionaire Tax Act", year: 2021, vote: "Yes" },
            ],
          },
          {
            id: "social-security",
            label: "Social Security & Medicare",
            plainEnglish: "Markey has voted against every attempt to cut Social Security or Medicare in his 47+ years in Congress. He also supports expanding Social Security benefits — not just preserving them — by having high earners pay more into the system.",
            whyItMatters: "Seniors and workers nearing retirement are constantly searching 'will Social Security be there for me' and 'Medicare cuts.' With funding shortfalls projected in the 2030s, this is an urgent issue for millions of Massachusetts residents.",
            alignment: 95,
            stance: "Strongly opposes Social Security and Medicare cuts. Supports expanding benefits.",
            detail: "Decades-long record of opposing any reductions to Social Security or Medicare. Co-sponsored the Social Security Expansion Act. Backed Medicare drug price negotiation in the Inflation Reduction Act, directly reducing costs for seniors. Opposes raising the retirement age and supports strengthening the Social Security Trust Fund through progressive revenue increases.",
            voteRecord: [
              { bill: "Inflation Reduction Act (Medicare drug pricing)", year: 2022, vote: "Yes" },
              { bill: "Social Security Expansion Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "deficit-spending",
            label: "Federal Budget & Deficit",
            plainEnglish: "Markey believes the U.S. should invest in people, climate, and infrastructure — and pay for it by taxing the wealthy rather than cutting programs. He's opposed government shutdown threats and debt ceiling brinkmanship that puts ordinary people's benefits at risk.",
            whyItMatters: "Government shutdowns, debt ceiling standoffs, and battles over the federal budget make news every year. People search 'what happens in a government shutdown' and 'what is the debt ceiling' — and want representatives who will protect their benefits rather than use them as bargaining chips.",
            alignment: 62,
            stance: "Supports investment offset by progressive taxes, not cuts to social programs.",
            detail: "Voted for the Inflation Reduction Act, which was projected to reduce the deficit by $300 billion over 10 years via new corporate and high-income taxes. Opposes using debt ceiling negotiations to extract cuts to Social Security, Medicare, or Medicaid. Supports pay-as-you-go rules with progressive revenue mechanisms.",
            voteRecord: [
              { bill: "Inflation Reduction Act (deficit provisions)", year: 2022, vote: "Yes" },
              { bill: "Debt Ceiling Responsibility Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "drug-pricing",
            label: "Prescription Drug Prices",
            plainEnglish: "Markey has fought for decades to allow Medicare to negotiate drug prices — something every other developed country does. The Inflation Reduction Act finally made this happen, and he supported it. He also backed capping insulin at $35/month for Medicare patients.",
            whyItMatters: "Insulin rationing stories — people dying because they couldn't afford a drug that costs $3 to make — became a rallying point in American politics. 'Why is insulin so expensive' and 'Medicare drug prices' are consistently high-search queries. Massachusetts has major pharmaceutical companies and millions of patients affected by drug pricing.",
            alignment: 95,
            stance: "Strongly supports Medicare drug price negotiation and insulin price caps.",
            detail: "Long-time advocate for Medicare drug price negotiation. Voted for the Inflation Reduction Act, which gave Medicare this power for the first time. Supported the $35/month insulin cap for Medicare patients and has pushed to extend it to all Americans. Supports allowing drug importation from Canada as an additional cost-reduction mechanism.",
            voteRecord: [
              { bill: "Inflation Reduction Act (drug pricing)", year: 2022, vote: "Yes" },
              { bill: "Insulin Price Reduction Act", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

      /* ── TECHNOLOGY & PRIVACY ────────── */
      {
        id: "technology",
        topic: "Technology & Privacy",
        icon: "💻",
        subIssues: [
          {
            id: "ai-regulation",
            label: "Artificial Intelligence Regulation",
            plainEnglish: "AI tools are being used to make decisions about hiring, credit, bail, and healthcare. Markey supports rules requiring companies to audit their AI systems for bias and be transparent about how they work — especially when AI decisions affect people's lives.",
            whyItMatters: "AI regulation is one of the fastest-growing political search topics. People are asking 'can AI decide if I get a job or a loan,' 'who regulates AI,' and 'what is the AI bill' — as these systems make consequential decisions with minimal oversight.",
            alignment: 82,
            stance: "Supports federal AI accountability, bias audits, and transparency requirements.",
            detail: "Backed the Algorithmic Accountability Act, which would require companies to audit automated systems for accuracy and bias. Chairs the subcommittee with jurisdiction over AI and technology. Supports the FTC having clear authority to regulate harmful AI applications. Has raised specific concerns about AI in hiring, healthcare, and criminal justice contexts.",
            voteRecord: [
              { bill: "Algorithmic Accountability Act", year: 2022, vote: "Yes" },
              { bill: "AI Accountability Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "data-privacy",
            label: "Data Privacy & Surveillance",
            plainEnglish: "Markey authored COPPA — the main federal law protecting children's privacy online — and has fought for stronger data privacy protections for decades. He wants a federal law giving all Americans the right to know what data is collected about them and to have it deleted.",
            whyItMatters: "Every phone app, website, and smart device collects data. Location data, health data, and browsing history are sold to brokers and advertisers without most people knowing. 'How do I delete my data' and 'what does my phone know about me' are persistently searched. The U.S. still has no comprehensive federal privacy law.",
            alignment: 93,
            stance: "Strongly supports comprehensive federal data privacy law and surveillance limits.",
            detail: "Author of COPPA (Children's Online Privacy Protection Act). Backed the American Data Privacy and Protection Act (ADPPA). Supports reauthorization of Section 702 surveillance only with strong warrant requirements. Has consistently pushed for commercial surveillance limits and government data purchase restrictions.",
            voteRecord: [
              { bill: "American Data Privacy and Protection Act", year: 2022, vote: "Yes" },
              { bill: "Fourth Amendment Is Not For Sale Act", year: 2023, vote: "Yes" },
            ],
          },
          {
            id: "big-tech-antitrust",
            label: "Big Tech & Antitrust",
            plainEnglish: "Markey supports breaking up or more tightly regulating dominant tech companies like Google, Amazon, Apple, and Meta — arguing that their market power harms competition, crushes small businesses, and gives them too much influence over public information.",
            whyItMatters: "Major antitrust cases against Google and Amazon are active in U.S. courts right now. People are searching 'Google antitrust ruling' and 'Amazon monopoly' — and want to know which senators are pushing for accountability vs. protecting tech companies.",
            alignment: 86,
            stance: "Supports stronger antitrust enforcement and platform competition rules.",
            detail: "Backed the American Innovation and Choice Online Act, which would ban dominant platforms from favoring their own products. Supports updated merger review standards. Advocates for FTC and DOJ antitrust enforcement funding. His committee jurisdiction over commerce and communications gives him direct influence over tech regulation.",
            voteRecord: [
              { bill: "American Innovation and Choice Online Act", year: 2022, vote: "Yes" },
              { bill: "Platform Competition and Opportunity Act", year: 2022, vote: "Yes" },
            ],
          },
          {
            id: "social-media-youth",
            label: "Social Media & Youth Safety",
            plainEnglish: "Markey authored the original COPPA law protecting kids online and is now pushing to update it for the social media era. He wants platforms to stop targeting children with addictive algorithmic recommendations and give parents meaningful control.",
            whyItMatters: "Senate hearings on teen social media harm have been some of the most-watched congressional moments in years. Parents are searching 'social media mental health teens' and 'how to protect my kid online' — and Markey is the senator who literally wrote the original children's online privacy law.",
            alignment: 92,
            stance: "Strongly supports youth online safety legislation and COPPA modernization.",
            detail: "Authored the original COPPA law in 1998 and led the push for COPPA 2.0 to cover social media. Backed the Kids Online Safety Act (KOSA). Supports requiring algorithmic transparency for minors and age-appropriate design standards. Has held multiple hearings with tech executives on youth mental health and platform design.",
            voteRecord: [
              { bill: "Kids Online Safety Act (KOSA)", year: 2023, vote: "Yes" },
              { bill: "COPPA 2.0", year: 2023, vote: "Yes" },
            ],
          },
        ],
      },

    ], // end opinions

    /* ── SOURCES ─────────────────────────────── */
    sources: [
      {
        name: "U.S. Senate Official Vote Record",
        url: "https://www.senate.gov/legislative/votes_new.htm",
        bias: "nonpartisan",
        type: "government",
        description: "Official congressional voting record. Every vote in this profile can be cross-referenced here by bill name and date. No editorializing — raw vote tallies only.",
      },
      {
        name: "OpenSecrets — Markey Profile",
        url: "https://www.opensecrets.org/members-of-congress/ed-markey/summary?cid=N00000270",
        bias: "nonpartisan",
        type: "nonprofit",
        description: "Nonpartisan campaign finance tracking. Source for all funding figures on this page. Covers Markey's 47+ year career in elected office including both House and Senate fundraising.",
      },
      {
        name: "GovTrack — Markey Voting Record",
        url: "https://www.govtrack.us/congress/members/edward_markey/400253",
        bias: "nonpartisan",
        type: "nonprofit",
        description: "Independent legislative tracker. Automated, non-editorialized bill and vote data. Markey's decades of House and Senate votes are all logged here.",
      },
      {
        name: "PolitiFact — Markey Fact Checks",
        url: "https://www.politifact.com/personalities/ed-markey/",
        bias: "center",
        type: "factcheck",
        description: "Pulitzer Prize-winning fact-checker rated 'Center' by Ad Fontes Media. Has reviewed Markey's public statements, particularly around climate, broadband, and healthcare claims.",
      },
      {
        name: "FactCheck.org — Markey",
        url: "https://www.factcheck.org/?s=ed+markey",
        bias: "center",
        type: "factcheck",
        description: "University of Pennsylvania's Annenberg Public Policy Center. Nonpartisan, nonprofit fact-checking with publicly documented methodology. Covers major Markey policy claims.",
      },
      {
        name: "AP News — Markey Coverage",
        url: "https://apnews.com/ed-markey",
        bias: "center",
        type: "wire",
        description: "Nonprofit wire service rated 'Center' by multiple media bias evaluators. Used by both left- and right-leaning outlets. Provides baseline factual reporting on Markey's legislation and public record.",
      },
      {
        name: "Boston Globe — Markey Coverage",
        url: "https://www.bostonglobe.com/topic/edmarkey/",
        bias: "center-left",
        type: "newspaper",
        description: "Massachusetts's primary newspaper of record. Rated 'Lean Left' by AllSides. Provides the most in-depth local coverage of Markey's Massachusetts impact — particularly on broadband, climate, and housing issues.",
      },
      {
        name: "The Wall Street Journal — Markey Coverage",
        url: "https://www.wsj.com/search?query=ed+markey",
        bias: "center-right",
        type: "newspaper",
        description: "Rated 'Center-Right' (news pages) by Ad Fontes Media. Provides a market and industry perspective on Markey's telecom, energy, and trade positions — useful counterbalance to left-leaning outlets.",
      },
      {
        name: "Ballotpedia — Ed Markey",
        url: "https://ballotpedia.org/Ed_Markey",
        bias: "nonpartisan",
        type: "nonprofit",
        description: "Nonpartisan political encyclopedia covering Markey's full career, election results, committee assignments, and sponsored legislation from 1976 to present.",
      },
      {
        name: "Congress.gov — Markey Sponsored Legislation",
        url: "https://www.congress.gov/member/edward-markey/M000133",
        bias: "nonpartisan",
        type: "government",
        description: "Official federal government database of all bills Markey has sponsored or co-sponsored across his 47+ year congressional career. Primary source for legislative claims.",
      },
    ],

    /* ── MISCONCEPTIONS ──────────────────────── */
    misconceptions: [
      {
        category: "Green New Deal",
        myth: "The Green New Deal would immediately ban gas stoves, cars, and air travel.",
        mythSourceLabel: "Fox News — 'Green New Deal bans' coverage (2023)",
        mythSourceUrl: "https://www.foxnews.com/politics/green-new-deal",
        reality: "The Green New Deal is a non-binding resolution — it sets goals, not mandates. It contains no ban on gas stoves, cars, or planes. It calls for net-zero emissions 'as much as technologically feasible,' with a 10-year mobilization period. No implementing legislation has been passed. The 'gas stove ban' claim came from a separate, unrelated Consumer Product Safety Commission discussion in 2023.",
        sourceLabel: "Congress.gov — GND Resolution Text (2019)",
        sourceUrl: "https://www.congress.gov/bill/116th-congress/house-concurrent-resolution/109/text",
      },
      {
        category: "Policy Record",
        myth: "Markey wants to defund the police.",
        mythSourceLabel: "Republican opposition research during 2020 MA primary",
        mythSourceUrl: "https://www.bostonglobe.com/2020/08/27/metro/race-between-markey-kennedy-ends-today/",
        reality: "Markey has never introduced or voted for any legislation to eliminate police funding. He backed the George Floyd Justice in Policing Act, which focused on accountability measures — body cameras, chokehold bans, and qualified immunity reform — not budget cuts. Markey has explicitly stated he does not support defunding the police.",
        sourceLabel: "GovTrack — Markey vote record",
        sourceUrl: "https://www.govtrack.us/congress/members/edward_markey/400253",
      },
      {
        category: "Tenure & Relevance",
        myth: "Markey is too old and out of touch to be effective — he's basically retired in office.",
        mythSourceLabel: "Boston Globe — 2020 primary coverage",
        mythSourceUrl: "https://www.bostonglobe.com/2020/08/27/metro/race-between-markey-kennedy-ends-today/",
        reality: "Markey, born in 1946, co-authored the Green New Deal in 2019 at age 72. He chaired the Senate Foreign Relations subcommittee on East Asia and the Judiciary subcommittee on Privacy & Technology simultaneously. His 2020 re-election primary — which he won — centered heavily on his legislative productivity. GovTrack scores him above average for bill sponsorship among senators.",
        sourceLabel: "GovTrack — Markey legislative stats",
        sourceUrl: "https://www.govtrack.us/congress/members/edward_markey/400253",
      },
      {
        category: "Climate & Energy",
        myth: "The Green New Deal would cost $93 trillion and bankrupt the country.",
        mythSourceLabel: "American Action Forum — cost estimate report (2019)",
        mythSourceUrl: "https://www.americanactionforum.org/research/the-green-new-deal-an-economic-analysis/",
        reality: "The $93 trillion figure came from a 2019 American Action Forum study that made speculative assumptions not supported by the resolution's text. The Green New Deal is a non-binding goals document — it has no price tag because it contains no spending provisions. Independent economists note the cost of inaction on climate change (increased disaster relief, health costs, infrastructure damage) would also run into tens of trillions over the same period.",
        sourceLabel: "FactCheck.org — GND cost claims (2019)",
        sourceUrl: "https://www.factcheck.org/2019/03/how-much-would-the-green-new-deal-cost/",
      },
      {
        category: "Broadband & Tech",
        myth: "Markey's support for net neutrality would give the government control of the internet.",
        mythSourceLabel: "Competitive Enterprise Institute — net neutrality opposition",
        mythSourceUrl: "https://cei.org/opeds_articles/the-real-threat-to-internet-freedom/",
        reality: "Net neutrality rules — which Markey has championed — prohibit internet service providers (like Comcast and Verizon) from slowing down, blocking, or charging extra for specific websites. The rules apply to ISPs, not to content on the internet itself. No net neutrality regulation has ever given any government agency the ability to remove content from the internet or monitor browsing activity.",
        sourceLabel: "FCC.gov — Net Neutrality explained",
        sourceUrl: "https://www.fcc.gov/consumers/guides/open-internet",
      },
      {
        category: "Foreign Policy",
        myth: "Markey is weak on defense because he voted against some defense bills.",
        mythSourceLabel: "Senate.gov — NDAA vote record",
        mythSourceUrl: "https://www.senate.gov/legislative/votes_new.htm",
        reality: "Markey has voted for the National Defense Authorization Act (NDAA) — the main annual defense funding bill — consistently. His 'no' votes on specific defense matters have targeted specific provisions: arms sales to Saudi Arabia, open-ended war authorizations, and certain procurement items. Opposing unlimited military powers is not the same as opposing national defense.",
        sourceLabel: "Senate.gov vote records",
        sourceUrl: "https://www.senate.gov/legislative/votes_new.htm",
      },
    ],
  }, // end markey

];
