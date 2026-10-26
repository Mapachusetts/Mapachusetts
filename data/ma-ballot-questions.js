// CURATED BY HAND. Not generated. Do not overwrite from a script.
//
// What this is: every question on Massachusetts voters' Nov. 3, 2026 ballots that
// could be verified, in plain language and neutral wording: the nine statewide
// questions, plus the non-binding "public policy" question about legislative
// stipends that appears only in eight state House districts.
//
// Where it came from (see MA_QUESTIONS_META.sources and each question's `sources`):
//   - Official ballot text (summary, "A YES VOTE would..." / "A NO VOTE would...") as
//     printed in the Secretary of the Commonwealth's 2026 Information for Voters
//     booklet, read from two municipal copies (Boston.gov and Somerville) that match
//     each other word for word.
//   - The text of each initiative petition on malegislature.gov (effective dates).
//   - The Secretary's "Guide to Statewide Ballot Questions" (effective-date and
//     passage rules).
//   - Independent reporting and analysis: Tufts Center for State Policy Analysis,
//     Ballotpedia, WBUR, CBS Boston, The Reading Observer, Winchester News.
//
// Who verified it and when: compiled and cross-checked on 2026-10-24 by Kiro (an AI
// assistant) for the Mapachusetts project. Each question was checked against at least
// two independent sources. sec.state.ma.us and mass.gov block scripts, so the
// Secretary's own web pages could not be read directly (links are included so a
// person can open them). No human election official or lawyer has reviewed this file.
// Have a person re-check it against the Information for Voters booklet before it is
// shown to the public at scale.
//
// How to update it (edit by hand):
//   1. Open each question's official page (links in `sources`) and the booklet.
//   2. Compare title, summary, YES/NO wording, effective date and fiscal statement
//      with the entry. Fix the entry; keep each text short enough for a phone.
//   3. Change `asOf` in MA_QUESTIONS_META and `verifiedOn` on every entry you
//      re-checked. Add a line to `notes` for anything that disagreed between sources.
//   4. Check it still loads (macOS):
//        /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m <wrapper.mjs>
//      where the wrapper imports { MA_QUESTIONS } from this file and prints each title.
//   5. Never add opinion, predictions, or a judgment of whether an argument is accurate.
//      Arguments are only attributed one-liners from the official booklet.

const OFFICIAL_Q = (n) => ({
  label: "Secretary of the Commonwealth: Information for Voters, Question " + n + " (official page; blocked to scripts, not machine-read)",
  url: "https://www.sec.state.ma.us/divisions/elections/research-and-statistics/2026-Information-for-voters/2026-ballot-question" + n + ".htm",
});
const BOSTON_GOV = {
  label: "City of Boston: 2026 State Election Ballot Questions (copy of the official ballot text)",
  url: "https://www.boston.gov/news/2026-state-election-ballot-questions",
};
const SOMERVILLE = {
  label: "City of Somerville: 2026 State Election Ballot Questions (copy of the official ballot text)",
  url: "https://www.somervillema.gov/ballot-questions-2026",
};
const LEG = (n, q) => ({
  label: "Massachusetts Legislature: text of the petition for Question " + q + " (House No. " + n + ")",
  url: "https://malegislature.gov/Bills/194/H" + n + ".pdf",
});
const SOS_GUIDE = {
  label: "Secretary of the Commonwealth: Guide to Statewide Ballot Questions 2025-26 (effective-date and passage rules)",
  url: "https://www.sec.state.ma.us/divisions/elections/download/getting-on-the-ballot/Guide-to-Statewide-Ballot-Questions-2025-26.pdf",
};
const TUFTS = {
  label: "Tufts Center for State Policy Analysis: Voters' Guide to 2026 Massachusetts Ballot Questions",
  url: "https://tischcollege.tufts.edu/take-action/vote/voters-guide-2026-massachusetts-ballot-questions",
};
const WINCHESTER = {
  label: "Winchester News: guide to the Nov. 3 election (summarizes the booklet, fiscal statements, effective dates)",
  url: "https://winchesternews.org/winchester-news-guide-to-the-nov-3-election-two-new-senators-one-house-race-and-nine-questions/",
};
const CBS = {
  label: "CBS Boston: Massachusetts ballot question guide for the 2026 election",
  url: "https://www.cbsnews.com/boston/news/massachusetts-ballot-question-guide-2026-election/",
};
const BALLOTPEDIA = (label, url) => ({ label: "Ballotpedia: " + label, url });
const READING = (label, url) => ({ label: "The Reading Observer: " + label, url });

export const MA_QUESTIONS_META = {
  asOf: "2026-10-24",
  electionDate: "2026-11-03",
  verifiedBy:
    "Kiro (AI assistant), 2026-10-24: official ballot text read from two municipal copies of the Secretary of the Commonwealth's Information for Voters booklet (Boston.gov, Somerville); effective dates read from the Legislature's petition texts and the Secretary's Guide to Statewide Ballot Questions; every question cross-checked against at least two independent sources. sec.state.ma.us and mass.gov were not readable by script. Not reviewed by a human election official.",
  sources: [
    "https://www.boston.gov/news/2026-state-election-ballot-questions",
    "https://www.somervillema.gov/ballot-questions-2026",
    "https://www.sec.state.ma.us/divisions/elections/research-and-statistics/information-for-voters-2026.htm",
    "https://www.sec.state.ma.us/divisions/elections/download/getting-on-the-ballot/Guide-to-Statewide-Ballot-Questions-2025-26.pdf",
    "https://malegislature.gov/Bills/194/H5004.pdf",
    "https://tischcollege.tufts.edu/take-action/vote/voters-guide-2026-massachusetts-ballot-questions",
    "https://ballotpedia.org/Massachusetts_2026_ballot_measures",
    "https://www.cbsnews.com/boston/news/massachusetts-ballot-question-guide-2026-election/",
    "https://winchesternews.org/winchester-news-guide-to-the-nov-3-election-two-new-senators-one-house-race-and-nine-questions/",
    "https://my.lwv.org/massachusetts/concord-carlisle/article/ballot-question-10-concord-carlisle",
    "https://massterlist.com/p/stipend-question-resurfaces-but-without-its-teeth",
  ],
  notes: [
    "Count and numbering: nine statewide questions, numbered 1 to 9 as listed here (Boston.gov, Somerville, League of Women Voters, Ballotpedia, WBUR all agree). Questions 1 to 8 are citizen initiative petitions for a new law that went to voters because the Legislature did not vote on them by May 6, 2026. Question 9 is a referendum on an existing 2024 law, so YES keeps the law and NO repeals it. No constitutional amendment is on the 2026 ballot.",
    "Question 8 is typed 'initiative-repeal' because it is a proposed law whose main effect is repealing the laws that license, regulate and tax retail recreational marijuana (it also sets possession rules). Formally it is an initiative petition for a law, like Questions 1 to 7.",
    "Titles: Somerville's page prints 'Expanding Public Records Laws' (Q1) and 'Firearms Regulations' (Q9); Boston.gov, the League of Women Voters and The Reading Observer print 'Expanding the Public Records Law' and 'Firearms Regulation'. This file uses the majority wording. Check the official page if the exact title matters.",
    "Official wording: summaries and the YES/NO statements are paraphrased from the booklet text. The booklet says the YES/NO statements are co-written by the Secretary and the Attorney General (Secretary's Guide to Statewide Ballot Questions).",
    "Arguments are the booklet's one-line positions, paraphrased and attributed. For Q1, Q2 and Q6 no organized group filed an argument against, so the Secretary's office compiled it (in part from the legislative committee's report); the booklet says that does not reflect the office's opinion. Home News said the Q2 argument came from a 'minority report' while The Reading Observer said majority report; this file does not say which. Q9 has no legislative committee reports; the district stipend question is not in the booklet, so it has no arguments here.",
    "Effective dates come from the petition text on malegislature.gov: Q1 Jan. 1, 2027; Q3 Jan. 1, 2028; Q4 Jan. 1, 2028; Q5 July 1, 2027; Q6 July 1, 2027 (100% share from July 1, 2028); Q8 Jan. 1, 2028. Q2 and Q7 name no date, so the Constitution's default applies: 30 days after the election. The Secretary's guide says courts have not settled whether that 30 days counts from Election Day or from certification of results. A referendum repeal (Q9 if NO wins) takes effect when results are certified.",
    "Passage rule (Secretary's guide): an initiative passes if a majority votes YES and YES votes are at least 30% of all ballots cast. A referendum is repealed only if a majority votes NO and NO votes are at least 30% of all ballots cast.",
    "Nothing in any question changes how you register, vote early, or vote by mail for the Nov. 3, 2026 election. The two that touch voting, Q3 (primaries) and Q4 (Election Day registration), start Jan. 1, 2028. For Nov. 3, 2026 the normal registration deadline is Oct. 24, 2026 (online until 11:59 p.m.), and early voting runs Oct. 17 to Oct. 30 (Winchester News, The Reading Observer). The Sept. 1, 2026 state primary has already been held. Q4's official summary describes registering at the polling place on Election Day only; it does not mention early voting or mail ballots.",
    "Source disagreement, same-day registration: a Home News article says Massachusetts already offers same-day registration during early voting. That conflicts with the 10-day registration deadline reported by the Secretary's materials as summarized by Tufts, CBS, Winchester News and The Reading Observer, so it is not used. Articles also give different counts of states that allow same-day registration (17 other states, 21 plus DC, 23 plus DC, 'more than 20'); no count is used here.",
    "Source disagreement, Question 8 and home growing: the official summary does not mention growing at home. WBUR says home cultivation would remain legal; Ballotpedia, Forbes and some dispensary sites say it would be repealed. The petition text repeals chapters 94G and 64N, which its purpose clause says govern 'possession, use, distribution, cultivation, and taxation', and it tells the Cannabis Control Commission to issue advisory guidelines on growing in a primary residence. Because credible sources conflict, nothing about home growing is stated in the entry. Read the full text of the petition.",
    "Fiscal notes: the booklet's fiscal statements (from the Secretary of Administration and Finance) were read through three reports of the booklet (Reading Observer, Winchester News, Home News). Q6 estimates differ and are shown attributed: the budget office says tens of millions of dollars a year; supporters say as much as $100 million; Tufts says roughly $65 million. WBUR's '$330 million' retail marijuana tax figure is worded ambiguously, so the booklet figures reported by Winchester News ($280 million state, $50 million local, fiscal 2025) are used for Q8.",
    "Pending Legislature action: Tufts reports the Legislature is working on bills that could overlap with Q1 (public records), Q5 (62F refunds) and Q7 (duplexes). Nothing here depends on them.",
    "Ongoing court cases: WBUR reports gun-rights groups have sued over the 2024 law, so a YES vote on Q9 does not guarantee every provision survives future court rulings.",
    "District public policy questions INCLUDED: the legislative-stipends question in eight House districts (13th, 14th, 15th, 20th, 25th, 29th and 32nd Middlesex, and Barnstable-Dukes-Nantucket). The district list was confirmed by two independent sources (League of Women Voters of Concord-Carlisle; MASSterList naming the eight representatives, which match this repo's officeholder data). The question wording is quoted the same way by both. The question is numbered 10, 11 or 12 depending on the community (MASSterList), so `number` is null. It is not in the printed booklet; voters find it on their sample ballot (Town of Concord). Geoids are the same state-plus-district codes used in data/officeholders.ma.generated.js.",
    "District/local questions FOUND BUT NOT INCLUDED because exact ballot wording could not be verified from an official sample ballot or two independent sources: (1) a non-binding single-payer health care question in the 15th Middlesex (Winchester Precinct 6 sees it as Question 10, per Winchester News) and the 1st Hampden (MASSterList only); (2) a non-binding carbon fee with monthly payments question in the 1st and 8th Essex districts (campaign site cleanaircashback.org, a campaign member's op-ed, and local news reporting a nonbinding Question 10 in Marblehead, Swampscott and parts of Lynn; the campaign's own site shows two different versions of the wording); (3) non-binding questions on a statewide social housing authority and on abolishing Norfolk County government (MASSterList says they exist; no district list found); (4) local tax questions, for example Reading's Proposition 2 1/2 operating override of $6.5 million for fiscal year 2028 and a Community Preservation Act 1% surcharge adoption (readingma.gov, The Reading Observer). Other towns also have override, debt-exclusion or CPA questions. This file does not list them. The Secretary's list of public policy questions and each town's sample ballot are the places to check.",
    "Questions of this type can be added later with scope { townGeoids: [...] } (local) or { geoid: '<state+district code>' } (district) once wording is verified.",
  ],
};

export const MA_QUESTIONS = [
  {
    id: "ma-2026:q1",
    number: 1,
    scope: { state: "MA" },
    type: "initiative-law",
    title: "Public records: Legislature and Governor's office",
    officialTitle: "Expanding the Public Records Law",
    summary:
      "Massachusetts' Public Records Law covers state agencies, cities and towns, but not the Legislature or the Governor's office. This measure would cover most of their records. Records about developing public policy, and constituent requests for help with benefits, services or agencies, would be exempt.",
    yesVote:
      "A YES vote would put most records of the Legislature and the Governor's office under the state Public Records Law.",
    noVote:
      "A NO vote would leave the Public Records Law as it is, with no change.",
    whenEffective: "Jan. 1, 2027, if approved.",
    fiscalNote:
      "State budget office (in the booklet): no discernible material fiscal consequences.",
    affectsVoting: false,
    arguments: {
      for: [
        {
          by: "State Auditor Diana DiZoglio, Committee for Transparency and Democracy (official booklet)",
          text: "Says the Legislature and Governor's office should follow the same public records law as every city, town and state agency.",
        },
      ],
      against: [
        {
          by: "Compiled by the Secretary of the Commonwealth's office; no group filed one (official booklet)",
          text: "Says the exemptions are overly broad and poorly defined, could chill lawmakers' communication, and could leave some constituent mail open to disclosure.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(1),
      BOSTON_GOV,
      SOMERVILLE,
      LEG("5004", 1),
      READING("Question 1 (public records)", "https://the-reading-observer.squarespace.com/community-news/nine-questions-await-massachusetts-voters-on-nov-3-starting-with-public-record"),
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 1 (2026)", "https://ballotpedia.org/Massachusetts_Question_1,_Public_Records_Requirements_for_Legislature_and_Governor%E2%80%99s_Office_Initiative_(2026)"),
      WINCHESTER,
    ],
    verifiedOn: "2026-10-24",
  },
  {
    id: "ma-2026:q2",
    number: 2,
    scope: { state: "MA" },
    type: "initiative-law",
    title: "Union rights for public defender agency staff (CPCS)",
    officialTitle: "Collective Bargaining for CPCS Employees",
    summary:
      "The Committee for Public Counsel Services (CPCS) is the state agency that provides lawyers to people who cannot afford one. Its employees are not covered by the state's collective bargaining law now. This measure would let them bargain collectively, and would require CPCS to ask the Governor for the money to fund any agreement it signs.",
    yesVote:
      "A YES vote would let CPCS employees form a union and bargain collectively with their employer.",
    noVote:
      "A NO vote would make no change to the law on labor relations for CPCS employees.",
    whenEffective:
      "The petition names no date, so the Constitution's default applies: 30 days after the Nov. 3 election (courts have not settled whether that counts from Election Day or from certified results).",
    fiscalNote:
      "State budget office (in the booklet): may affect state finances because CPCS is partly state-funded, but the cost is hard to project since it depends on bargaining outcomes.",
    affectsVoting: false,
    arguments: {
      for: [
        {
          by: "Tom McKeever, Labor Unions for Public Counsel Workers Rights (official booklet)",
          text: "Says CPCS employees support the right to counsel but, unlike other state employees, cannot choose to organize; this lets them make that choice.",
        },
      ],
      against: [
        {
          by: "Compiled by the Secretary of the Commonwealth's office; no group filed one (official booklet)",
          text: "Says bargaining could disrupt management structures, blur lines of authority, and limit flexibility to respond to caseloads, staffing and court demands.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(2),
      BOSTON_GOV,
      SOMERVILLE,
      LEG("5009", 2),
      SOS_GUIDE,
      READING("Question 2 (public defenders)", "https://the-reading-observer.squarespace.com/community-news/question-2-asks-voters-whether-public-defenders-can-unionize"),
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 2 (2026)", "https://ballotpedia.org/Massachusetts_Question_2,_Permit_Collective_Bargaining_for_Committee_for_Public_Counsel_Services_Employees_Initiative_(2026)"),
      WINCHESTER,
    ],
    verifiedOn: "2026-10-24",
  },
  {
    id: "ma-2026:q3",
    number: 3,
    scope: { state: "MA" },
    type: "initiative-law",
    title: "One all-party primary, top two advance",
    officialTitle: "State Primary Elections",
    summary:
      "Today each party holds its own primary for state offices. This measure would replace them with one primary listing every candidate, and the top two vote-getters would face off in the general election. Governor and lieutenant governor candidates would run together, and a group whose statewide candidates win at least 3% of primary ballots would count as a political party.",
    yesVote:
      "A YES vote would end separate party primaries for state elections: one primary with all candidates, and the top two advance.",
    noVote:
      "A NO vote would keep the current party primary system.",
    whenEffective:
      "Jan. 1, 2028, if approved. Nothing changes for the Nov. 3, 2026 election; the Sept. 1, 2026 state primary was already held. Tufts reports it would not apply to presidential or municipal elections.",
    fiscalNote:
      "State budget office (in the booklet): no discernible material fiscal consequences.",
    affectsVoting: true,
    arguments: {
      for: [
        {
          by: "Danielle Allen, Coalition for Healthy Democracy (official booklet)",
          text: "Says many races are decided before most people vote, and all-party primaries would make elections more competitive and officials more accountable.",
        },
      ],
      against: [
        {
          by: "Voter Rights MA (official booklet)",
          text: "Says top-two systems in California and Washington favored wealthy self-funded candidates, and voters could end up with two candidates from the same party.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(3),
      BOSTON_GOV,
      SOMERVILLE,
      LEG("5003", 3),
      READING("Question 3 (all-party primaries)", "https://the-reading-observer.squarespace.com/community-news/question-3-would-replace-party-primaries-with-a-single-all-party-ballot"),
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 3 (2026)", "https://ballotpedia.org/Massachusetts_Question_3,_Top-Two_Primary_Elections_Initiative_(2026)"),
      CBS,
      WINCHESTER,
    ],
    verifiedOn: "2026-10-24",
  },
  {
    id: "ma-2026:q4",
    number: 4,
    scope: { state: "MA" },
    type: "initiative-law",
    title: "Register to vote on Election Day",
    officialTitle: "Election Day Registration",
    summary:
      "Right now you must register at least 10 days before an election. This measure would let eligible people register to vote, or update their address, at their own precinct's polling place on Election Day, showing proof of residency (such as a photo ID, utility bill or lease) and signing an oath. Without proof they could cast a provisional ballot, which counts only if they bring proof within 6 days after a state election.",
    yesVote:
      "A YES vote would let eligible citizens register to vote, or update their address, at their polling place on Election Day.",
    noVote:
      "A NO vote would keep the current voter registration laws, including the 10-day deadline.",
    whenEffective:
      "Jan. 1, 2028, if approved. Nothing changes for the Nov. 3, 2026 election: its normal registration deadline is Oct. 24, 2026. The official summary covers registering at the polling place on Election Day only; it does not mention early voting or mail ballots.",
    fiscalNote:
      "State budget office (in the booklet): no material effect on state or municipal finances. Tufts notes cities and towns would carry it out with no new state money.",
    affectsVoting: true,
    arguments: {
      for: [
        {
          by: "Norma B. Shulman, YES on Election Day Registration (official booklet)",
          text: "Says it lets eligible citizens register at the polls, helps people who move often, and adds proof of residence and an oath backed by felony penalties.",
        },
      ],
      against: [
        {
          by: "Amy Carnevale, Massachusetts Republican Party (official booklet)",
          text: "Says it removes the advance period officials use to check identity and residence, so errors could be found only after a ballot is cast.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(4),
      BOSTON_GOV,
      SOMERVILLE,
      LEG("5001", 4),
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 4 (2026)", "https://ballotpedia.org/Massachusetts_Question_4,_Permit_Same-Day_Voter_Registration_Initiative_(2026)"),
      { label: "Winchester News: Winchester provides information on Question 4 (town clerk)", url: "https://winchesternews.org/20261023_winchester-provides-information-on-question-4-election-day-voter-registration/" },
      { label: "Boston.com: Question 4 could allow Mass. voters to register on Election Day", url: "https://www.boston.com/news/local-news/2026/09/28/question-4-could-allow-mass-voters-to-register-on-election-day-heres-what-to-know/" },
      CBS,
    ],
    verifiedOn: "2026-10-24",
  },
  {
    id: "ma-2026:q5",
    number: 5,
    scope: { state: "MA" },
    type: "initiative-law",
    title: "State revenue limit and tax rebates",
    officialTitle: "State Revenue Limit and Rebate",
    summary:
      "A 1986 law (Chapter 62F) caps how fast state tax collections can grow and refunds the excess to taxpayers. This measure would reset the cap each year to the prior year's collections plus the recent average growth in Massachusetts wages and salaries, and refund anything over it the next year. It would also count revenue from the surtax on incomes over $1 million.",
    yesVote:
      "A YES vote would change the state revenue limit to last year's collections plus average wage growth, and rebate any excess.",
    noVote:
      "A NO vote would make no change in the law on state revenue collection.",
    whenEffective: "July 1, 2027, if approved.",
    fiscalNote:
      "Per the booklet as reported by Winchester News: the state budget office says it would leave less money for the state budget, including local aid, and the rainy-day fund. Tufts estimates it would trigger refunds 2 to 4 times as often.",
    affectsVoting: false,
    arguments: {
      for: [
        {
          by: "Taxpayers for an Affordable Massachusetts (official booklet)",
          text: "Says it sets reasonable limits on state revenue growth and returns excess collections to taxpayers without cutting core services.",
        },
      ],
      against: [
        {
          by: "Colette Berard, Protect Massachusetts' Future (official booklet)",
          text: "Says a strict revenue limit could force budget cuts and shrink the Rainy Day fund, and would count millionaires' tax revenue in the formula.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(5),
      BOSTON_GOV,
      SOMERVILLE,
      LEG("5006", 5),
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 5 (2026)", "https://ballotpedia.org/Massachusetts_Question_5,_Change_State_Tax_Revenue_Limit_Initiative_(2026)"),
      WINCHESTER,
      { label: "Boston.com: Massachusetts Ballot Question 5 explained", url: "https://www.boston.com/news/politics/2026/09/30/ma-ballot-question-5-explained/" },
      CBS,
    ],
    verifiedOn: "2026-10-24",
  },
  {
    id: "ma-2026:q6",
    number: 6,
    scope: { state: "MA" },
    type: "initiative-law",
    title: "Nature for All conservation fund",
    officialTitle: "Natural Resource Conservation Fund",
    summary:
      "This measure would create a Nature for All Fund for land and water conservation, parks and trails. Subject to the Legislature's appropriation, it would get 50% of the existing state sales and use tax on sporting goods, recreational vehicles and golf courses at first, and 100% after July 1, 2028. It adds no new tax; a 15-member board would set spending rules.",
    yesVote:
      "A YES vote would create a fund for natural resource conservation that receives some existing sales taxes on sporting goods, recreational vehicles and golf courses.",
    noVote:
      "A NO vote would not create the fund or change how sales and use taxes are spent.",
    whenEffective:
      "July 1, 2027, if approved (the fund's share rises to 100% after July 1, 2028).",
    fiscalNote:
      "State budget office (in the booklet): would divert tens of millions of dollars a year now in the operating budget, plus substantial implementation costs. Supporters say up to $100 million; Tufts estimates about $65 million.",
    affectsVoting: false,
    arguments: {
      for: [
        {
          by: "Mass Audubon and 90+ conservation groups and businesses (official booklet)",
          text: "Says it dedicates up to about $100 million a year of existing sales tax to clean water, land and parks, with no new tax.",
        },
      ],
      against: [
        {
          by: "Compiled by the Secretary of the Commonwealth's office; no group filed one (official booklet)",
          text: "Says it permanently earmarks existing revenue, could displace other priorities, and the Legislature could still decline to fund it.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(6),
      BOSTON_GOV,
      SOMERVILLE,
      LEG("5005", 6),
      READING("Question 6 (conservation fund)", "https://the-reading-observer.squarespace.com/community-news/question-6-would-dedicate-sales-tax-on-sporting-goods-to-a-conservation-fund"),
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 6 (2026)", "https://ballotpedia.org/Massachusetts_Question_6,_Establish_the_Nature_for_All_Fund_Initiative_(2026)"),
      WINCHESTER,
    ],
    verifiedOn: "2026-10-24",
  },
  {
    id: "ma-2026:q7",
    number: 7,
    scope: { state: "MA" },
    type: "initiative-law",
    title: "Single-family homes on smaller lots",
    officialTitle: "Single Family Homes",
    summary:
      "Many towns set their own minimum lot size for single-family homes. This measure would allow a single-family home on a residentially zoned lot of at least 5,000 square feet with 50 feet of street frontage and public water and sewer. Towns could still reasonably regulate things like height, setbacks, open space, parking and short-term rentals. WBUR reports it would not apply in Boston.",
    yesVote:
      "A YES vote would allow single-family homes on lots of 5,000 square feet or more in residential areas, with reasonable local rules on some aspects.",
    noVote:
      "A NO vote would make no change to the law on building single-family homes.",
    whenEffective:
      "The petition names no date, so the Constitution's default applies: about 30 days after the Nov. 3 election (courts have not settled whether that counts from Election Day or from certified results).",
    fiscalNote:
      "Per the booklet as reported: no material state cost; it could add local property tax revenue depending on how many homes are built.",
    affectsVoting: false,
    arguments: {
      for: [
        {
          by: "Wesley Lima, Legalize Starter Homes (official booklet)",
          text: "Says smaller minimum lots would cut costs and allow more affordable homes for young families and seniors where infrastructure exists.",
        },
      ],
      against: [
        {
          by: "Adam Chapdelaine, Massachusetts Municipal Association (official booklet)",
          text: "Says it overrides local planning with one statewide rule, regardless of neighborhood, infrastructure or environmental conditions.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(7),
      BOSTON_GOV,
      SOMERVILLE,
      LEG("5000", 7),
      SOS_GUIDE,
      { label: "WBUR: Question 7 aims to change Mass. zoning law to build more single-family homes", url: "https://www.wbur.org/news/2026/10/07/massachusetts-election-ballot-question-7-starter-homes-small-lots" },
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 7 (2026)", "https://ballotpedia.org/Massachusetts_Question_7,_Limit_on_Required_Lot_Size_for_Single-Family_Homes_Initiative_(2026)"),
      WINCHESTER,
    ],
    verifiedOn: "2026-10-24",
  },
  {
    id: "ma-2026:q8",
    number: 8,
    scope: { state: "MA" },
    type: "initiative-repeal",
    title: "End recreational marijuana sales",
    officialTitle: "Prohibit Retail Sale of Adult Recreational Use Marijuana",
    summary:
      "This measure would repeal the laws that license, regulate and tax retail sales of recreational marijuana, ending legal recreational stores. Adults 21 and older could still possess up to 1 ounce (no more than 5 grams of concentrate) and give that amount to another adult; 1 to 2 ounces would bring a $100 civil penalty. Medical marijuana stays, and licensed recreational businesses could apply to become medical dispensaries.",
    yesVote:
      "A YES vote would end legal retail sales of recreational marijuana and change the penalties for possession.",
    noVote:
      "A NO vote would make no change to the current marijuana laws.",
    whenEffective: "Jan. 1, 2028, if approved.",
    fiscalNote:
      "Per the booklet as reported by Winchester News: the retail marijuana tax raised about $280 million for the state and $50 million for cities and towns in fiscal 2025.",
    affectsVoting: false,
    arguments: {
      for: [
        {
          by: "Jeffrey Morgan, Coalition for a Healthy Massachusetts (official booklet)",
          text: "Says it would stop commercial stores while keeping personal possession and medical marijuana legal, citing driving, workplace and mental health concerns.",
        },
      ],
      against: [
        {
          by: "Ryan Dominguez, Massachusetts Cannabis Coalition (official booklet)",
          text: "Says it would return sales to an unregulated market, increase marijuana arrests, and cost jobs and state tax revenue.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(8),
      BOSTON_GOV,
      SOMERVILLE,
      LEG("5002", 8),
      { label: "WBUR: Question 8, Mass. voters weigh measure that would topple recreational marijuana industry", url: "https://www.wbur.org/news/2026/10/09/massachusetts-ballot-question-8-cannabis-weed-pot-repeal" },
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 8 (2026)", "https://ballotpedia.org/Massachusetts_Question_8,_Eliminate_Recreational_Marijuana_Sales_and_Allow_Limited_Possession_Initiative_(2026)"),
      WINCHESTER,
    ],
    verifiedOn: "2026-10-24",
  },
  {
    id: "ma-2026:q9",
    number: 9,
    scope: { state: "MA" },
    type: "referendum",
    title: "Keep or repeal the 2024 gun law",
    officialTitle: "Firearms Regulation",
    summary:
      "This is a vote on an existing law, the 2024 firearms law (Chapter 135 of the Acts of 2024), passed 124-33 in the House and 35-5 in the Senate. Among many changes, it set serial-number rules and penalties for untraceable 'ghost guns', let school administrators and health care providers seek 'red flag' orders, and widened the definitions of machine guns and assault-style weapons. YES keeps the law; NO repeals it.",
    yesVote:
      "A YES vote would keep the 2024 firearms law in place.",
    noVote:
      "A NO vote would repeal the 2024 firearms law.",
    whenEffective:
      "The law has been in effect since Oct. 2, 2024, with some provisions phased in over time. A YES vote changes nothing. If NO wins, the repeal takes effect when the election results are certified.",
    fiscalNote:
      "Per the booklet as reported by Winchester News: repeal would require the state to unwind training, licensing and computer systems already built.",
    affectsVoting: false,
    arguments: {
      for: [
        {
          by: "Ned Notis-McConarty, Vote Yes for a Safe Massachusetts (official booklet)",
          text: "Says the law bans ghost guns and adds tools to prevent gun suicide and mass shootings, and repealing it would make the state less safe.",
        },
      ],
      against: [
        {
          by: "Toby Leary, Civil Rights Coalition (official booklet)",
          text: "Says the 116-page law is bureaucratic overreach, is unfunded, burdens local police, and the state already had strict gun laws.",
        },
      ],
    },
    sources: [
      OFFICIAL_Q(9),
      BOSTON_GOV,
      SOMERVILLE,
      { label: "Massachusetts Legislature: Acts of 2024, Chapter 135 (An Act Modernizing Firearm Laws)", url: "https://malegislature.gov/Laws/SessionLaws/Acts/2024/Chapter135" },
      SOS_GUIDE,
      { label: "WBUR: Question 9, referendum puts major Mass. gun law before voters", url: "https://www.wbur.org/news/2026/10/06/massachusetts-firearms-question-9-guns-ballot-control-rights" },
      TUFTS,
      BALLOTPEDIA("Massachusetts Question 9 (2026)", "https://ballotpedia.org/Massachusetts_Question_9,_Firearm_Regulations_Referendum_(2026)"),
      CBS,
      WINCHESTER,
    ],
    verifiedOn: "2026-10-24",
  },

  // Non-binding "public policy" question: legislative stipends. Appears only in the
  // eight House districts below. Same wording in each; numbered 10, 11 or 12 by town.
  ...[
    { geoid: "25071", districtName: "13th Middlesex District", extra: [{ label: "Town of Concord: November 3, 2026 State Election (Question 10 is on the sample ballot, not in the booklet)", url: "https://www.concordma.gov/4283/November-3-2026-State-Election" }] },
    { geoid: "25072", districtName: "14th Middlesex District", extra: [{ label: "Town of Concord: November 3, 2026 State Election (Question 10 is on the sample ballot, not in the booklet)", url: "https://www.concordma.gov/4283/November-3-2026-State-Election" }] },
    { geoid: "25073", districtName: "15th Middlesex District", extra: [WINCHESTER] },
    { geoid: "25078", districtName: "20th Middlesex District", extra: [] },
    { geoid: "25083", districtName: "25th Middlesex District", extra: [] },
    { geoid: "25087", districtName: "29th Middlesex District", extra: [] },
    { geoid: "25090", districtName: "32nd Middlesex District", extra: [] },
    { geoid: "25006", districtName: "Barnstable-Dukes-Nantucket District", extra: [] },
  ].map((d) => ({
    id: "ma-2026:pp-stipends:" + d.geoid,
    number: null,
    scope: { geoid: d.geoid, districtName: d.districtName },
    districtName: d.districtName,
    type: "public-policy",
    title: "Legislative stipends (advisory, " + d.districtName + ")",
    officialTitle: null,
    summary:
      "Legislators can receive stipends (extra pay) on top of their salary for leadership or committee roles. This advisory question asks whether your state representative should back changes that reduce the House Speaker's and Senate President's control over those stipends. It does not change any law and appears only in eight House districts.",
    yesVote:
      "A YES vote would tell your state representative you want them to vote for legislation or rules that reduce the Speaker's and Senate President's control over stipends and give stipends only to legislators who do significant, transparent extra work.",
    noVote:
      "A NO vote would give your state representative no such instruction.",
    whenEffective:
      "Not a law and has no start date. The result is advice to the representative and does not require any action.",
    fiscalNote: null,
    affectsVoting: false,
    arguments: null,
    sources: [
      { label: "League of Women Voters of Concord-Carlisle: Ballot Question 10 (lists all eight districts)", url: "https://my.lwv.org/massachusetts/concord-carlisle/article/ballot-question-10-concord-carlisle" },
      { label: "MASSterList: Stipend question resurfaces, but without its teeth (names the eight representatives and quotes the wording)", url: "https://massterlist.com/p/stipend-question-resurfaces-but-without-its-teeth" },
      ...d.extra,
    ],
    verifiedOn: "2026-10-24",
  })),
];
