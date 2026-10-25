# How we used Kiro

Hackachusetts submission, **Civic Action** track. Four teammates built Mapachusetts together with Kiro. The team used the **Kiro IDE, Kiro CLI and Kiro Web**.

<!-- TODO(team): add one line per teammate on which tool they used most and why. See "Tools" below. -->

## Tools

| Tool | What we used it for |
| ---- | ------------------- |
| **Kiro IDE** | Main build environment. Planning, scaffolding and editing across many files, running the dev server and builds, and merging branches. |
| **Kiro CLI** | <!-- TODO(team): what the CLI was used for, e.g. quick fixes, scripts, git work --> |
| **Kiro Web** | <!-- TODO(team): what Kiro Web was used for --> |

<!-- TODO(team): "how did they differ?" is a judging question. One or two honest sentences on when you picked each. -->

## What Kiro built, by area

### 3D globe explorer (Rayna)
Started from the initial template with a prompt for a globe you click down from globe to continent to country to state. Kiro built the MapLibre 3D globe with U.S.-only drill-down, search, browse menus, Use my location and an events panel (commit `127f415`). Follow-up prompts fixed details such as map labels that were centered on the text instead of the place. Later work added the layer dock, ballot by layer, Census-based district stacks and ward layers for Boston, Chicago and NYC. Kiro read the existing code before editing, then ran the app to check the result.

### Candidate research app (<!-- TODO(team): teammate name(s) -->)
- Moved from a static template to a Next.js (App Router) + Supabase app with candidate search by name, office, state and party, and per-politician detail pages with career timelines.
- Built an RSS-to-Supabase news ingest and a cited-summaries pipeline. Summaries are written by Claude and the citations are checked.
- Researched the November 2026 Massachusetts ballot (governor and U.S. Senate) and generated cited summaries for four candidates (Healey, Minogue, Markey, Deaton), baked into seed SQL so the app needs no API key to run.
- Added candidate photos, status, new issue topics, sources and myths. Built the "In the News" tab and the 3D globe home page showing real Massachusetts race cards that link to candidate profiles.

### Merging the team's work
Kiro merged separate branches (candidate search, UI/globe, photos and issue topics, ward layer) into one app. Different teammates worked on different branches at the same time, and Kiro helped resolve the conflicts and keep one coherent codebase. The merged result is on `main`.

### Security and quality
As reported by the teammate who ran these sessions:
- Kiro flagged an exposed Supabase service-role key. The key was rotated, and secrets were moved out of git and out of browser code.
- Kiro patched vulnerable Next.js versions down to zero reported vulnerabilities, and fixed Next 16 async API changes and build-resilience issues.
- Kiro flagged that work was sitting on `merge-all` instead of `main`, and that the `.kiro` folder was not committed.

We checked git history afterwards. No `.env` file was ever committed, and a scan for key-shaped strings found none.

### Docs and deployment
- Rewrote the README and wrote a features-and-functionality description for the submission.
- Investigated deployment. Kiro checked what Vercel would build and identified the two Supabase environment variables it needs.

<!-- TODO(team): DEVELOPMENT.md and features-and-functionality.md were mentioned in a Kiro session but are not in the repo. Commit them or remove this note. -->

## Kiro features we used

- **Steering** (`.kiro/steering/`): three files that give Kiro the product rules, the tech stack and run commands, and the data conventions. Examples: sample data must be labeled "Sample", generated files are never edited by hand, and service keys never go in browser code. We added these late in the build to capture conventions the team had already settled on.
- **Hooks** (`.kiro/hooks/export-candidates-on-save.json`): when `supabase/seed-data/*.json` or `lib/candidate-profiles.ts` is saved, the hook re-runs `scripts/export_candidates.py`. This keeps the globe's generated data in step with the research app's source of truth.
- **Parallel sub-agents**: used for research tasks, such as looking up candidates and checking the ballot, while the main session kept building.
- **Read first, then write**: Kiro read the existing code before changing it, and checked its own claims against the code. It caught README and code mismatches this way.
- **Risk flagging**: Kiro called out exposed secrets, hosting assumptions (Vercel vs. Netlify) and uncommitted work.

<!-- TODO(team): add any other feature you really used (specs, MCP servers, vibe vs. spec sessions). Leave it out if nobody used it. -->

## What we did by hand

<!-- TODO(team): honest list, e.g. product decisions, which races to cover, final review of candidate facts, key rotation in the Supabase dashboard, recording the demo. -->
