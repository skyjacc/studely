# Claude Agents "42 skills / 7 crews" — verified install guide

The pack shown by **@imma.uiux** (TikTok) is **not** a single installable product.
There is no bio link, no GitHub repo, no marketplace bundle for it — it is a
**repackaging of public Claude skills**. Every one of the 42 was traced to its
real, verified source below (each `SKILL.md` was actually opened, not guessed).

> **How to install:** run the `/plugin ...` commands in an **interactive Claude Code
> terminal** (they modify your local config). `npx` / `git clone` lines run in a
> normal shell. 41 of 42 are obtainable; **`pricing` (Finance)** has no verified public source.

---

## Fast path — add ~8 marketplaces, get 41/42

```bash
# 1) Anthropic official — 11 skills (mcp-builder, skill-creator, webapp-testing,
#    frontend-design, web-artifacts-builder, canvas-design, algorithmic-art,
#    slack-gif-creator, internal-comms, xlsx, docx)
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
/plugin install document-skills@anthropic-agent-skills

# 2) Marketing + Social — 10 skills (seo-audit, programmatic-seo, ai-seo, cro,
#    ad-creative, marketing-psychology, social, copywriting, content-strategy, video)
/plugin marketplace add coreyhaines31/marketingskills
/plugin install marketing-skills

# 3) Finance — 5 skills (dcf-model, 3-statement-model, lbo-model, comps-analysis, pitch-deck)
/plugin marketplace add anthropics/financial-services
/plugin install pitch-agent@claude-for-financial-services

# 4) Legal (4) + sql-queries (data)
/plugin marketplace add anthropics/knowledge-work-plugins
/plugin install legal@knowledge-work-plugins
/plugin install data@knowledge-work-plugins

# 5) Extras — launch-runbook, email-sequences, pillar-content-architecture
/plugin marketplace add rampstackco/claude-skills
/plugin install rampstack-skills@rampstack

# 6) Dev standalone
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
/plugin marketplace add upstash/context7
/plugin install context7@context7-marketplace
npx claude-mem install

# 7) UI/UX intelligence
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill

# 8) git-clone only (no marketplace): sop-builder, business-case, incident-postmortem
git clone https://github.com/w95/awesome-claude-corporate-skills.git
# then copy these folders into ~/.claude/skills/ :
#   07-operations/sop-builder
#   07-operations/business-case-builder
#   07-operations/incident-postmortem
```

---

## Full map (card name → real skill → source)

### 01 · Developers
| Card | Real name | Source | Install |
|---|---|---|---|
| Superpowers | superpowers | github.com/obra/superpowers-marketplace | `/plugin install superpowers@superpowers-marketplace` |
| Context7 | context7-cli | github.com/upstash/context7 | `/plugin install context7@context7-marketplace` |
| MCP Builder | mcp-builder | anthropics/skills | `example-skills@anthropic-agent-skills` |
| Skill Creator | skill-creator | anthropics/skills | `example-skills@anthropic-agent-skills` |
| Webapp Testing | webapp-testing | anthropics/skills | `example-skills@anthropic-agent-skills` |
| Claude-Mem | claude-mem | github.com/thedotmack/claude-mem | `npx claude-mem install` |

### 02 · Design
| Card | Real name | Source | Install |
|---|---|---|---|
| frontend-design | frontend-design | anthropics/skills | `example-skills@anthropic-agent-skills` |
| web-artifacts | web-artifacts-builder | anthropics/skills | `example-skills@anthropic-agent-skills` |
| canvas-design | canvas-design | anthropics/skills | `example-skills@anthropic-agent-skills` |
| algorithmic-art | algorithmic-art | anthropics/skills | `example-skills@anthropic-agent-skills` |
| ui-ux-pro-max | ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill | `ui-ux-pro-max@ui-ux-pro-max-skill` (free + paid tier) |
| slack-gif | slack-gif-creator | anthropics/skills | `example-skills@anthropic-agent-skills` |

### 03 · Marketing  (all in one plugin: `marketing-skills`)
`seo-audit`, `programmatic-seo`, `ai-seo`, `cro`, `ad-creative`, `mktg-psychology`→`marketing-psychology`
→ **github.com/coreyhaines31/marketingskills** · `/plugin install marketing-skills`

### 04 · Social & Content
| Card | Real name | Source |
|---|---|---|
| social | social | coreyhaines31/marketingskills (`marketing-skills`) |
| copywriting | copywriting | coreyhaines31/marketingskills (`marketing-skills`) |
| content-strategy | content-strategy | coreyhaines31/marketingskills (`marketing-skills`) |
| video | video | coreyhaines31/marketingskills (`marketing-skills`) |
| email-sequences | email-sequences | rampstackco/claude-skills (`rampstack-skills@rampstack`) |
| pillar-content | pillar-content-architecture | rampstackco/claude-skills (`rampstack-skills@rampstack`) |

### 05 · Finance  (5/6 in one plugin: `pitch-agent@claude-for-financial-services`)
| Card | Real name | Source |
|---|---|---|
| dcf-model | dcf-model | anthropics/financial-services |
| 3-statements | 3-statement-model | anthropics/financial-services |
| lbo-model | lbo-model | anthropics/financial-services |
| comps-analysis | comps-analysis | anthropics/financial-services |
| pitch-deck | pitch-deck | anthropics/financial-services |
| **pricing** | — | **NOT FOUND — no verified public source** |

### 06 · Operations
| Card | Real name | Source | Install |
|---|---|---|---|
| sop-builder | sop-builder | w95/awesome-claude-corporate-skills `/07-operations` | git clone + copy |
| incident-postmortem | incident-postmortem | github/awesome-copilot (or w95) | git clone + copy |
| business-case | business-case-builder | w95/awesome-claude-corporate-skills `/07-operations` | git clone + copy |
| launch-runbook | launch-runbook | rampstackco/claude-skills | `rampstack-skills@rampstack` |
| internal-comms | internal-comms | anthropics/skills | `example-skills@anthropic-agent-skills` |
| xlsx | xlsx | anthropics/skills | `document-skills@anthropic-agent-skills` |

### 07 · Legal
| Card | Real name | Source | Install |
|---|---|---|---|
| contract-review | review-contract | anthropics/knowledge-work-plugins | `legal@knowledge-work-plugins` |
| nda-triage | triage-nda | anthropics/knowledge-work-plugins | `legal@knowledge-work-plugins` |
| legal-risk | legal-risk-assessment | anthropics/knowledge-work-plugins | `legal@knowledge-work-plugins` |
| compliance | compliance-check | anthropics/knowledge-work-plugins | `legal@knowledge-work-plugins` |
| docx | docx | anthropics/skills | `document-skills@anthropic-agent-skills` |
| sql-queries | sql-queries | anthropics/knowledge-work-plugins **/data** (not legal!) | `data@knowledge-work-plugins` |

---

## Notes
- **Name mismatches** the pack renamed: `3-statements`→`3-statement-model`, `contract-review`→`review-contract`,
  `nda-triage`→`triage-nda`, `legal-risk`→`legal-risk-assessment`, `compliance`→`compliance-check`,
  `business-case`→`business-case-builder`, `pillar-content`→`pillar-content-architecture`, `mktg-psychology`→`marketing-psychology`.
- **`sql-queries`** is a Data skill, not Legal — the pack miscategorized it.
- **`pricing`** (Finance): not in Anthropic's financial-services suite. Only unrelated SaaS `pricing-strategy` community skills exist. Ask the creator for the exact source if you need this exact one.
- To grab a **single** skill from a whole-catalog repo: `npx skills add <repo-url> --skill <name>`, or manually copy its folder into `~/.claude/skills/`.
- **Already in this environment:** many of these (xlsx, docx, canvas-design, algorithmic-art, ui-ux-pro-max, copywriting, ad-creative, marketing-psychology, slack-gif-creator, skill-creator, frontend-design, agent-browser, deep-research, etc.) are already loaded — you don't need to install them to have me use them here.
