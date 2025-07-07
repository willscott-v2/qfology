import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Additional utility functions for the competitive intelligence system

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence)}%`;
}

export function categorizeEntity(name: string): string {
  const techKeywords = ['api', 'sdk', 'cloud', 'ai', 'ml', 'platform', 'software', 'app', 'tool'];
  const serviceKeywords = ['service', 'solution', 'support', 'consulting', 'management'];
  const industryKeywords = ['healthcare', 'finance', 'retail', 'education', 'enterprise'];
  
  const lowerName = name.toLowerCase();
  
  if (techKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'Technology';
  }
  if (serviceKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'Service';
  }
  if (industryKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'Industry';
  }
  
  return 'Other';
}

export function generateSearchPhrase(entities: Array<{name: string, confidence: number}>): string {
  // Take top 3 highest confidence entities and create a search phrase
  const topEntities = entities
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(e => e.name.toLowerCase());
  
  return topEntities.join(' ') || 'business software tools';
}

export function calculateMarketCoverage(entityName: string, allResults: any[]): number {
  const totalSites = allResults.length;
  let sitesWithEntity = 0;
  
  allResults.forEach(result => {
    const hasEntity = result.entities.some((entity: any) => 
      entity.name.toLowerCase() === entityName.toLowerCase()
    );
    if (hasEntity) sitesWithEntity++;
    
    // Also check competitor entities
    if (result.competitors) {
      result.competitors.forEach((competitor: any) => {
        if (competitor.entities) {
          const competitorHasEntity = competitor.entities.some((entity: any) =>
            entity.name.toLowerCase() === entityName.toLowerCase()
          );
          if (competitorHasEntity) sitesWithEntity++;
        }
      });
    }
  });
  
  return Math.round((sitesWithEntity / totalSites) * 100);
}

export function findUniqueEntities(targetResult: any, allResults: any[]): string[] {
  const targetEntities = targetResult.entities.map((e: any) => e.name.toLowerCase());
  const allOtherEntities = new Set<string>();
  
  allResults.forEach(result => {
    if (result.url !== targetResult.url) {
      result.entities.forEach((entity: any) => {
        allOtherEntities.add(entity.name.toLowerCase());
      });
      
      // Include competitor entities
      if (result.competitors) {
        result.competitors.forEach((competitor: any) => {
          if (competitor.entities) {
            competitor.entities.forEach((entity: any) => {
              allOtherEntities.add(entity.name.toLowerCase());
            });
          }
        });
      }
    }
  });
  
  return targetEntities.filter(entity => !allOtherEntities.has(entity));
}

export function exportToJSON(data: any, filename?: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV(results: any[], filename?: string): void {
  const csvRows = [];
  csvRows.push(['URL', 'Entity', 'Confidence', 'Category', 'Search Phrase', 'Summary']);
  
  results.forEach(result => {
    result.entities.forEach((entity: any) => {
      csvRows.push([
        result.url,
        entity.name,
        entity.confidence.toString(),
        entity.category || 'General',
        result.searchPhrase || '',
        (result.summary || '').replace(/"/g, '""')
      ]);
    });
  });

  const csvContent = csvRows.map(row => 
    row.map(field => `"${field}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `export-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function formatUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-green-600';
  if (confidence >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

export function getSuccessRate(competitors: any[]): number {
  if (!competitors || competitors.length === 0) return 0;
  const successful = competitors.filter(c => c.success).length;
  return Math.round((successful / competitors.length) * 100);
}