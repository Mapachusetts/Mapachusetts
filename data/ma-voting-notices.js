// data/ma-voting-notices.js
//
// HAND-CURATED warnings and notices for voting in Massachusetts in the
// Nov. 3, 2026 general election, focused on what is different from the 2024
// general election (and the Sept. 1, 2026 primary) or could still change.
//
// Curated from the sources listed in each notice (court orders and docket
// pages, SCOTUSblog, Brennan Center, Boston.gov and other city/town clerk
// pages, the Secretary of the Commonwealth's public pages that load for
// ordinary browsers, FVAP, USPS statements, and news reports). Each notice has
// at least two sources. Nothing here is scraped; mass.gov returns 403 to
// scripts, so mass.gov URLs are cited only where a search result showed the
// page title/snippet (see META.notes) and are never the only support.
//
// Verified: 2026-10-24 (Saturday).  Election Day: Tue 2026-11-03.
//
// HOW TO UPDATE
//  1. Court status can change daily. Before each release, re-check the
//     Brennan Center case page, the D. Mass. docket (1:26-cv-11549) and
//     SCOTUSblog, then edit ma-2026:mail-usps-rule* and the federal notices.
//  2. Re-read the Boston.gov mail/early-voting/polling pages and one more
//     clerk page; update KEY_DATES and any notice whose dates moved.
//  3. Keep the law / litigation / proposal distinction in the summary text
//     (level "watch" = unsettled; "changed" = differs from the last election).
//  4. Update asOf, statusAsOf and verifiedOn together, and keep >= 2 sources
//     per notice. Delete notices after Nov. 3 (or when they stop applying).
//  5. Do not paraphrase beyond what the sources say; if sources disagree,
//     say so in META.notes instead of picking one silently.

// ---- Source catalog (label + url). Notices reference these by key. ----
const SRC = {
  brennan: { label: "Brennan Center: LWV of Massachusetts v. Trump (case page)", url: "https://www.brennancenter.org/our-work/court-cases/league-women-voters-massachusetts-v-trump-march-2026-mail-voting-executive" },
  scotusblog: { label: "SCOTUSblog: Supreme Court denies request on USPS mail-ballot rule (Sept. 14, 2026)", url: "https://www.scotusblog.com/2026/09/supreme-court-denies-trump-administrations-request-to-implement-parts-of-usps-rule-on-mail-in-vo/" },
  scotusOrder: { label: "Supreme Court order 26A305, Postal Service v. California (Sept. 14, 2026)", url: "https://www.supremecourt.gov/opinions/25pdf/26a305_4g15.pdf" },
  cnbcScotus: { label: "CNBC: Supreme Court rejects bid to lift block on USPS rule (Sept. 14, 2026)", url: "https://www.cnbc.com/2026/09/14/supreme-court-trump-mail-ballots-midterms.html" },
  jurist: { label: "JURIST: Supreme Court rejects DOJ bid to stay injunction", url: "https://www.jurist.org/news/2026/09/us-supreme-court-rejects-doj-bid-to-stay-injunction-blocking-usps-mail-in-ballot-rule/" },
  cbsFirstCircuit: { label: "CBS News: Appeals court rejects request to lift block on USPS rule", url: "https://www.cbsnews.com/news/appeals-court-trump-usps-mail-ballots-first-circuit/" },
  justSecurity: { label: "Just Security: Government's Supreme Court reply brief (with Sept. 13 update on D.D.C. ruling)", url: "https://www.justsecurity.org/156963/usps-mail-ballots-solicitor-general-scotus/" },
  axiosNichols: { label: "Axios: Trump's mail-ballot rules blocked by another federal judge (Sept. 14, 2026)", url: "https://www.axios.com/2026/09/14/trumps-mail-ballot-rules-blocked" },
  justiaAug11: { label: "D. Mass. order of Aug. 11, 2026 (1:26-cv-11549, Doc. 183), via Justia", url: "https://docs.justia.com/cases/federal/district-courts/massachusetts/madce/1:2026cv11549/298449/183/0.pdf" },
  agCampbell: { label: "AG Campbell statement after Supreme Court leaves block in effect (mass.gov)", url: "https://www.mass.gov/news/ag-campbell-issues-statement-after-us-supreme-court-leaves-block-on-postal-services-unlawful-mail-voting-rule-in-effect" },
  eo14399: { label: "Federal Register: Executive Order 14399 (91 FR 17125)", url: "https://www.federalregister.gov/documents/2026/04/03/2026-06601/ensuring-citizenship-verification-and-integrity-in-federal-elections" },

  wburGuide: { label: "WBUR: Your guide to voting in the 2026 general election (Oct. 14, 2026)", url: "https://www.wbur.org/news/2026/10/14/massachusetts-how-to-vote-deadlines-mail-in-early" },
  bostonMail: { label: "Boston.gov: Vote by Mail in Boston", url: "https://www.boston.gov/departments/election/mail-voting-boston" },
  bostonEarly: { label: "Boston.gov: Early Voting in Boston", url: "https://www.boston.gov/departments/elections/early-voting-boston" },
  bostonReminders: { label: "Boston.gov: Election Department reminders ahead of the State Election", url: "https://www.boston.gov/news/city-boston-election-department-issues-reminders-ahead-state-election-issues-call-poll-workers" },
  bostonHowRegister: { label: "Boston.gov: How to register to vote", url: "https://www.boston.gov/departments/elections/how-register-vote" },
  bostonPollingList: { label: "Boston.gov: City of Boston polling locations (Nov. 3, 2026 list)", url: "https://www.boston.gov/departments/elections/city-boston-polling-locations" },
  bostonSeptReminders: { label: "Boston.gov: Election Department reminders ahead of the Sept. 1 primary", url: "https://content.boston.gov/news/city-boston-election-department-issues-reminders-ahead-tuesday-september-1-state-primary" },
  cambridgeMail: { label: "City of Cambridge: Early Voting by Mail", url: "https://www.cambridgema.gov/departments/electioncommission/earlyvoting/earlyvotingbymail" },
  somervilleEarly: { label: "City of Somerville: Make your voting plan for Nov. 3", url: "https://www.somervillema.gov/news/make-your-voting-plan-ma-state-election-nov-3" },
  wcvbDates: { label: "WCVB: Mass. general election 2026 guide (dates)", url: "https://www.wcvb.com/article/massachusetts-general-election-2026-guide/73886807" },
  wcvbDropBox: { label: "WCVB: Where to find ballot drop boxes (2026)", url: "https://www.wcvb.com/article/massachusetts-ballot-drop-box-map-2026-election/74193383" },
  wcvbLongBallot: { label: "WCVB: Secretary of State warns long ballots could slow voting", url: "https://www.wcvb.com/article/massachusetts-election-long-ballot-voting-delays/74111766" },
  wcvbClerk: { label: "WCVB: Clerk confirms lengthy ballots stretch over multiple pages", url: "https://www.wcvb.com/article/long-ballots-multiple-pages-massachusetts-2026/74029500" },
  cbsMail: { label: "CBS Boston: 900,000+ mail-in ballots being sent (Oct. 7, 2026)", url: "https://www.cbsnews.com/boston/news/vote-by-mail-in-ballots-massachusetts-deadlines-application/" },
  wwlp: { label: "WWLP: Mass. mail-in ballots distributed ahead of Nov. 3", url: "https://www.wwlp.com/news/massachusetts/over-600000-mail-in-ballots-sent-to-massachusetts-voters/" },
  cbsRegister: { label: "CBS Boston: You can still register to vote (Oct. 18, 2026)", url: "https://www.cbsnews.com/boston/news/register-to-vote-election-day-massachusetts-new-hampshire-2026/" },
  cbsLength: { label: "CBS Boston: Why voters should expect more time at the polls (Oct. 6, 2026)", url: "https://www.cbsnews.com/boston/news/massachusetts-election-day-2026-lengthy-ballot/" },
  wburRedBook: { label: "WBUR: The state is mailing you its red book (Sept. 14, 2026)", url: "https://www.wbur.org/news/2026/09/14/massachusetts-ballot-questions-red-book" },
  wburPrimaryPrimer: { label: "WBUR: Mass. primary primer (Sept. 1, 2026)", url: "https://www.wbur.org/news/2026/09/01/massachusetts-primary-polling-locations-mail-in-drop-box-contested-races" },
  cbsPrimaryGalvin: { label: "CBS Boston: 'Do not mail,' Galvin says (primary)", url: "https://www.cbsnews.com/boston/news/massachusetts-primary-mail-in-voting-ballots/" },
  wgbhPrimaryGalvin: { label: "GBH: It's too late to mail in ballots, Galvin says (Aug. 27, 2026)", url: "https://www.wgbh.org/news/local/2026-08-27/its-too-late-to-mail-in-ballots-massachusetts-top-election-official-says" },
  nbc2024: { label: "NBC Boston: Key dates for the 2024 general election (Oct. 15, 2024)", url: "https://www.nbcboston.com/news/politics/massachusetts-voter-registration-deadlines/3520528/" },
  statute2024: { label: "M.G.L. c. 54, s. 93 (2024 edition), via Justia", url: "https://law.justia.com/codes/massachusetts/2024/part-i/title-viii/chapter-54/section-93/" },
  flyer2024: { label: "Secretary of the Commonwealth 2024 voter flyer: registration deadline Oct. 26, 2024 (mass.gov)", url: "https://www.mass.gov/doc/10112024-formerly-incarcerated-voters-flyer/download" },
  northAdamsForm: { label: "City of North Adams: Vote by mail / absentee application form", url: "https://www.northadams-ma.gov/Absentee-Ballot-Application-English.pdf" },

  watsonOpinion: { label: "Supreme Court opinion, Watson v. RNC, No. 24-1260 (June 29, 2026)", url: "https://www.supremecourt.gov/opinions/25pdf/24-1260_g3cn.pdf" },
  usvfWatson: { label: "U.S. Vote Foundation: Watson v. RNC decision analysis", url: "https://www.usvotefoundation.org/watson-rnc-ruling-analysis" },
  faegreWatson: { label: "Faegre Drinker: Supreme Court decides Watson v. RNC", url: "https://www.faegredrinker.com/en/insights/publications/2026/6/supreme-court-decides-watson-v-republican-national-committee-et-al" },
  votebeatPostmark: { label: "Votebeat: New USPS postmark guidance and mail voters (lists Massachusetts)", url: "https://www.votebeat.org/2026/01/07/us-postal-service-usps-postmark-rule-impact-mail-voters-absentee-ballots/" },
  uspsPostmark: { label: "USPS: Postmarking Myths and Facts (Jan. 2, 2026)", url: "https://about.usps.com/newsroom/statements/010226-postmarking-myths-and-facts.htm" },
  cnbcPostmark: { label: "CNBC: USPS postmarks can lag mailing dates (Oct. 15, 2026)", url: "https://www.cnbc.com/2026/10/15/usps-postmark-rules-taxpayers-voters.html" },
  ballotpediaPostmark: { label: "Ballotpedia News: USPS postmark rule and mail-in voting (Jan. 9, 2026)", url: "https://news.ballotpedia.org/2026/01/09/heres-what-the-new-u-s-postal-service-rule-on-postmarks-means-for-absentee-mail-in-voting-2/" },
  uspsOct20: { label: "USPS: Business as usual for the 2026 election (Oct. 20, 2026)", url: "https://about.usps.com/newsroom/local-releases/nc/2026/1020-usps-says-its-business-as-usual-for-2026-election.htm" },

  fvapMA: { label: "FVAP: Massachusetts state guide", url: "https://www.fvap.gov/guide/chapter2/massachusetts" },
  usvfMA: { label: "U.S. Vote Foundation: Massachusetts voting requirements", url: "https://www.usvotefoundation.org/state-voter-information/massachusetts" },
  usVotersAbroad: { label: "Center for U.S. Voters Abroad: Massachusetts overseas voting", url: "https://www.usvotersabroad.org/states/massachusetts" },
  arlington2024: { label: "Town of Arlington: How and when ballots are counted (2024)", url: "https://www.arlingtonma.gov/Home/Components/News/News/14606/" },

  secRegister: { label: "Secretary of the Commonwealth: Registering to Vote", url: "https://www.sec.state.ma.us/divisions/elections/voter-resources/registering-to-vote.htm" },
  secId: { label: "Secretary of the Commonwealth: Identification Requirements", url: "https://www.sec.state.ma.us/divisions/elections/voting-information/identification-requirements.htm" },
  secTool: { label: "Secretary of the Commonwealth: My Election Info (polling place lookup)", url: "https://www.sec.state.ma.us/wheredoivotema/bal/myelectioninfo.aspx" },
  shrewsburyVoter: { label: "Town of Shrewsbury: Election and voter information", url: "https://shrewsburyma.gov/349/Election-Voter-Information" },
  danversVoter: { label: "Town of Danvers: Voter registration", url: "https://www.danversma.gov/678/Voter-Registration" },
  telegramId: { label: "Telegram & Gazette: Early voting is open through Oct. 30 (Oct. 20, 2026)", url: "https://www.telegram.com/story/news/politics/elections/issues/2026/10/20/massachusetts-early-voting-runs-through-oct-30-what-you-need-to-vote/92326466007/" },

  bostonComQ4: { label: "Boston.com: Question 4 could allow Election Day registration (Sept. 28, 2026)", url: "https://www.boston.com/news/local-news/2026/09/28/question-4-could-allow-mass-voters-to-register-on-election-day-heres-what-to-know/" },
  whdhQ4: { label: "WHDH: Question 4 would allow same-day voter registration", url: "https://whdh.com/news/question-4-would-allow-same-day-voter-registration/" },
  newtonBeaconQ4: { label: "Newton Beacon: Question 4 asks about same-day registration", url: "https://www.newtonbeacon.org/question-4-asks-should-massachusetts-have-same-day-voter-registration/" },
  wburQ3: { label: "WBUR: Question 3 explainer (Oct. 5, 2026)", url: "https://www.wbur.org/news/2026/10/05/massachusetts-question-3-top-two-state-primary-elections" },
  boston25Q3: { label: "Boston 25 News: Question 3 explained", url: "https://www.boston25news.com/news/local/mass-ballot-question-3-explained-voters-choose-between-party-primaries-all-party-system/QDDYRZ7LVBFL5O3CKC2OSQYUEI/" },
  pioneerQ3: { label: "Pioneer Institute: Q3 and all-party primaries", url: "https://pioneerinstitute.org/q3-would-all-party-primaries-fix-massachusetts-politics/" },
  cbsQuestions: { label: "CBS Boston: Ballot question guide (Oct. 21, 2026)", url: "https://www.cbsnews.com/boston/news/massachusetts-ballot-question-guide-2026-election/" },

  npr: { label: "NPR: Administration still aims to make state citizenship lists (Sept. 3, 2026)", url: "https://www.npr.org/2026/09/03/nx-s1-5955822/voting-citizenship-lists-dhs-uscis-lawsuit" },
  epic: { label: "EPIC: EPIC v. USCIS (D. Md.) case page", url: "https://epic.org/documents/epic-v-uscis/" },
  ddNotice: { label: "Democracy Docket: Order requiring 30 days' notice before releasing citizenship lists", url: "https://www.democracydocket.com/news-alerts/trump-admin-was-ordered-to-give-30-days-notice-before-releasing-citizenship-lists-it-might-not-comply/" },
  ddCase: { label: "Democracy Docket: EPIC v. USCIS case tracker", url: "https://www.democracydocket.com/cases/trump-mail-voting-citizenship-list-challenge/" },
  apDoj: { label: "AP: DOJ loses another lawsuit seeking a state's voter data (Massachusetts)", url: "https://apnews.com/article/voter-roll-data-doj-privacy-elections-massachusetts-b4eefdcac577965913f3e4969bcbb7a6" },
  bostonComDoj: { label: "Boston.com: Federal judge dismisses DOJ lawsuit seeking Mass. voter data", url: "https://www.boston.com/news/politics/2026/04/09/a-federal-judge-dismisses-another-doj-lawsuit-seeking-voter-data-this-time-in-massachusetts/" },
  ntdDoj: { label: "NTD: DOJ appeals dismissal of voter data lawsuit", url: "https://www.ntd.com/doj-appeals-dismissal-of-voter-data-lawsuit_1149757.html" },
};

const ASOF = "2026-10-24";

// ---- Meta ----
export const MA_VOTING_NOTICES_META = {
  asOf: ASOF,
  electionDate: "2026-11-03",
  verifiedBy:
    "Manual review on 2026-10-24 of fetched pages (Boston.gov, Cambridge, Secretary of the Commonwealth pages on sec.state.ma.us, Brennan Center, SCOTUSblog, USPS, FVAP, news) plus web searches for developments through Oct. 24. Each notice was cross-checked against at least two sources; date conflicts were resolved against statute-based rules and multiple clerk pages. No bot protections were bypassed; mass.gov (403) pages were not scraped.",
  sources: Object.values(SRC).map((s) => s.url),
  notes: [
    "Court status can change daily. The USPS-rule notices reflect reports through Oct. 24, 2026; no later ruling was found after the Sept. 14 Supreme Court order and the Sept. 13 D.D.C. injunction, but the cases are continuing.",
    "Scope of the Sept. 4 D. Mass. injunction is described differently: Just Security says it bars USPS from implementing the rule during the 2026 election; SCOTUSblog says it lasts while the litigation continues. The notices say both.",
    "Earlier D.C. litigation (NAACP v. USPS) is described differently by the Brennan Center (July 1 injunction, reversed July 17) and by other reports (preliminary injunction denied in May). Only the Sept. 13 Judge Nichols injunction is relied on.",
    "Mail-ballot application deadline is Oct. 27, 2026 (5 p.m., fifth business day before Nov. 3); Boston, Cambridge, WBUR, WCVB, CBS Boston, U.S. Vote Foundation and the Center for U.S. Voters Abroad agree. No source reviewed gave Oct. 28, which would be the fourth business day; treat any Oct. 28 mention as an error.",
    "Domestic mail-ballot receipt is 5 p.m. Fri. Nov. 6 (Boston.gov, FVAP, WBUR correction, 2024 statute text). The U.S. Vote Foundation page lists 8:00 p.m. for that date; the 5 p.m. time was used. WBUR's first version misstated the deadline and was corrected.",
    "A mass.gov summary line ('Nov. 3: deadline to mail or drop off vote by mail ballots') was seen only in a search snippet; it is consistent with the postmark-by-Nov. 3 and drop-box-by-8 p.m. rules but omits the Nov. 6 receipt window that Boston.gov, WBUR and CBS state.",
    "The U.S. Vote Foundation page also lists a 'same day registration & voting' window of Oct. 17-24; this conflicts with every Massachusetts source (no Election Day registration) and was not used.",
    "USPS says its postmark practices have not changed; reporters and election groups say the Dec. 24, 2025 Domestic Mail Manual text and 2025 transportation changes make later postmark dates more likely. Both views are stated in the postmark notice.",
    "Boston polling-place notices rest on two official Boston.gov pages (no independent second source exists for a city's own list). The Ward 2 Precinct 3 street number differs between those pages (46 vs. 20 Winthrop St.), so the notice tells voters to confirm.",
    "Voter ID: no source reviewed describes a 2025-26 change to ID rules at the polls, and no voter ID question is among the nine on the Nov. 3 ballot. The ID notice is labeled info, not same, because no source states the rule is unchanged from 2024.",
    "Federal citizenship lists (EO 14399 Section 2): no source reviewed shows lists delivered to any state as of Oct. 24, but the last dated report was early October; this could not be confirmed either way.",
    "Not included for lack of a second source or Massachusetts relevance: the Sept. 25 Supreme Court order allowing the expanded SAVE citizenship-check system (whether Massachusetts uses it was not found); the Oct. 21 N.D. Cal. order limiting DHS field operations (covers nine states, not Massachusetts); a town-level polling-place move in Westborough (one local report only).",
    "mass.gov and Justia pages (AG Campbell statement, 2024 voter flyer, M.G.L. c. 54 s. 93) are cited from search-result titles and excerpts because those sites block scripted fetches; they are never the only support for a claim.",
    "Several other sources were read through search-result excerpts rather than a full-page fetch: Supreme Court order and Watson opinion, CBS First Circuit story, CNBC Sept. 14, JURIST, Axios, Faegre Drinker, WWLP, Somerville, Shrewsbury, Danvers, Pioneer Institute, WHDH, Newton Beacon, GBH, CBS primary story, Ballotpedia News, Arlington 2024, Federal Register EO 14399, Boston.gov how-to-register. Re-read them in full when updating.",
    "The Secretary of the Commonwealth's online lookup tools (polling place, registration status, ballot tracker) are the authority for individual voters; this file does not replace them.",
  ],
};

// ---- Key dates ----
export const MA_VOTING_KEY_DATES = [
  {
    id: "ma-2026:date-reg-deadline",
    label: "Voter registration deadline",
    date: "2026-10-24",
    time: null,
    rangeEnd: null,
    detail:
      "Saturday, Oct. 24: in person by 5:00 p.m., online by 11:59 p.m., or a mailed form postmarked by Oct. 24. This is 10 days before Election Day; you cannot register on Election Day. In 2024 the deadline was Oct. 26.",
    sources: [SRC.bostonReminders.url, SRC.cbsRegister.url, SRC.wburGuide.url],
  },
  {
    id: "ma-2026:date-reg-new-citizens",
    label: "Late registration for new citizens",
    date: "2026-11-02",
    time: "4:00 p.m.",
    rangeEnd: null,
    detail:
      "People naturalized after the Oct. 24 deadline can register in person at their local election office until 4 p.m. on Monday, Nov. 2, with proof that the ceremony was after the deadline.",
    sources: [SRC.secRegister.url, SRC.shrewsburyVoter.url, SRC.danversVoter.url],
  },
  {
    id: "ma-2026:date-mail-request-deadline",
    label: "Deadline for your election office to receive a mail-ballot request",
    date: "2026-10-27",
    time: "5:00 p.m.",
    rangeEnd: null,
    detail:
      "The request must be received (not just postmarked) by 5 p.m. on Tuesday, Oct. 27, the fifth business day before Nov. 3. In 2024 the same rule gave Oct. 29. Not Oct. 28.",
    sources: [SRC.bostonMail.url, SRC.cambridgeMail.url, SRC.wburGuide.url, SRC.cbsMail.url, SRC.wcvbDates.url],
  },
  {
    id: "ma-2026:date-early-voting",
    label: "Early in-person voting",
    date: "2026-10-17",
    time: null,
    rangeEnd: "2026-10-30",
    detail:
      "Saturday, Oct. 17 through Friday, Oct. 30. Hours and sites are set by each city or town and can differ from your Election Day polling place. In 2024 it ran Oct. 19 to Nov. 1.",
    sources: [SRC.bostonEarly.url, SRC.wburGuide.url, SRC.somervilleEarly.url, SRC.nbc2024.url],
  },
  {
    id: "ma-2026:date-mail-advice-oct27",
    label: "Suggested last day to put a ballot in the mail",
    date: "2026-10-27",
    time: null,
    rangeEnd: null,
    detail:
      "Massachusetts news reports say voters are urged to mail ballots back by Oct. 27; after that, use a drop box or deliver the ballot to your election office. This is advice, not a legal deadline.",
    sources: [SRC.cbsMail.url, SRC.wwlp.url, SRC.wcvbLongBallot.url],
  },
  {
    id: "ma-2026:date-mail-postmark",
    label: "Mailed ballots must be postmarked by",
    date: "2026-11-03",
    time: null,
    rangeEnd: null,
    detail:
      "A mailed ballot must carry a postmark dated Nov. 3 or earlier to count if it arrives after Election Day.",
    sources: [SRC.bostonMail.url, SRC.wburGuide.url, SRC.cbsMail.url],
  },
  {
    id: "ma-2026:date-mail-received",
    label: "Postmarked mail ballots must be received by",
    date: "2026-11-06",
    time: "5:00 p.m.",
    rangeEnd: null,
    detail:
      "Friday, Nov. 6, for ballots mailed from inside the U.S. This is the third day after Election Day, the same rule as 2024. Ballots received by 8 p.m. on Nov. 3 count without a postmark question.",
    sources: [SRC.bostonMail.url, SRC.fvapMA.url, SRC.statute2024.url, SRC.wburGuide.url],
  },
  {
    id: "ma-2026:date-dropbox-deadline",
    label: "Drop box and hand-delivery deadline",
    date: "2026-11-03",
    time: "8:00 p.m.",
    rangeEnd: null,
    detail:
      "Ballots left in a drop box or handed to your election office must be in by 8 p.m. on Election Day. Ballots cannot be dropped off at polling places. Some towns close satellite drop boxes earlier (Cambridge: 8 p.m. Nov. 2).",
    sources: [SRC.bostonMail.url, SRC.cambridgeMail.url, SRC.cbsMail.url],
  },
  {
    id: "ma-2026:date-election-day",
    label: "Election Day polls open",
    date: "2026-11-03",
    time: "7:00 a.m.",
    rangeEnd: null,
    detail: "Polls are open 7:00 a.m. to 8:00 p.m. at your assigned polling place.",
    sources: [SRC.wburGuide.url, SRC.bostonMail.url, SRC.cbsRegister.url],
  },
  {
    id: "ma-2026:date-overseas-received",
    label: "Overseas ballots mailed from outside the U.S. must be received by",
    date: "2026-11-13",
    time: "5:00 p.m.",
    rangeEnd: null,
    detail:
      "The tenth day after Election Day, for ballots mailed from outside the U.S. Voted ballots sent by email, fax or the online portal are due by 8 p.m. Nov. 3. In 2024 the same rule gave Nov. 15.",
    sources: [SRC.fvapMA.url, SRC.usvfMA.url, SRC.arlington2024.url],
  },
];

// ---- Notices ----
export const MA_VOTING_NOTICES = [
  // ===== MAIL =====
  {
    id: "ma-2026:mail-still-open",
    topic: "mail",
    level: "same",
    appliesTo: ["voted-by-mail-before", "everyone"],
    title: "Mail-in voting is still open to every voter",
    summary:
      "Any registered Massachusetts voter can vote by mail on Nov. 3, with no reason needed. Boston's election office and WBUR both say so for this election. Ballots are sent only to people who request one.",
    whatToDo:
      "If you still need a mail ballot, your election office must receive your request by 5 p.m. on Tue., Oct. 27. Voting in person is also open to you.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.bostonMail, SRC.wburGuide, SRC.cambridgeMail, SRC.nbc2024],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-request-covers",
    topic: "mail",
    level: "info",
    appliesTo: ["voted-by-mail-before"],
    title: "Check which elections your mail request covered",
    summary:
      "A mail-ballot request covers the election or elections you chose on the form. One form can cover every election in a calendar year, but a request for only the Sept. 1 primary did not ask for a November ballot.",
    whatToDo:
      "Look up your ballot status at trackmyballotma.com; if nothing shows, call your election office before 5 p.m. Oct. 27.",
    comparedTo: "Sept 1, 2026 primary",
    statusAsOf: ASOF,
    sources: [SRC.cambridgeMail, SRC.northAdamsForm, SRC.bostonReminders],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-usps-rule",
    topic: "mail",
    level: "watch",
    appliesTo: ["voted-by-mail-before"],
    title: "Federal USPS mail-ballot rule is blocked for Nov. 3",
    summary:
      "A March 31 executive order (EO 14399) led the Postal Service to adopt a rule letting it refuse ballot mail not matched to state-supplied lists and barcoded envelopes. Courts blocked that rule for this election: Judge Talwani (D. Mass.) on Sept. 4, with the First Circuit (Sept. 10) and the Supreme Court (Sept. 14) refusing to pause her order. Judge Nichols (D.D.C.) separately blocked it on Sept. 13.",
    whatToDo: "Return your ballot using the envelope and instructions in your ballot package.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [
      SRC.brennan,
      SRC.scotusblog,
      SRC.scotusOrder,
      SRC.cnbcScotus,
      SRC.cbsFirstCircuit,
      SRC.justSecurity,
      SRC.axiosNichols,
      SRC.jurist,
      SRC.agCampbell,
      SRC.eo14399,
    ],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-usps-rule-future",
    topic: "mail",
    level: "watch",
    appliesTo: ["voted-by-mail-before", "everyone"],
    title: "The USPS rule court fight is not over",
    summary:
      "The orders are interim: the cases continue, and the Supreme Court did not decide whether USPS has the power to issue the rule. Justice Kavanaugh wrote that USPS might have that power but that officials lacked time to apply it before November. Reports differ on whether the Sept. 4 order is limited to the 2026 election, so future elections are unsettled.",
    whatToDo: null,
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.scotusblog, SRC.justSecurity, SRC.brennan, SRC.justiaAug11],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-deadline-same",
    topic: "mail",
    level: "same",
    appliesTo: ["voted-by-mail-before"],
    title: "Late-arriving mail ballots still count if postmarked",
    summary:
      "A mailed ballot counts if it is postmarked by Tue., Nov. 3 and reaches your election office by 5 p.m. on Fri., Nov. 6. Massachusetts law gave the same three-day window in 2024. Ballots in a drop box or hand-delivered must be in by 8 p.m. on Nov. 3.",
    whatToDo: "Do not wait for Nov. 3 to mail it; near the deadline, use a drop box or deliver it by hand.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.bostonMail, SRC.wburGuide, SRC.wcvbDropBox, SRC.statute2024, SRC.fvapMA],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-primary-vs-general",
    topic: "mail",
    level: "changed",
    appliesTo: ["voted-by-mail-before"],
    title: "November has a mail grace period the primary did not",
    summary:
      "For the Sept. 1 primary, mail ballots had to be in election officials' hands by 8 p.m. on primary day, so Secretary Galvin told voters not to mail them late. For Nov. 3, a ballot postmarked by Nov. 3 still counts if it arrives by 5 p.m. on Nov. 6.",
    whatToDo: "Use the Nov. 3 deadlines, not the primary's.",
    comparedTo: "Sept 1, 2026 primary",
    statusAsOf: ASOF,
    sources: [SRC.wburPrimaryPrimer, SRC.bostonMail, SRC.cbsPrimaryGalvin, SRC.wgbhPrimaryGalvin],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-watson",
    topic: "federal",
    level: "same",
    appliesTo: ["voted-by-mail-before", "overseas-military"],
    title: "Supreme Court kept late-arriving ballot rules intact",
    summary:
      "On June 29, 2026, in Watson v. RNC, the Supreme Court held that federal Election Day laws do not stop states from counting mail ballots postmarked by Election Day and received later. Massachusetts already counts such ballots, so the Nov. 3 grace period stands.",
    whatToDo: null,
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.watsonOpinion, SRC.usvfWatson, SRC.faegreWatson, SRC.votebeatPostmark],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-postmark",
    topic: "mail",
    level: "watch",
    appliesTo: ["voted-by-mail-before"],
    title: "Your postmark date may be later than your mailing date",
    summary:
      "Since Dec. 24, 2025, USPS's written rules say a postmark date may not match the day it received your mail. USPS says its postmarking practices have not changed, but it notes some mail reaches its processing sites a day later, so the postmark can be later too. Massachusetts counts late-arriving ballots only if postmarked by Nov. 3.",
    whatToDo: "Mail early, or ask at a post office counter for a free hand postmark, or use a drop box.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.uspsPostmark, SRC.votebeatPostmark, SRC.cnbcPostmark, SRC.ballotpediaPostmark],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-timing-advice",
    topic: "mail",
    level: "info",
    appliesTo: ["voted-by-mail-before"],
    title: "Officials urge mailing by Oct. 27, then drop box",
    summary:
      "Massachusetts reports say voters are urged to mail ballots back by Oct. 27, then use a drop box or deliver the ballot in person. USPS also advises mailing at least a week before the receipt deadline and says it is adding extra handling for ballot mail starting Oct. 24. Secretary Galvin has encouraged drop boxes because of the long ballot.",
    whatToDo: "If you have not mailed your ballot by Oct. 27, take it to a drop box or your election office.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.cbsMail, SRC.wwlp, SRC.wcvbLongBallot, SRC.uspsOct20],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-no-polling-dropoff",
    topic: "mail",
    level: "info",
    appliesTo: ["voted-by-mail-before"],
    title: "Mail ballots cannot be dropped off at polling places",
    summary:
      "On Election Day, polling places do not accept voted mail ballots. Return yours by mail, to a drop box, or to your election office instead.",
    whatToDo: "Find your drop box or election office before Nov. 3.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.cbsMail, SRC.bostonMail, SRC.cambridgeMail],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-vote-once",
    topic: "mail",
    level: "info",
    appliesTo: ["voted-by-mail-before", "voted-early-before", "voted-in-person-before"],
    title: "If you requested a mail ballot, vote only once",
    summary:
      "If you vote in person after requesting a mail ballot, the mail ballot is rejected. If your mailed ballot has already reached your election office, it counts and you cannot vote again. Your ballot status shows whether it has arrived.",
    whatToDo: "Check your ballot status before you go to vote in person.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.wburGuide, SRC.bostonMail, SRC.cbsMail],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:mail-dropbox-local",
    topic: "mail",
    level: "info",
    appliesTo: ["voted-by-mail-before"],
    title: "Drop box places and closing times vary by town",
    summary:
      "Cities and towns run their own drop boxes. Boston's close at 8 p.m. on Nov. 3. Cambridge closes its satellite boxes at 8 p.m. on Nov. 2 and keeps only its main box open on Election Day.",
    whatToDo: "Look up your town's drop boxes and check the closing time.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.bostonMail, SRC.cambridgeMail, SRC.wcvbDropBox],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:overseas-deadlines",
    topic: "mail",
    level: "same",
    appliesTo: ["overseas-military"],
    title: "Overseas ballots get until Nov. 13 if mailed abroad",
    summary:
      "A ballot mailed from outside the U.S. and postmarked by Nov. 3 can arrive until 5 p.m. on Fri., Nov. 13. Voted overseas ballots sent by email, fax or the state's online portal are due by 8 p.m. on Nov. 3. The same 10-day window applied in 2024.",
    whatToDo: "If mail is slow, use the electronic return option in your ballot instructions.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.fvapMA, SRC.usvfMA, SRC.usVotersAbroad, SRC.arlington2024],
    verifiedOn: ASOF,
  },

  // ===== EARLY VOTING =====
  {
    id: "ma-2026:early-dates",
    topic: "early",
    level: "info",
    appliesTo: ["voted-early-before"],
    title: "Early voting runs Oct. 17 to Oct. 30",
    summary:
      "In-person early voting runs Sat., Oct. 17 through Fri., Oct. 30. In 2024 it ran Oct. 19 to Nov. 1. Both periods are two weeks and end on the Friday before Election Day.",
    whatToDo: "Check your city or town's early voting schedule before you go.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.bostonEarly, SRC.wburGuide, SRC.somervilleEarly, SRC.nbc2024],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:early-sites",
    topic: "early",
    level: "info",
    appliesTo: ["voted-early-before", "first-time"],
    title: "Your early voting site may not be your polling place",
    summary:
      "Each city and town sets its own early voting hours and sites, and many offer few sites. Weekend hours are not guaranteed on both weekends. In Boston you may use any early voting site, and the open sites change by day.",
    whatToDo: "Check your city or town's early voting list before you go.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.wburGuide, SRC.bostonReminders, SRC.bostonEarly],
    verifiedOn: ASOF,
  },

  // ===== REGISTRATION =====
  {
    id: "ma-2026:reg-deadline",
    topic: "registration",
    level: "same",
    appliesTo: ["new-registration", "first-time"],
    title: "Registration closes Oct. 24; no Election Day sign-up",
    summary:
      "The deadline to register or update your registration is Sat., Oct. 24: 5 p.m. in person, 11:59 p.m. online, or a mailed form postmarked by Oct. 24. You cannot register on Election Day. The same 10-day rule applied in 2024, when the deadline was Oct. 26.",
    whatToDo: "Check your registration at VoteInMA.com and register or update by 11:59 p.m. on Oct. 24 if needed.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.bostonReminders, SRC.bostonHowRegister, SRC.cbsRegister, SRC.wburGuide, SRC.flyer2024, SRC.nbc2024],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:reg-auto",
    topic: "registration",
    level: "info",
    appliesTo: ["new-registration", "first-time"],
    title: "Some state transactions register you automatically",
    summary:
      "Applying for or renewing a driver's license, learner's permit or state ID, or applying for MassHealth or Health Connector coverage, can register eligible citizens to vote. If you moved and only updated your address, you should still file a new registration form.",
    whatToDo: "Confirm your registration status before the Oct. 24 deadline.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.secRegister, SRC.wburGuide],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:reg-new-citizens",
    topic: "registration",
    level: "info",
    appliesTo: ["new-registration", "first-time"],
    title: "New citizens can register until Nov. 2",
    summary:
      "If you became a U.S. citizen after the Oct. 24 deadline, you can register in person at your local election office until 4 p.m. on Mon., Nov. 2. Bring proof that your naturalization ceremony was after the deadline.",
    whatToDo: "Bring your naturalization papers to your local election office by 4 p.m. Nov. 2.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.secRegister, SRC.shrewsburyVoter, SRC.danversVoter],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:reg-q4-proposal",
    topic: "registration",
    level: "watch",
    appliesTo: ["new-registration", "everyone"],
    title: "Same-day registration is a ballot question, not law",
    summary:
      "Question 4 would let eligible voters register at their polling place on Election Day. If it passes, it would take effect Jan. 1, 2028. It does not change the Oct. 24 deadline for this election.",
    whatToDo: null,
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.bostonComQ4, SRC.whdhQ4, SRC.newtonBeaconQ4, SRC.cbsRegister],
    verifiedOn: ASOF,
  },

  // ===== BALLOT =====
  {
    id: "ma-2026:ballot-q3-proposal",
    topic: "ballot",
    level: "watch",
    appliesTo: ["everyone"],
    title: "Question 3 would change primaries starting in 2028",
    summary:
      "Question 3 would replace party primaries for most state and federal offices with one all-party primary, with the top two advancing. If it passes, it takes effect Jan. 1, 2028. It does not change how you vote on Nov. 3.",
    whatToDo: null,
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.wburQ3, SRC.boston25Q3, SRC.pioneerQ3],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:ballot-length",
    topic: "ballot",
    level: "changed",
    appliesTo: ["everyone", "voted-in-person-before"],
    title: "Longer ballot: nine questions, two to four pages",
    summary:
      "Nine statewide questions tie the record, and ballots run two to four pages depending on the town. Secretary Galvin says marking the ballot has taken some voters 20 minutes and slows polling places. The state voter guide grew from 56 pages in 2024 to 88 pages.",
    whatToDo: "Read the state voter guide ahead of time and allow extra time at the polls.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.wcvbLongBallot, SRC.cbsLength, SRC.wburRedBook, SRC.wcvbClerk],
    verifiedOn: ASOF,
  },

  // ===== ID =====
  {
    id: "ma-2026:id-at-polls",
    topic: "id",
    level: "info",
    appliesTo: ["first-time", "everyone"],
    title: "Most voters do not show ID; some are asked",
    summary:
      "You may be asked for ID if you vote in Massachusetts for the first time, are on the inactive list, or cast a provisional or challenged ballot. Accepted ID includes non-photo items such as a utility bill or lease with your name and address. No voter ID question is among the nine on the Nov. 3 ballot.",
    whatToDo: "First-time voters: bring a document showing your name and address.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.secId, SRC.cbsRegister, SRC.wburGuide, SRC.telegramId, SRC.cbsQuestions],
    verifiedOn: ASOF,
  },

  // ===== POLLING =====
  {
    id: "ma-2026:polling-verify",
    topic: "polling",
    level: "info",
    appliesTo: ["everyone", "voted-in-person-before"],
    title: "Confirm your polling place and early-voting site",
    summary:
      "Cities and towns announce their own polling place changes; Boston, for example, moved voters in four precincts before the Sept. 1 primary. Your Election Day place can differ from your early voting site. The Secretary's lookup tool shows your assigned place.",
    whatToDo: "Enter your address in the Secretary's My Election Info tool, or call your city or town clerk.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.secTool, SRC.wburGuide, SRC.bostonSeptReminders],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:polling-boston-changes",
    topic: "polling",
    level: "info",
    appliesTo: ["voted-in-person-before"],
    title: "Boston: four precincts have newer polling places",
    summary:
      "Before the Sept. 1 primary, Boston told voters in Ward 2 Precinct 1, Ward 2 Precinct 3, Ward 9 Precinct 1 and Ward 22 Precinct 3 that they would now vote at new sites. Boston's Nov. 3 list shows those sites and flags Ward 2 Precinct 3 as updated; two Boston pages give different street numbers for that site (46 and 20 Winthrop St.).",
    whatToDo: "Boston voters: confirm your site at voteinma.com or call 617-635-8683.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.bostonSeptReminders, SRC.bostonPollingList],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:polling-moved",
    topic: "polling",
    level: "info",
    appliesTo: ["everyone", "new-registration"],
    title: "Moved recently? You may still vote from your old address",
    summary:
      "If you moved within your city or town, or to a new Massachusetts town within six months of the election, and have not re-registered, state law lets you vote from your old address. If you can still register at your new address, the deadline is Oct. 24.",
    whatToDo: "If you moved, check your registration and call your clerk to confirm where to vote.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.bostonMail, SRC.wburPrimaryPrimer],
    verifiedOn: ASOF,
  },

  // ===== DATES =====
  {
    id: "ma-2026:dates-shift",
    topic: "dates",
    level: "same",
    appliesTo: ["everyone"],
    title: "Deadlines moved with the calendar; the rules did not",
    summary:
      "Registration closes 10 days before the election (Oct. 24 now, Oct. 26 in 2024). Mail requests close at 5 p.m. on the fifth business day before (Oct. 27 now, Oct. 29 in 2024). Early voting spans two weeks ending the Friday before (Oct. 17-30 now, Oct. 19-Nov. 1 in 2024).",
    whatToDo: "Use the 2026 dates; do not rely on dates from 2024 or earlier.",
    comparedTo: "2024 general election",
    statusAsOf: ASOF,
    sources: [SRC.nbc2024, SRC.flyer2024, SRC.bostonMail, SRC.bostonEarly, SRC.wcvbDates],
    verifiedOn: ASOF,
  },

  // ===== FEDERAL =====
  {
    id: "ma-2026:federal-citizenship-lists",
    topic: "federal",
    level: "watch",
    appliesTo: ["everyone"],
    title: "Federal citizenship lists are being fought in court",
    summary:
      "Section 2 of EO 14399 tells DHS and the Social Security Administration to build state citizenship lists and send them to states. The Supreme Court lifted an earlier block on that part on Aug. 24, and a suit (EPIC v. USCIS, D. Md.) is pending, with the judge requiring 30 days' notice before lists or the portal go live. Reports through early October did not show lists delivered.",
    whatToDo: "Confirm your registration is active at VoteInMA.com.",
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.brennan, SRC.npr, SRC.ddNotice, SRC.ddCase, SRC.epic],
    verifiedOn: ASOF,
  },
  {
    id: "ma-2026:federal-doj-voter-list",
    topic: "federal",
    level: "watch",
    appliesTo: ["everyone"],
    title: "Federal suit for Massachusetts' voter list was dismissed",
    summary:
      "On April 9, 2026, Judge Leo Sorokin (D. Mass.) dismissed the Justice Department's lawsuit demanding Massachusetts' unredacted voter list, ruling the demand gave no stated basis. DOJ filed a notice of appeal on June 1.",
    whatToDo: null,
    comparedTo: null,
    statusAsOf: ASOF,
    sources: [SRC.apDoj, SRC.bostonComDoj, SRC.ntdDoj],
    verifiedOn: ASOF,
  },
];
