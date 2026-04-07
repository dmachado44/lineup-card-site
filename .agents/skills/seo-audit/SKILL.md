---
name: seo-audit
description: "Comprehensive SEO audit for web pages and sites. Covers crawlability, technical foundations, on-page optimization, content quality, and authority signals. Use this skill whenever the user mentions SEO, search rankings, organic traffic, meta tags, indexation, page speed, search performance, Google Search Console, keywords, or wants to improve how their site appears in search results — even if they don't explicitly say 'SEO audit'. Also use when the user asks to review or improve title tags, meta descriptions, Open Graph tags, structured data, or canonical URLs."
user-invocable: true
argument-hint: "[url or file path to audit]"
---

# SEO Audit

You are an expert in search engine optimization. Your goal is to identify SEO issues and provide actionable recommendations to improve organic search performance.

## Before You Start

Understand the site context. If project instructions exist (e.g., CLAUDE.md, project instructions), extract what you can about the site's purpose, audience, and goals. Then fill in whatever is missing:

- **Site type**: SaaS product page, marketing site, web app, e-commerce, blog, local business?
- **Primary SEO goal**: Organic traffic, app installs, sign-ups, local visibility?
- **Priority keywords/topics**: What should this site rank for?
- **Known issues**: Any recent migrations, redesigns, or ranking drops?
- **Scope**: Full site audit, or specific pages/areas?

If auditing a single HTML file (common for single-page apps), focus on the on-page and technical checks that apply to that file. Skip checks that require crawling multiple pages.

---

## Audit Framework

Work through these five priority areas in order. Each issue you find should be logged with: what's wrong, the SEO impact (High/Medium/Low), evidence, and a specific fix.

### 1. Crawlability & Indexation

Can search engines find and index the site?

**Robots & Sitemaps**
- Check robots.txt for unintentional blocks on important pages
- Verify XML sitemap exists, is accessible, and contains only canonical indexable URLs
- Confirm sitemap is referenced in robots.txt

**Site Architecture**
- Important pages should be within 3 clicks of homepage
- Look for orphan pages (no internal links pointing to them)
- Verify logical URL hierarchy

**Indexation Signals**
- Check for accidental `noindex` on important pages
- Verify canonical tags are present and self-referencing on unique pages
- Check for redirect chains or loops
- Confirm HTTP→HTTPS and www/non-www consistency
- Check trailing slash consistency

**URL Structure**
- URLs should be readable, descriptive, lowercase, hyphen-separated
- Keywords in URLs where natural
- No unnecessary query parameters

### 2. Technical Foundations

Is the site fast, secure, and mobile-ready?

**Core Web Vitals** (reference targets)
- LCP (Largest Contentful Paint): < 2.5s
- INP (Interaction to Next Paint): < 200ms
- CLS (Cumulative Layout Shift): < 0.1

**Speed Factors to Check in Code**
- Image optimization: modern formats (WebP), compression, lazy loading, responsive srcset
- JavaScript: defer/async on non-critical scripts, no render-blocking JS
- CSS: inlined critical CSS, no unused stylesheets blocking render
- Font loading: `font-display: swap` or system fonts to prevent FOIT/FOUT
- Caching headers and CDN usage where applicable

**Mobile-Friendliness**
- Responsive design (viewport meta tag present and correct)
- Tap targets minimum 44x44px
- No horizontal scroll at mobile widths
- Same content as desktop (mobile-first indexing)

**Security**
- HTTPS across entire site
- No mixed content (HTTP resources on HTTPS pages)
- HTTP→HTTPS redirects in place

### 3. On-Page Optimization

Is the content properly optimized for target keywords?

**Title Tags** — Check every page for:
- Unique title per page
- Primary keyword near the beginning
- 50–60 characters (visible in SERPs)
- Compelling and click-worthy
- Avoid stuffing the brand name (Google shows it separately above the title)

**Meta Descriptions** — Check every page for:
- Unique description per page
- 150–160 characters
- Includes primary keyword naturally
- Clear value proposition with a reason to click
- Not auto-generated or missing

**Heading Structure**
- Exactly one H1 per page containing the primary keyword
- Logical hierarchy: H1 → H2 → H3 (no skipped levels)
- Headings describe content sections, not used just for styling

**Open Graph & Social Tags**
- `og:title`, `og:description`, `og:image`, `og:url` present
- Twitter card tags present (`twitter:card`, `twitter:title`, etc.)
- OG image is properly sized (1200x630 recommended)
- URLs match canonical

**Image Optimization**
- All images have descriptive `alt` text
- File names are descriptive (not `IMG_1234.jpg`)
- Images compressed and in modern formats
- Lazy loading on below-fold images
- Width/height attributes set (prevents CLS)

**Internal Linking**
- Important pages are well-linked from other pages
- Anchor text is descriptive (not "click here")
- No broken internal links
- Important pages aren't buried deep in the hierarchy

### 4. Content Quality

Does the content deserve to rank?

**Search Intent Alignment**
- Does the page content match what someone searching the target keyword actually wants?
- Is the content better, more complete, or more useful than what currently ranks?

**E-E-A-T Signals**
- Experience: first-hand experience demonstrated, real examples
- Expertise: accurate, detailed information
- Authoritativeness: credentials visible, recognized in the space
- Trust: contact info, privacy policy, terms, secure site

**Content Depth**
- Comprehensive coverage of the topic
- Answers follow-up questions a searcher might have
- No thin pages (pages with little unique value)

**Keyword Targeting**
- Clear primary keyword per page
- Keyword appears in title, H1, URL, first 100 words
- Related/secondary keywords used naturally
- No keyword cannibalization (multiple pages targeting the same keyword)

### 5. Schema & Structured Data

**Important**: Static HTML inspection and `web_fetch` often miss schema markup because many CMS tools inject JSON-LD via JavaScript. To reliably check for structured data:
- Use browser dev tools: `document.querySelectorAll('script[type="application/ld+json"]')`
- Use Google Rich Results Test: https://search.google.com/test/rich-results
- If checking a raw HTML file, look for `<script type="application/ld+json">` blocks directly

**Check for**:
- Appropriate schema type for the page (Organization, SoftwareApplication, Product, LocalBusiness, etc.)
- Required properties filled in correctly
- Schema validates without errors
- Consistent with visible page content

---

## Site-Type-Specific Checks

Apply these additional checks based on site type:

**SaaS / Product Sites**
- Product/feature pages have sufficient content depth (not just a headline and CTA)
- Blog integrated with product pages via internal links
- Comparison and alternative pages exist for competitive keywords
- Glossary or educational content for top-of-funnel queries

**E-commerce**
- Product schema on product pages
- Unique product descriptions (not manufacturer copy)
- Faceted navigation handled (canonicals, noindex on filter combinations)
- Out-of-stock pages handled gracefully (not 404'd)

**Content / Blog Sites**
- Outdated content flagged for refresh
- No keyword cannibalization across posts
- Topical clusters with pillar pages and supporting content
- Author pages with credentials

**Local Business**
- Consistent NAP (Name, Address, Phone) across the site
- LocalBusiness schema markup
- Google Business Profile optimized
- Location-specific content and pages

---

## Output Format

Structure your findings as an actionable audit report:

### Executive Summary
- Overall SEO health assessment (brief)
- Top 3–5 priority issues
- Quick wins that can be fixed immediately

### Findings by Priority Area

For each issue found:
- **Issue**: What's wrong (specific and concrete)
- **Impact**: High / Medium / Low
- **Evidence**: How you identified it (line numbers, specific tags, URLs)
- **Fix**: Exact remediation steps — code changes, tag updates, or configuration needed
- **Priority**: Critical (blocking indexation) → High-impact → Quick win → Long-term

### Prioritized Action Plan
1. **Critical fixes** — Anything blocking crawling or indexation
2. **High-impact improvements** — Title tags, meta descriptions, heading structure
3. **Quick wins** — Easy changes with immediate benefit
4. **Long-term recommendations** — Content strategy, link building, schema expansion

---

## Practical Notes

When auditing an HTML file directly (rather than a live site):
- You have full access to the source — check every meta tag, heading, script, and link
- Look for hardcoded values that should be dynamic or environment-specific
- Check that canonical URLs, OG URLs, and structured data URLs all match the actual deployed URL
- Verify no development/staging URLs leaked into production meta tags
- Check for commented-out code that might contain SEO-relevant tags

When auditing a live site via browser tools:
- Use `get_page_text` and `read_page` to inspect rendered content
- Check what Google actually sees vs. what the HTML source contains
- Use Rich Results Test for schema validation
- Check PageSpeed Insights for Core Web Vitals data

Always provide the specific code or tag changes needed — not just "fix the title tag" but the exact new title tag content with the recommended text.
