// app/api/analyze/route.ts - Enhanced with Original Content for Opportunity Filtering
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getJson } from 'serpapi';
import { JSDOM } from 'jsdom';

// Types
interface Entity {
  name: string;
  confidence: number;
  category?: string;
}

interface CompetitorResult {
  url: string;
  title: string;
  snippet: string;
  position: number;
  entities?: Entity[];
  analysis?: string;
  error?: string;
  success: boolean;
}

interface AnalysisResult {
  url: string;
  entities: Entity[];
  searchPhrase: string;
  summary: string;
  competitors?: CompetitorResult[];
  originalContent?: string; // NEW: Add original content for opportunity filtering
}

interface MarketIntelligence {
  commonEntities: { name: string; frequency: number }[];
  industryDistribution: { category: string; count: number }[];
  competitiveGaps: { entity: string; coverage: number }[];
  uniquePositioning: { url: string; uniqueEntities: string[] }[];
}

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getFromCache(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function extractContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, nav, footer, header');
    scripts.forEach(el => el.remove());

    // Extract main content
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      'article',
      '.post-content',
      '.entry-content'
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        content = element.textContent || '';
        break;
      }
    }

    if (!content) {
      content = document.body?.textContent || '';
    }

    return content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000); // Limit content length

  } catch (error) {
    console.error(`Content extraction failed for ${url}:`, error);
    throw error;
  }
}

async function analyzeWithGemini(content: string, url: string, gemini: any): Promise<{ entities: Entity[]; summary: string; searchPhrase: string }> {
  const prompt = `Analyze this website content and extract business entities. Return ONLY a JSON object with this exact structure:

{
  "entities": [
    {"name": "Entity Name", "confidence": 85, "category": "Technology|Product|Service|Industry|Feature|Other"}
  ],
  "summary": "Brief 2-3 sentence business summary",
  "searchPhrase": "3-6 word search phrase to find competitors"
}

Focus on:
- Products, services, technologies, features
- Industry terms and business concepts
- Target markets and use cases
- Confidence scores 60-95%

Content to analyze:
${content.substring(0, 4000)}

Website: ${url}`;

  try {
    const result = await gemini.generateContent(prompt);
    const text = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate and clean response
    const entities = (parsed.entities || [])
      .filter((e: any) => e.name && typeof e.confidence === 'number')
      .map((e: any) => ({
        name: e.name.trim(),
        confidence: Math.min(95, Math.max(60, e.confidence)),
        category: e.category || 'Other'
      }));

    return {
      entities,
      summary: parsed.summary || 'Business analysis unavailable',
      searchPhrase: parsed.searchPhrase || 'business software tools'
    };

  } catch (error) {
    console.error('Gemini analysis failed:', error);
    throw error;
  }
}

async function findCompetitors(searchPhrase: string): Promise<CompetitorResult[]> {
  const serpApiKey = process.env.SERPAPI_API_KEY;
  if (!serpApiKey) {
    throw new Error('SerpAPI key not configured');
  }

  try {
    const results = await getJson({
      engine: "google",
      api_key: serpApiKey,
      q: searchPhrase,
      num: 10
    });

    const competitors: CompetitorResult[] = [];
    
    if (results.organic_results) {
      for (let i = 0; i < Math.min(10, results.organic_results.length); i++) {
        const result = results.organic_results[i];
        competitors.push({
          url: result.link,
          title: result.title,
          snippet: result.snippet || '',
          position: result.position || i + 1,
          success: false
        });
      }
    }

    return competitors;
  } catch (error) {
    console.error('SerpAPI search failed:', error);
    throw error;
  }
}

async function analyzeCompetitor(competitor: CompetitorResult, gemini: any): Promise<CompetitorResult> {
  try {
    const content = await extractContent(competitor.url);
    const analysis = await analyzeWithGemini(content, competitor.url, gemini);
    
    return {
      ...competitor,
      entities: analysis.entities,
      analysis: analysis.summary,
      success: true
    };
  } catch (error) {
    return {
      ...competitor,
      error: error instanceof Error ? error.message : 'Analysis failed',
      success: false
    };
  }
}

function generateMarketIntelligence(results: AnalysisResult[]): MarketIntelligence {
  const allEntities: { name: string; category: string; url: string }[] = [];
  const totalSites = results.length;

  // Collect all entities from all sites
  results.forEach(result => {
    result.entities.forEach(entity => {
      allEntities.push({
        name: entity.name.toLowerCase(),
        category: entity.category || 'Other',
        url: result.url
      });
    });

    // Include competitor entities
    if (result.competitors) {
      result.competitors.forEach(comp => {
        if (comp.entities) {
          comp.entities.forEach(entity => {
            allEntities.push({
              name: entity.name.toLowerCase(),
              category: entity.category || 'Other',
              url: comp.url
            });
          });
        }
      });
    }
  });

  // Calculate entity frequencies
  const entityCounts = new Map<string, Set<string>>();
  allEntities.forEach(entity => {
    if (!entityCounts.has(entity.name)) {
      entityCounts.set(entity.name, new Set());
    }
    entityCounts.get(entity.name)!.add(entity.url);
  });

  // Common entities (40%+ coverage)
  const commonEntities = Array.from(entityCounts.entries())
    .map(([name, urls]) => ({
      name,
      frequency: Math.round((urls.size / totalSites) * 100)
    }))
    .filter(entity => entity.frequency >= 40)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  // Industry distribution
  const categoryCount = new Map<string, number>();
  allEntities.forEach(entity => {
    categoryCount.set(entity.category, (categoryCount.get(entity.category) || 0) + 1);
  });

  const industryDistribution = Array.from(categoryCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Competitive gaps (20-30% coverage)
  const competitiveGaps = Array.from(entityCounts.entries())
    .map(([name, urls]) => ({
      entity: name,
      coverage: Math.round((urls.size / totalSites) * 100)
    }))
    .filter(gap => gap.coverage >= 20 && gap.coverage <= 30)
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, 10);

  // Unique positioning (entities with 1-2 site coverage)
  const uniquePositioning = results.map(result => {
    const uniqueEntities = result.entities
      .filter(entity => {
        const coverage = entityCounts.get(entity.name.toLowerCase())?.size || 0;
        return coverage <= 2;
      })
      .map(entity => entity.name)
      .slice(0, 5);

    return {
      url: result.url,
      uniqueEntities
    };
  }).filter(pos => pos.uniqueEntities.length > 0);

  return {
    commonEntities,
    industryDistribution,
    competitiveGaps,
    uniquePositioning
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { urls, findCompetitors: shouldFindCompetitors } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'urls field is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Check for API keys
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json(
        { error: 'Google Gemini API key not configured' },
        { status: 500 }
      );
    }

    const gemini = new GoogleGenerativeAI(geminiKey).getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const results: AnalysisResult[] = [];

    // Analyze each URL
    for (const url of urls) {
      try {
        const cacheKey = `analysis:${url}`;
        let cachedResult = getFromCache(cacheKey);
        
        if (!cachedResult) {
          console.log(`Analyzing URL: ${url}`);
          const content = await extractContent(url);
          const analysis = await analyzeWithGemini(content, url, gemini);
          
          cachedResult = {
            url,
            entities: analysis.entities,
            searchPhrase: analysis.searchPhrase,
            summary: analysis.summary,
            originalContent: content // STORE ORIGINAL CONTENT
          };
          
          setCache(cacheKey, cachedResult);
        }

        const result: AnalysisResult = { ...cachedResult };

        // Find and analyze competitors if requested
        if (shouldFindCompetitors && process.env.SERPAPI_API_KEY) {
          try {
            console.log(`Finding competitors for: ${result.searchPhrase}`);
            const competitors = await findCompetitors(result.searchPhrase);
            
            // Analyze competitors in parallel (limit to 5 concurrent)
            const competitorAnalysisPromises = competitors.slice(0, 10).map(competitor =>
              analyzeCompetitor(competitor, gemini)
            );
            
            // Process in batches of 3 to avoid overwhelming servers
            const batchSize = 3;
            const analyzedCompetitors: CompetitorResult[] = [];
            
            for (let i = 0; i < competitorAnalysisPromises.length; i += batchSize) {
              const batch = competitorAnalysisPromises.slice(i, i + batchSize);
              const batchResults = await Promise.all(batch);
              analyzedCompetitors.push(...batchResults);
              
              // Brief pause between batches
              if (i + batchSize < competitorAnalysisPromises.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            result.competitors = analyzedCompetitors;
            console.log(`Analyzed ${analyzedCompetitors.filter(c => c.success).length}/${analyzedCompetitors.length} competitors successfully`);
            
          } catch (competitorError) {
            console.error('Competitor analysis failed:', competitorError);
            // Continue with main analysis even if competitor analysis fails
          }
        }

        results.push(result);
        
      } catch (error) {
        console.error(`Failed to analyze ${url}:`, error);
        results.push({
          url,
          entities: [],
          searchPhrase: '',
          summary: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          competitors: [],
          originalContent: '' // Include even for failed analyses
        });
      }
    }

    // Generate market intelligence if we have multiple results
    let marketIntelligence: MarketIntelligence | null = null;
    if (results.length > 1 || (results.length === 1 && results[0].competitors && results[0].competitors.length > 0)) {
      try {
        marketIntelligence = generateMarketIntelligence(results);
      } catch (intelligenceError) {
        console.error('Market intelligence generation failed:', intelligenceError);
      }
    }

    return NextResponse.json({
      results,
      marketIntelligence,
      metadata: {
        totalUrls: urls.length,
        successfulAnalyses: results.filter(r => r.entities.length > 0).length,
        competitorAnalysisEnabled: shouldFindCompetitors && !!process.env.SERPAPI_API_KEY,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        error: 'Analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}