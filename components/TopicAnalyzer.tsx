// components/TopicAnalyzer.tsx - Enhanced Competitive Intelligence System v2.3
'use client';

import React, { useState } from 'react';

// TypeScript interfaces
interface Entity {
  name: string;
  type: string;
  confidence: number;
  url: string;
}

interface Topic {
  name: string;
  confidence: number;
  keywords: string[];
}

interface Competitor {
  name: string;
  url: string;
  description: string;
  source: 'serp' | 'input';
  entities?: Entity[];
}

interface MarketIntelligence {
  businessModels: string[];
  topics: string[];
  insights: string[];
}

interface AnalysisResult {
  entities: Entity[];
  topics: Topic[];
  competitors: Competitor[];
  marketIntelligence: MarketIntelligence;
  competitorSearchPhrase: string;
  mainTopics: string[];
  originalContent?: string;
}

const TopicAnalyzer: React.FC = () => {
  const [urls, setUrls] = useState<string>('');
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'analysis' | 'competitors' | 'intelligence'>('analysis');
  const [hasRunAnalysis, setHasRunAnalysis] = useState<boolean>(false);
  const [includeCompetitors, setIncludeCompetitors] = useState<boolean>(true);

  // Helper function to extract domain name from URL
  const extractDomainName = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const handleAnalyze = async () => {
    console.log('🔍 Starting analysis...');
    
    // Clear previous results and errors
    setResults(null);
    setError('');
    setHasRunAnalysis(false);
    
    // Validate input
    if (!urls.trim()) {
      setError('Please enter at least one URL to analyze');
      return;
    }

    // Parse URLs from input
    const urlList = urls.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urlList.length === 0) {
      setError('Please enter at least one valid URL');
      return;
    }

    console.log('📋 URLs to analyze:', urlList);
    
    setLoading(true);
    
    try {
      // Prepare request data - Fix parameter name to match backend
      const requestData = {
        urls: urlList,
        findCompetitors: includeCompetitors
      };

      console.log('📤 Sending request data:', requestData);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ API Error Response:', errorData);
        throw new Error(`HTTP error! status: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      console.log('✅ Analysis complete:', data);
      console.log('🔍 Data structure:', JSON.stringify(data, null, 2));
      
      // Process and set results - Handle the sophisticated backend response
      const processedResults: AnalysisResult = {
        // Extract from nested results array and map backend format to frontend format
        entities: (data.results?.[0]?.entities || []).map((entity: any) => ({
          name: entity.name,
          type: entity.category || 'Other',
          confidence: entity.confidence,
          url: data.results?.[0]?.url || ''
        })),
        topics: data.results?.[0]?.topics || [],
        competitors: [],
        marketIntelligence: {
          businessModels: [],
          topics: [],
          insights: []
        },
        competitorSearchPhrase: data.results?.[0]?.searchPhrase || '',
        mainTopics: [],
        originalContent: data.results?.[0]?.originalContent || ''
      };

      // Process competitors from backend format with entities
      if (data.results?.[0]?.competitors) {
        processedResults.competitors = data.results[0].competitors
          .filter((comp: any) => comp.success)
          .map((comp: any) => ({
            name: comp.title || extractDomainName(comp.url),
            url: comp.url,
            description: comp.snippet || comp.analysis || '',
            source: 'serp' as const,
            entities: comp.entities || []
          }));
      }

      // Process market intelligence with integrity checks
      if (data.marketIntelligence) {
        const mi = data.marketIntelligence;
        const successfulCompetitors = processedResults.competitors.length;
        const totalSites = 1 + successfulCompetitors;
        
        console.log('🔍 Market Intelligence Debug:', {
          totalSites,
          successfulCompetitors,
          commonEntities: mi.commonEntities
        });

        processedResults.marketIntelligence = {
          businessModels: mi.industryDistribution?.map((ind: any) => 
            `${ind.category}: ${ind.count} mentions across competitive landscape`
          ) || [],
          
          topics: mi.commonEntities?.map((entity: any) => {
            const rawFreq = entity.frequency;
            let actualSites: number;
            let percentage: number;
            
            if (rawFreq > 100) {
              actualSites = Math.min(Math.round(rawFreq / 100), totalSites);
              percentage = Math.round((actualSites / totalSites) * 100);
            } else {
              percentage = Math.min(rawFreq, 100);
              actualSites = Math.round((percentage / 100) * totalSites);
            }
            
            if (actualSites > totalSites) actualSites = totalSites;
            if (percentage > 100) percentage = 100;
            
            return `${entity.name} (${actualSites}/${totalSites} sites - ${percentage}%)`;
          }) || [],
          
          insights: [
            `Market Analysis: Analyzed ${totalSites} sites (1 input + ${successfulCompetitors} competitors)`,
            
            ...mi.competitiveGaps?.map((gap: any) => {
              const coverage = Math.min(gap.coverage, 100);
              const sitesWithGap = Math.round((coverage / 100) * totalSites);
              return `Opportunity: "${gap.entity}" mentioned by ${sitesWithGap}/${totalSites} sites (${coverage}% coverage)`;
            }) || [],
            
            ...mi.uniquePositioning?.flatMap((pos: any) => 
              pos.uniqueEntities.slice(0, 2).map((entity: string) => 
                `Unique positioning: "${entity}" only found at ${extractDomainName(pos.url)}`
              )
            ) || [],
            
            mi.commonEntities?.length > 0 ? 
              `High competition areas: ${mi.commonEntities.slice(0, 3).map((e: any) => e.name).join(', ')}` : 
              'No high-competition areas identified'
          ]
        };
      }

      // Extract main topics from entities
      processedResults.mainTopics = processedResults.entities
        .filter(entity => entity.confidence >= 85 && ['Service', 'Product', 'Technology'].includes(entity.type))
        .map(entity => entity.name)
        .slice(0, 5);

      console.log('📊 Processed results:', processedResults);
      
      setResults(processedResults);
      setHasRunAnalysis(true);
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      setError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setHasRunAnalysis(true);
    } finally {
      setLoading(false);
    }
  };

  const exportData = (format: 'json' | 'csv') => {
    if (!results) return;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'competitive-intelligence.json';
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const csvData = [
        ['Type', 'Name', 'Confidence/URL', 'Description'],
        ...results.entities.map(e => ['Entity', e.name, `${e.confidence}%`, e.type]),
        ...results.competitors.map(c => ['Competitor', c.name, c.url, c.description])
      ];
      
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'competitive-intelligence.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-blue-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (hasData: boolean, isLoading: boolean) => {
    if (isLoading) return '⟳';
    if (hasData) return '✓';
    return '○';
  };

  const getStatusColor = (hasData: boolean, isLoading: boolean) => {
    if (isLoading) return 'text-blue-500';
    if (hasData) return 'text-green-500';
    return 'text-gray-400';
  };

  const getAnalysisStatusText = () => {
    if (loading) return 'Analyzing...';
    if (!hasRunAnalysis) return 'Ready to analyze';
    if (results) {
      const competitorText = includeCompetitors ? ` | ${results.competitors.length} competitors found` : '';
      const topicText = results.topics?.length ? ` | ${results.topics.length} topics` : '';
      return `Analysis complete | ${results.entities.length} entities extracted${topicText}${competitorText}`;
    }
    return 'Analysis failed';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Enhanced Competitive Intelligence System
        </h1>
        <p className="text-gray-600">
          Advanced topic analysis and competitor discovery with market intelligence
        </p>
      </div>

      {/* Input Section */}
      <div className="mb-8">
        <div className="flex gap-4">
          <div className="flex-1">
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={`Enter URLs to analyze (one per line)\nhttps://example.com/page1\nhttps://example.com/page2`}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              disabled={loading}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        
        {/* Competitor Discovery Option */}
        <div className="mt-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={includeCompetitors}
              onChange={(e) => setIncludeCompetitors(e.target.checked)}
              disabled={loading}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Include competitor discovery via SerpAPI (discovers competitors from search results)
            </span>
          </label>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-600 font-medium">Analysis Error</div>
          </div>
          <div className="text-red-700 mt-1">{error}</div>
          <div className="text-red-600 text-sm mt-1">
            Check the console for more details or try a different URL.
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Original Analysis
          </button>
          <button
            onClick={() => setActiveTab('competitors')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'competitors'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Competitor Discovery
          </button>
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'intelligence'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Market Intelligence
          </button>
        </nav>
      </div>

      {/* Analysis Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Analysis Status</h3>
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <span className={getStatusColor(hasRunAnalysis && results !== null, loading)}>
              {getStatusIcon(hasRunAnalysis && results !== null, loading)}
            </span>
            <span>
              {getAnalysisStatusText()}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* Main Topics from Primary URL */}
          {results?.mainTopics && results.mainTopics.length > 0 && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">Main Topics Discovered</h3>
              <div className="flex flex-wrap gap-2">
                {results.mainTopics.map((topic, index) => (
                  <span key={index} className="px-3 py-1 bg-purple-200 text-purple-800 rounded-full text-sm">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Competitor Search Phrase */}
          {results?.competitorSearchPhrase && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Competitor Search Phrase</h3>
              <p className="text-blue-800">{results.competitorSearchPhrase}</p>
            </div>
          )}

          {/* Entity Analysis */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Entity Analysis for: {urls.split('\n')[0] || 'No URL'}
            </h3>
            
            {results?.entities && results.entities.length > 0 ? (
              <div className="grid gap-4">
                {results.entities.map((entity, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{entity.name}</h4>
                      <span className={`font-medium ${getConfidenceColor(entity.confidence)}`}>
                        {entity.confidence}%
                      </span>
                    </div>
                    {entity.type && (
                      <p className="text-sm text-gray-600 mb-2">Type: {entity.type}</p>
                    )}
                    {entity.url && (
                      <a
                        href={entity.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                      >
                        {entity.url} ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No entities extracted yet. Try analyzing a URL.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'competitors' && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Competitor Discovery</h3>
          
          {results?.competitors && results.competitors.length > 0 ? (
            <div className="space-y-4">
              {/* Check if input URL appears in competitor results */}
              {(() => {
                const inputDomain = extractDomainName(urls.split('\n')[0] || '');
                const selfDiscovered = results.competitors.some(comp => 
                  extractDomainName(comp.url) === inputDomain
                );
                
                return selfDiscovered && (
                  <div className="p-4 bg-green-100 border border-green-300 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-green-600 text-lg mr-2">🎯</span>
                      <div>
                        <h4 className="font-medium text-green-900">Self-Discovery Validation</h4>
                        <p className="text-green-800 text-sm mt-1">
                          Great news! Your website ({inputDomain}) appears in the SerpAPI results, 
                          indicating you rank well for your target keywords.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <h4 className="font-medium text-green-900 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  SerpAPI Discovered Competitors ({results.competitors.length})
                </h4>
                <div className="grid gap-4">
                  {results.competitors.map((competitor, index) => {
                    const inputDomain = extractDomainName(urls.split('\n')[0] || '');
                    const competitorDomain = extractDomainName(competitor.url);
                    const isSelfDiscovery = competitorDomain === inputDomain;
                    
                    return (
                      <div 
                        key={index} 
                        className={`p-4 border rounded-lg ${
                          isSelfDiscovery 
                            ? 'border-blue-300 bg-blue-50' 
                            : 'border-green-200 bg-green-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">{competitor.name}</h5>
                          <div className="flex items-center space-x-2">
                            {isSelfDiscovery && (
                              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                                Your Site
                              </span>
                            )}
                            <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                              SerpAPI
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{competitor.description}</p>
                        <a
                          href={competitor.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                        >
                          {competitor.url} ↗
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 italic mb-2">No competitors discovered yet.</p>
              {!includeCompetitors && (
                <p className="text-sm text-orange-600">
                  💡 Enable "Include competitor discovery" to find competitors via SerpAPI
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'intelligence' && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Market Intelligence</h3>
          
          {results?.marketIntelligence && (
            results.marketIntelligence.businessModels.length > 0 || 
            results.marketIntelligence.topics.length > 0 || 
            results.marketIntelligence.insights.length > 0
          ) ? (
            <div className="grid gap-6">
              {/* Competitive Landscape Overview */}
              {results?.competitors && results.competitors.length > 0 && (
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <h4 className="font-medium text-indigo-900 mb-3">📊 Competitive Landscape Overview</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-indigo-800">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{results.competitors.length + 1}</div>
                      <div className="text-sm">Total Sites Analyzed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{results.competitors.filter(c => c.source === 'serp').length}</div>
                      <div className="text-sm">SerpAPI Discoveries</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{results.entities.length}</div>
                      <div className="text-sm">Your Entities</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {results.competitors.reduce((sum, comp) => sum + (comp.entities?.length || 0), 0)}
                      </div>
                      <div className="text-sm">Competitive Entities</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Business Categories */}
              {results.marketIntelligence.businessModels.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">🏢 Business Categories in Market</h4>
                  <ul className="list-disc list-inside text-green-800 space-y-1">
                    {results.marketIntelligence.businessModels.map((model, index) => (
                      <li key={index}>{model}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Common Market Topics */}
              {results.marketIntelligence.topics.length > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">🔥 Most Common Market Topics</h4>
                  <div className="space-y-2">
                    {results.marketIntelligence.topics.map((topic, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-blue-100 rounded">
                        <span className="text-blue-800">{topic.split(' (')[0]}</span>
                        <span className="text-xs bg-blue-200 text-blue-900 px-2 py-1 rounded">
                          {topic.split(' (')[1]?.replace(')', '') || 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topical Opportunities - Content-Based Gap Analysis */}
              {results?.competitors && results.competitors.length > 0 && (
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-2">💡 Topical Areas of Opportunity</h4>
                  <div className="space-y-3">
                    {(() => {
                      // Extract terms from ACTUAL WEBPAGE CONTENT (not just entities)
                      const originalContent = results.originalContent?.toLowerCase() || '';
                      const primaryUrl = urls.split('\n')[0]?.trim() || '';
                      const urlPath = primaryUrl.split('/').join(' ').toLowerCase();
                      
                      // Create comprehensive content-based exclusion set
                      const contentWords = new Set([
                        // From actual webpage content
                        ...originalContent.split(/[\s\-_.,;:!?()]+/).filter(word => word.length > 3),
                        
                        // From extracted entities (as backup)
                        ...results.entities.map(e => e.name.toLowerCase()),
                        ...results.entities.flatMap(e => e.name.toLowerCase().split(/[\s\-_]+/)),
                        
                        // From URL path
                        ...urlPath.split(/[\s\-_\/]+/).filter(word => word.length > 2),
                        
                        // From competitor search phrase
                        ...results.competitorSearchPhrase.toLowerCase().split(/[\s\-_]+/),
                      ]);

                      console.log('🔍 Content words for exclusion:', Array.from(contentWords).slice(0, 20));

                      const competitorOpportunities = new Map<string, {sites: string[], confidence: number, category: string}>();
                      
                      // Collect truly unique entities from competitors
                      results.competitors.forEach(comp => {
                        if (comp.source === 'serp' && comp.entities) {
                          comp.entities.forEach((entity: any) => {
                            const entityName = entity.name.toLowerCase();
                            const entityWords = entityName.split(/[\s\-_]+/);
                            
                            // Content-based filtering for genuine opportunities
                            const isGenuineOpportunity = (
                              entity.confidence >= 85 && // High confidence
                              entity.name.length > 2 &&
                              entity.name.length <= 30 && // Not overly long descriptions
                              
                              // KEY FIX: Check against actual webpage content
                              !originalContent.includes(entityName) &&
                              !originalContent.includes(entity.name.toLowerCase()) &&
                              !entityWords.some((word: string) => contentWords.has(word)) &&
                              
                              // Additional quality filters
                              (entity.category === 'Product' || 
                               entity.category === 'Technology' ||
                               (entity.category === 'Service' && entity.confidence >= 90)) &&
                              
                              // Must be specific tools/platforms (contain capital letters or tech terms)
                              (/[A-Z]/.test(entity.name) || 
                               ['crm', 'erp', 'api', 'sdk', 'saas', 'platform', 'tool', 'software'].some((tech: string) => 
                                 entityName.includes(tech)
                               )) &&
                              
                              // Exclude generic terms
                              !['marketing', 'digital', 'content', 'social', 'search', 'optimization', 
                                'management', 'strategy', 'solution', 'service', 'agency', 'company',
                                'business', 'analytics', 'tracking', 'lead', 'generation', 'email',
                                'campaign', 'advertising', 'promotion', 'seo', 'sem', 'ppc'].some((generic: string) =>
                                entityName.includes(generic)
                              )
                            );
                            
                            if (isGenuineOpportunity) {
                              if (!competitorOpportunities.has(entityName)) {
                                competitorOpportunities.set(entityName, {
                                  sites: [],
                                  confidence: entity.confidence,
                                  category: entity.category || 'Other'
                                });
                              }
                              
                              const oppData = competitorOpportunities.get(entityName)!;
                              const domain = extractDomainName(comp.url);
                              if (!oppData.sites.includes(domain)) {
                                oppData.sites.push(domain);
                                oppData.confidence = Math.max(oppData.confidence, entity.confidence);
                              }
                            }
                          });
                        }
                      });

                      console.log('🔍 Found opportunities:', Array.from(competitorOpportunities.keys()));

                      // Filter to high-value opportunities with multiple mentions
                      const opportunities = Array.from(competitorOpportunities.entries())
                        .filter(([name, data]) => data.sites.length >= 2) // Multiple competitors mention it
                        .sort((a, b) => {
                          // Prioritize: confidence > site count > category relevance
                          const confidenceDiff = b[1].confidence - a[1].confidence;
                          if (Math.abs(confidenceDiff) > 3) return confidenceDiff;
                          
                          const sitesDiff = b[1].sites.length - a[1].sites.length;
                          if (sitesDiff !== 0) return sitesDiff;
                          
                          // Prefer Products and Technologies
                          const aScore = a[1].category === 'Product' ? 3 : (a[1].category === 'Technology' ? 2 : 1);
                          const bScore = b[1].category === 'Product' ? 3 : (b[1].category === 'Technology' ? 2 : 1);
                          return bScore - aScore;
                        })
                        .slice(0, 3) // Top 3 most relevant
                        .map(([name, data]) => ({
                          name: name.split(' ').map((word: string) => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' '),
                          sites: data.sites,
                          confidence: data.confidence,
                          category: data.category
                        }));

                      return opportunities.length > 0 ? opportunities.map((opp, index) => (
                        <div key={index} className="p-3 bg-orange-100 rounded border-l-4 border-orange-400">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-orange-900">
                              Consider: "{opp.name}"
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded">
                                {opp.category}
                              </span>
                              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                                {opp.confidence}% conf
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-orange-700 mt-1">
                            Found at {opp.sites.length} competitor{opp.sites.length > 1 ? 's' : ''}: {opp.sites.slice(0, 3).join(', ')}
                            {opp.sites.length > 3 && ` +${opp.sites.length - 3} more`}
                          </div>
                          <div className="text-xs text-orange-600 mt-1">
                            💡 Specific tool/platform not mentioned in your webpage content
                          </div>
                        </div>
                      )) : (
                        <div className="p-3 bg-green-100 rounded border-l-4 border-green-400">
                          <div className="text-green-800 font-medium">
                            🎯 Comprehensive Content Coverage!
                          </div>
                          <div className="text-green-700 text-sm mt-1">
                            Your webpage content thoroughly covers the key tools and platforms competitors mention. 
                            You have excellent competitive coverage in this market segment.
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              
              {/* Strategic Insights */}
              {results.marketIntelligence.insights.length > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">🎯 Strategic Insights</h4>
                  <ul className="list-disc list-inside text-purple-800 space-y-1">
                    {results.marketIntelligence.insights.map((insight, index) => (
                      <li key={index}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Competitor Domains */}
              {results?.competitors && results.competitors.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">🌐 Key Competitor Domains</h4>
                  <div className="flex flex-wrap gap-2">
                    {results.competitors.slice(0, 8).map((comp, idx) => (
                      <a
                        key={idx}
                        href={comp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm transition-colors"
                      >
                        {extractDomainName(comp.url)} ↗
                      </a>
                    ))}
                    {results.competitors.length > 8 && (
                      <span className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm">
                        +{results.competitors.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 italic mb-2">No market intelligence available yet.</p>
              {!includeCompetitors && (
                <p className="text-sm text-orange-600">
                  💡 Enable competitor discovery to generate richer market intelligence
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Export Section */}
      {results && hasRunAnalysis && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Export Results</h3>
          <div className="flex space-x-4">
            <button
              onClick={() => exportData('json')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export as JSON
            </button>
            <button
              onClick={() => exportData('csv')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Export as CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicAnalyzer;