import type { NextApiRequest, NextApiResponse } from 'next';

interface TrustedResult {
  title: string;
  company: string;
  url: string;
  snippet: string;
  source: string;
}

interface AggregatorResult {
  title: string;
  company: string;
  aggregator_url: string;
  snippet: string;
  aggregator: string;
}

interface VerifiedAggregator extends AggregatorResult {
  verified_url?: string;
  verified: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    trusted,
    aggregators,
    instructions,
    specialInstructions,
    apiKeyOverride,
    serperKeyOverride,
    titlesSearched,
  } = req.body;

  const anthropicKey = apiKeyOverride || process.env.ANTHROPIC_API_KEY;
  const serperKey = serperKeyOverride || process.env.SERPER_API_KEY;

  if (!anthropicKey) return res.status(400).json({ error: 'No Anthropic API key.' });
  if (!serperKey) return res.status(400).json({ error: 'No Serper API key.' });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Pass 2: verify every aggregator result — no cap
  const verifiedAggregators: VerifiedAggregator[] = [];

  for (const agg of (aggregators as AggregatorResult[])) {
    if (!agg.company || agg.company === 'Unknown') {
      verifiedAggregators.push({ ...agg, verified: false });
      continue;
    }

    try {
      const verifyQuery = `"${agg.title}" "${agg.company}" careers apply job`;
      const serperRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: verifyQuery, num: 5 }),
      });

      if (serperRes.ok) {
        const data = await serperRes.json();
        const results = (data.organic || []) as { link: string; title: string }[];

        // Check if any result is on the company's own domain (not an aggregator)
        const aggregatorDomains = ['linkedin.com', 'indeed.com', 'ziprecruiter.com', 'glassdoor.com',
          'monster.com', 'careerbuilder.com', 'dice.com', 'builtin.com', 'simplyhired.com',
          'snagajob.com', 'flexjobs.com', 'talent.com', 'google.com'];

        const companyResult = results.find(r => {
          try {
            const domain = new URL(r.link).hostname.toLowerCase();
            return !aggregatorDomains.some(d => domain.includes(d));
          } catch { return false; }
        });

        if (companyResult) {
          verifiedAggregators.push({ ...agg, verified: true, verified_url: companyResult.link });
        } else {
          verifiedAggregators.push({ ...agg, verified: false });
        }
      } else {
        verifiedAggregators.push({ ...agg, verified: false });
      }
    } catch {
      verifiedAggregators.push({ ...agg, verified: false });
    }
  }

  // Build combined results text for Claude Pass 2
  const trustedText = (trusted as TrustedResult[]).map(r =>
    `[TRUSTED - ${r.source.toUpperCase()}]\nTitle: ${r.title}\nCompany: ${r.company}\nURL: ${r.url}\nSnippet: ${r.snippet}\nAudit: ✓ Direct ATS Verified`
  ).join('\n\n');

  const verifiedAggText = verifiedAggregators.filter(r => r.verified).map(r =>
    `[AGGREGATOR - VERIFIED]\nTitle: ${r.title}\nCompany: ${r.company}\nOriginal URL: ${r.aggregator_url}\nVerified Company URL: ${r.verified_url}\nSnippet: ${r.snippet}\nAudit: ✓ Company Domain Verified`
  ).join('\n\n');

  const unverifiedAggText = verifiedAggregators.filter(r => !r.verified).map(r =>
    `[AGGREGATOR - UNVERIFIED]\nTitle: ${r.title}\nCompany: ${r.company}\nURL: ${r.aggregator_url}\nSnippet: ${r.snippet}\nAudit: ✓ Aggregator Listed`
  ).join('\n\n');

  const allResultsText = [
    trustedText && `=== DIRECT ATS / COMPANY DOMAIN ===\n${trustedText}`,
    verifiedAggText && `=== VERIFIED COMPANY DOMAIN (from aggregator) ===\n${verifiedAggText}`,
    unverifiedAggText && `=== AGGREGATOR LISTED (unverified) ===\n${unverifiedAggText}`,
  ].filter(Boolean).join('\n\n========\n\n');

  const finalInstructions = specialInstructions
    ? `${instructions}\n\nSPECIAL INSTRUCTIONS:\n${specialInstructions}`
    : instructions;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: `${finalInstructions}

TODAY: ${today}
TITLES SEARCHED: ${(titlesSearched || []).join(', ')}

You are building job cards from verified search results. URL verification has already been completed by the search system.

Your ONLY responsibility is Layer 3: assess each role for fit against the candidate profile and build complete job cards.

LOCATION: Read the Location field from these instructions and interpret it fully — handle any format (full state name, abbreviation, city name, mixed case) — no assumptions about format.

CATEGORY: Use the actual seniority level of the role as it appears — e.g. "Entry", "Mid", "Senior", "Lead", "Manager", "Director", "VP", "C-Suite", "Executive". Do not force into any predefined list.

Return ONLY a valid JSON array. Each job object must have:
{
  "id": "unique-slug",
  "company": "Company Name",
  "title": "Exact Job Title",
  "category": "seniority level string",
  "isRemote": true|false,
  "isHybrid": true|false,
  "isOnsite": true|false,
  "location": "City, ST — for hybrid/onsite only, empty string for remote",
  "industry": ["sector1", "sector2"],
  "salaryMin": 0,
  "salaryMax": 0,
  "salaryDisplay": "$0 — Not Listed",
  "salaryNote": "Posted|Estimated|Not Listed",
  "rating": 7,
  "auditLabel": "use exactly one of: '✓ Direct ATS Verified' or '✓ Company Domain Verified' or '✓ Aggregator Listed' — then append the date like: '✓ Direct ATS Verified May 12 2026'",
  "roleSummary": "2-3 sentence summary",
  "whyYouFit": ["bullet based on candidate profile"],
  "requirements": ["requirement from posting"],
  "companyInfo": "2-3 sentences about company",
  "goldFlags": ["positive signal"],
  "redFlags": ["concern if any"],
  "applyUrl": "best available apply URL",
  "careersUrl": "company careers page if known",
  "aboutUrl": "company about page if known",
  "jobDescUrl": "job description URL",
  "postedDate": "YYYY-MM-DD or empty string",
  "excluded": false
}

Also include excluded jobs (failed Layer 3 or insufficient data):
{
  "id": "slug",
  "company": "Company",
  "title": "Title",
  "layerFailed": "Layer 3",
  "reason": "specific reason",
  "excluded": true
}

FIT RATING:
9-10 = Near-perfect match across title, industry, scope, and candidate profile
7-8  = Strong match with one bridgeable gap
5-6  = Solid fundamentals, notable gaps
Below 5 = Exclude

Return ONLY valid JSON array. No markdown, no explanation.`,
        messages: [{
          role: 'user',
          content: `Build job cards from these verified results:\n\n${allResultsText}`,
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json();
      return res.status(claudeRes.status).json({ error: err.error?.message || 'Claude API error in Pass 2' });
    }

    const claudeData = await claudeRes.json();
    const raw = claudeData.content?.[0]?.text || '[]';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let jobs;
    try {
      jobs = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        jobs = JSON.parse(match[0]);
      } else {
        return res.status(500).json({ error: 'Failed to parse job results from Pass 2.' });
      }
    }

    return res.status(200).json({ jobs });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error in Pass 2';
    return res.status(500).json({ error: message });
  }
}
