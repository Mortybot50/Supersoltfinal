# MortyBot OpenClaw Setup — Visual Guide
*Last updated: 7 April 2026*
*Based on: 26 config files, 107 skills across 5 locations*

---

## STEP 1 — FILES READ

26 files read, zero missing. Here is what each one does:

| # | File | Purpose |
|---|------|---------|
| 1 | dev/SOUL.md | Defines DEV as SuperSolt's Virtual CTO with full-stack mastery |
| 2 | dev/AGENTS.md | DEV operating manual: boot sequence, memory, safety, Gmail, SkillsMP, image handling |
| 3 | dev/TOOLS.md | DEV environment: SuperSolt location, Supabase ref, production URL |
| 4 | dev/IDENTITY.md | DEV persona: sharp, direct, Australian, delegates heavy coding to Claude Code |
| 5 | dev/HEARTBEAT.md | DEV periodic checks: POS sync, build status, PRs, emails, calendar |
| 6 | merchant/SOUL.md | MERCHANT as autonomous Shopify dropshipping operator with 30% margin floor |
| 7 | merchant/AGENTS.md | MERCHANT operating manual: pricing/ad-spend/supplier safety rails, reporting templates |
| 8 | merchant/TOOLS.md | MERCHANT API conventions: Shopify Admin, Meta Ads, Klaviyo, Google Trends |
| 9 | merchant/IDENTITY.md | MERCHANT persona: autonomous operator covering research, pricing, ads, margins |
| 10 | merchant/HEARTBEAT.md | MERCHANT periodic checks: orders, ads ROAS, inventory, revenue, trends, UGC |
| 11 | consult/SOUL.md | CONSULT as hospitality operations consultant with AU compliance expertise |
| 12 | consult/AGENTS.md | CONSULT operating manual: Notion integration, PPB workspace map, meeting transcript workflow |
| 13 | consult/TOOLS.md | CONSULT environment: AU hospitality benchmarks, compliance references (mostly placeholder) |
| 14 | consult/IDENTITY.md | CONSULT persona: professional, methodical, commercially sharp, Australian English |
| 15 | consult/HEARTBEAT.md | CONSULT periodic checks: deliverables, meetings, memory (minimal, pending build-out) |
| 16 | ceo/SOUL.md | CEO as virtual chief of staff overseeing all three ventures |
| 17 | ceo/AGENTS.md | CEO operating manual: triage rules, Gmail integration, email templates, SkillsMP |
| 18 | ceo/TOOLS.md | CEO environment: agent landscape, key references, autonomy rules |
| 19 | ceo/IDENTITY.md | CEO persona: calm, strategic, sees the whole board, connects dots |
| 20 | ceo/HEARTBEAT.md | CEO periodic checks: cross-venture priorities, commitments, follow-ups |
| 21 | workspace/USER.md | Morty's profile: ghostwriting style, communication preferences |
| 22 | workspace/MEMORY.md | Shared memory: SuperSolt status, partnerships, known issues |
| 23 | ~/workspace/USER.md | Richer profile: SuperSolt MVP description, 7 modules, tech stack, build phases |
| 24 | ~/workspace/MEMORY.md | Curated memory: 74 tables, 166 RLS, partnerships, merchant build status |
| 25 | openclaw.json | Master config: 4 agents, models, sandbox, WhatsApp bindings, plugins |
| 26 | cron/jobs.json | 2 cron jobs: 30-min health monitor + weekly Sunday architecture review |

---

## STEP 2 — AGENT IDENTITY CARDS

### CEO — Chief of Staff

| Field | Detail |
|-------|--------|
| Name | MortyBot |
| Role | Virtual Chief of Staff / Strategic Orchestrator |
| Personality | Calm, strategic, sees the whole board |
| Primary Job | Oversee all 3 ventures, triage incoming requests to the right specialist |
| Reports to | Morty (via WhatsApp DM) |
| Works with | Routes tasks to DEV, MERCHANT, and CONSULT |
| Knows about | Cross-venture priorities, deadlines, commitments, Gmail inbox |
| Status | ACTIVE — handles DMs, email triage, strategic coordination |
| WhatsApp | Direct message with the bot number |
| Skills | 10 — strategy, research, financial modelling, investor materials, KPI design |

### DEV — Virtual CTO

| Field | Detail |
|-------|--------|
| Name | MortyBot |
| Role | Virtual CTO for SuperSolt |
| Personality | Sharp, direct, Australian, technically deep |
| Primary Job | Build and maintain SuperSolt (restaurant ops SaaS) |
| Reports to | Morty (via Dev WhatsApp group) |
| Works with | Delegates heavy coding to Claude Code via ACP |
| Knows about | React, TypeScript, Supabase, Vercel, Square POS, RLS, database design |
| Status | ACTIVE — most mature agent, 29 skills, 2 cron jobs |
| WhatsApp | Dev group (120363424566542395@g.us) |
| Skills | 29 — Supabase (6), Vercel (2), Square, PostgreSQL, testing, debugging, design, SEO |

### MERCHANT — Shopify Operator

| Field | Detail |
|-------|--------|
| Name | Merchant |
| Role | Autonomous Shopify Dropshipping Operator |
| Personality | Data-driven, margin-protective, safety-railed |
| Primary Job | Run the dropshipping business — product research, ads, pricing, margins |
| Reports to | Morty (via Merchant WhatsApp group) |
| Works with | Independent, peer relationship with DEV |
| Knows about | Shopify Admin API, Meta Ads, Klaviyo, Google Trends, supplier management |
| Status | ACTIVE — 27 skills, heartbeat with 6 automated checks |
| WhatsApp | Merchant group (120363424934625243@g.us) |
| Skills | 27 — ecommerce (5), ads (3), marketing (4), research (3), operations (5), self-built (5) |

### CONSULT — Hospitality Advisor

| Field | Detail |
|-------|--------|
| Name | MortyBot |
| Role | Hospitality Operations Consultant |
| Personality | Professional, methodical, commercially sharp, Australian English |
| Primary Job | Service PPB (Piccolo Panini Bar) — meeting summaries, Notion management, ops analysis |
| Reports to | Morty (via Consult WhatsApp group) |
| Works with | Reads/writes PPB Notion workspace |
| Knows about | AU Fair Work, FSANZ food safety, P&L analysis, food/labour cost benchmarking |
| Status | ACTIVE — 7 skills, Notion integration working, meeting workflow defined |
| WhatsApp | Consult group (120363427361906219@g.us) |
| Skills | 7 — Notion integration, compliance, restaurant ops, client flow, competitive analysis |

---

## STEP 3 — CAPABILITY MAP

| Capability | CEO | DEV | MERCHANT | CONSULT |
|------------|-----|-----|----------|---------|
| Browse the web (Brave search) | YES | YES | YES | YES |
| Browser automation (fill forms, click) | YES | YES | YES | YES |
| Run terminal commands | YES | YES | YES | YES |
| Read/write files on Mac Mini | YES | YES | YES | YES |
| Send WhatsApp messages | YES | YES | YES | YES |
| Receive WhatsApp messages | YES (DM) | YES (group) | YES (group) | YES (group) |
| Read Notion | NO | NO | NO | YES (PPB only) |
| Write to Notion | NO | NO | NO | YES (PPB only) |
| Access Supabase (SuperSolt DB) | NO | PARTIAL | NO | NO |
| Interact with Square POS | NO | PARTIAL | NO | NO |
| Access Shopify | NO | NO | PARTIAL | NO |
| Send emails (Gmail) | YES | YES | YES | YES |
| Receive emails (Gmail) | YES (auto) | YES (manual) | YES (manual) | YES (manual) |
| Remember between conversations | YES | YES | YES | YES |
| Run scheduled tasks (cron) | YES | YES | YES | YES |
| Call external APIs | YES | YES | YES | YES |
| Analyse images from WhatsApp | YES | YES | YES | YES |
| Generate images (OpenAI) | YES | YES | YES | YES |
| Send images via WhatsApp | YES | YES | YES | YES |
| Spawn subagents | YES | YES | YES | YES |
| Text-to-speech | YES | YES | YES | YES |
| Read PDFs | YES | YES | YES | YES |

**PARTIAL notes:**
- DEV + Supabase: Can access via Supabase CLI and direct SQL, but no dedicated API skill
- DEV + Square: Has a Square skill but integration depth unclear
- MERCHANT + Shopify: Has API conventions documented in TOOLS.md but no live store connected yet

---

## STEP 4 — SKILLS BREAKDOWN

### CEO (10 skills)

**Research & Information**
| Skill | What it does for you |
|-------|---------------------|
| mckinsey-research | Structures business research using McKinsey consulting frameworks |
| market-research-reports | Generates market analysis reports with data and trends |

**Business & Strategy**
| Skill | What it does for you |
|-------|---------------------|
| c-level-advisor | Provides executive-level strategic advice on business decisions |
| strategy-advisor | Helps formulate business strategy and competitive positioning |
| consulting-analysis | Analyses business problems using structured consulting methodologies |
| startup-metrics-framework | Tracks and analyses startup KPIs (CAC, LTV, churn, MRR) |
| startup-financial-modeling | Builds financial models, projections, and scenario analysis |
| investor-materials | Creates pitch decks, one-pagers, and investor-facing documents |
| kpi-dashboard-design | Designs KPI dashboards for tracking business performance |

**Reporting**
| Skill | What it does for you |
|-------|---------------------|
| biz-reporter | Generates business performance reports and summaries |

### DEV (29 skills)

**Coding & Technical**
| Skill | What it does for you |
|-------|---------------------|
| supabase-architecture-variants | Designs Supabase database architecture patterns |
| supabase-auth-storage-realtime-core | Implements Supabase auth, storage, and realtime features |
| supabase-data-handling | Manages data operations, migrations, and queries |
| supabase-policy-guardrails | Creates and validates RLS (row-level security) policies |
| supabase-postgres-best-practices | Ensures PostgreSQL code follows best practices |
| supabase-reference-architecture | Provides reference architecture patterns for Supabase apps |
| postgresql-code-review | Reviews SQL and PostgreSQL code for quality and performance |
| database-migrations | Manages database schema changes safely |
| vercel | Handles Vercel deployment, configuration, and troubleshooting |
| vercel-react-best-practices | Ensures React code follows Vercel deployment best practices |
| squareup | Integrates with Square POS API for payment and sales data |
| test-driven-development | Writes tests before code for better reliability |
| systematic-debugging | Methodically diagnoses and fixes bugs |
| studio-best-practices | Best practices for Supabase Studio usage |

**Design & Frontend**
| Skill | What it does for you |
|-------|---------------------|
| frontend-design | Designs UI components and layouts |
| tailwind-design-system | Creates consistent design systems using Tailwind CSS |
| web-design-guidelines | Follows web design best practices for usability |

**Planning & Process**
| Skill | What it does for you |
|-------|---------------------|
| writing-plans | Writes structured development plans |
| executing-plans | Follows through on development plans step by step |

**Content & Documentation**
| Skill | What it does for you |
|-------|---------------------|
| content-strategy | Plans content strategy for marketing and documentation |
| copywriting | Writes marketing copy, product descriptions, and landing pages |
| seo-audit | Audits websites for SEO issues and suggests improvements |
| markdown-converter | Converts documents (PDF, Word, Excel) to Markdown |

**Tools & Utilities**
| Skill | What it does for you |
|-------|---------------------|
| context7 | Fetches up-to-date documentation for any programming library |
| mgrep-code-search | Searches large codebases using natural language |
| beautiful-mermaid | Renders diagrams as SVG/PNG images |
| find-skills | Searches for new skills on SkillsMP |
| skill-creator | Creates new custom skills |
| mcp-builder | Builds MCP (Model Context Protocol) servers and tools |

### MERCHANT (27 skills)

**Research & Information**
| Skill | What it does for you |
|-------|---------------------|
| product-research | Researches products for dropshipping viability |
| ecommerce-product-pro | Advanced product research for Amazon FBA, Shopify, dropshipping |
| market-intelligence-claw | Real-time strategic intelligence for ecommerce decisions |
| market-analysis | Analyses market trends and competitive landscape |
| competitive-intelligence | Monitors competitor pricing and market positioning (self-built) |
| visual-trend-dashboard | Analyses trending products with momentum indicators (self-built) |

**Marketing & Ads**
| Skill | What it does for you |
|-------|---------------------|
| ads-manager-claw | Manages ad campaigns across platforms |
| paid-ads | Creates and optimises paid advertising campaigns |
| performance-marketing-agent | Tracks and optimises marketing performance metrics |
| shopify-marketing | Shopify-specific marketing automation |
| email-sequence | Creates automated email marketing sequences |
| email-marketing | General email marketing strategy and execution |
| content-creator | Creates marketing content for social media and web |
| ugc-script-generator | Generates UGC (user-generated content) ad scripts (self-built) |

**Ecommerce Operations**
| Skill | What it does for you |
|-------|---------------------|
| ecommerce-manager-claw | Manages ecommerce store backend via APIs |
| clawpify | Shopify store management and automation |
| store-setup | Sets up and configures Shopify stores |
| order-management | Tracks and manages customer orders |
| inventory-source | Manages inventory and supplier sourcing |
| supplier-comms | Handles supplier communications and negotiations |
| pricing-engine | Calculates optimal pricing based on costs and margins |

**Business & Strategy**
| Skill | What it does for you |
|-------|---------------------|
| afrexai-sales-funnel-engine | Designs and optimises sales funnels |
| analytics-dashboard | Builds analytics dashboards for business metrics |
| automated-product-listing | Automates product listing creation (self-built, SKILL.md only) |
| merchant-intelligence | Orchestrates all capabilities into market reports (self-built, SKILL.md only) |
| competitor-intel | Legacy competitor intelligence (may overlap with competitive-intelligence) |

**Potentially redundant:**
- `ad-manager.replaced` — appears to be a deprecated/replaced version of ads-manager-claw
- `competitor-intel` vs `competitive-intelligence` — likely duplicate functionality

### CONSULT (7 skills)

**Business & Operations**
| Skill | What it does for you |
|-------|---------------------|
| notion-integration | Reads/writes the PPB Notion workspace (meetings, projects, to-dos, waste logs) |
| restaurant-operations-expert | Advises on restaurant operations, efficiency, and best practices |
| qsr-labor-leak-auditor | Audits labour costs and identifies waste in QSR (quick service restaurant) operations |
| compliance-tracking | Tracks compliance with AU regulations (Fair Work, food safety, licensing) |
| client-flow | Manages client engagement workflow and deliverable tracking |
| competitive-analysis | Analyses competitors in the hospitality market |
| hundred-million-offers | Helps structure high-value service offerings using the $100M Offers framework |

---

## STEP 5 — SYSTEM DIAGRAM

The system diagram has been rendered as an SVG file:
**File:** `/Users/mortybot/.openclaw/roles/dev/supersolt/openclaw-system-diagram.svg`

The diagram shows:
- You (Morty) send messages via WhatsApp
- The OpenClaw Gateway (port 18789) routes messages based on which group they come from
- DM goes to CEO, Dev Group to DEV, Merchant Group to MERCHANT, Consult Group to CONSULT
- All 4 agents share the same core tools: web search, browser, terminal, file system, Gmail, image gen, image analysis, TTS, subagents
- Platform connections: CONSULT connects to Notion, DEV connects to Supabase and Vercel, MERCHANT connects to Shopify (pending)
- Background jobs: Gmail poll feeds CEO every 2 min, Notion sync updates CONSULT every 6 hrs, Health monitor and Architecture review feed DEV

---

## STEP 6 — WHAT IS NOT WORKING OR MISSING

### Configured but not functioning correctly

| Issue | Detail |
|-------|--------|
| Cron jobs skipping | Both cron jobs (30-min health monitor, weekly architecture review) show status "skipped" with lastError "disabled" — they are not actually running |
| Consult meeting workflow | Meeting transcript to Notion flow works but requires multiple retries, the agent sometimes ignores the format instructions in NOTION-BRIEFING.md |
| auth-profiles.json format | All 5 agent auth-profiles.json files have OpenAI keys in an invalid format (gateway logs "ignored invalid auth profile entries") — image generation works via env.vars instead |

### Capabilities you probably think you have but actually don't

| Assumption | Reality |
|------------|---------|
| Square POS live data | The DEV agent has a Square skill but there is no evidence of a live, working Square API integration that pulls real sales data |
| Shopify live store | The MERCHANT agent has Shopify skills and API docs in TOOLS.md but no Shopify store is actually connected — all API keys reference environment variables that may not be set |
| Notion for all agents | Only CONSULT can access Notion — CEO, DEV, and MERCHANT cannot read or write to it |
| Auto-forward manufacturer emails | The gmail-forward-check.py script and rules exist, but no log entries show it has ever successfully forwarded an email — needs testing |

### Gaps — things none of your agents can currently do

| Gap | Impact |
|-----|--------|
| No calendar integration | No agent can read or create Google Calendar events — useful for meeting scheduling |
| No Slack/Discord | Only WhatsApp is connected — if you ever need other channels, they would need setup |
| No automated financial reporting | No agent pulls P&L data, COGS, or labour costs automatically from any source |
| No client-facing portal | CONSULT produces work in Notion but there is no way for PPB owners to interact with the bot directly |
| No voice transcription | You send PDFs of transcripts — if the agents could transcribe audio directly, the workflow would be smoother |

### Quick wins — small changes with big impact

| Win | Effort | Impact |
|-----|--------|--------|
| Fix the 2 cron jobs | 5 min — enable them properly | DEV gets automated health monitoring and weekly reviews |
| Copy Notion skill to CEO | 10 min — copy skill + add to AGENTS.md | CEO can read/write Notion for cross-venture tracking |
| Connect Shopify store | 30 min — set API keys in env | MERCHANT goes from theoretical to actually managing a live store |
| Switch to Haiku for routine tasks | 5 min — change model in config | ~70% cost reduction on API bills for standard operations |
| Fix auth-profiles.json format | 10 min — remove invalid entries | Eliminates gateway warnings on every agent session load |

---

## STEP 7 — PLAIN ENGLISH SUMMARY

**What you have, explained simply:**

Imagine you run a small company with four employees, each working from home. You communicate with them entirely through WhatsApp group chats — one group per employee.

- The **CEO** is your chief of staff. They sit in your DMs, manage your email inbox, and route work to the right person. When an email comes in, the CEO reads it and decides what to do.

- The **DEV** is your technical lead. They live in the "Dev" group chat and build your restaurant software (SuperSolt). They can write code, deploy updates, and manage your database. They have the most tools of anyone on the team.

- The **MERCHANT** is your ecommerce operator. They live in the "Merchant" group chat and are supposed to run your Shopify dropshipping business — finding products, running ads, managing margins. They have all the skills but the Shopify store itself is not yet connected.

- The **CONSULT** is your hospitality advisor. They live in the "Consult" group chat and manage your work with PPB (Piccolo Panini Bar). When you record a meeting, you send the transcript to this person and they write it up in your Notion workspace.

All four employees share the same office (your Mac Mini) and have access to the same basic tools — they can browse the web, send emails, generate images, fill out web forms, and run programs on the computer.

In the background, there are a couple of automatic routines: your email inbox gets checked every 2 minutes and forwarded to the CEO, and your PPB Notion workspace gets snapshotted every 6 hours so the consultant always knows what is going on.

**The 3 things that would most improve this setup right now are:**

1. **Connect Shopify to the MERCHANT agent** — right now it has 27 skills for running a dropshipping business but no actual store to run. Connecting a live Shopify store would turn the merchant from theoretical to operational overnight.

2. **Switch all agents to Haiku for routine tasks** — you are burning through Anthropic credits on Sonnet for tasks that Haiku can handle. Switching would cut your API costs by roughly 70% with minimal quality impact on standard operations.

3. **Fix the 2 cron jobs that are stuck on "skipped"** — the DEV agent is supposed to automatically check your build health every 30 minutes and do a weekly architecture review, but both are disabled. Enabling them gives you automated monitoring without you having to ask.
