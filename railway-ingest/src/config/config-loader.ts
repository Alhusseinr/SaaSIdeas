import * as fs from 'fs';
import * as path from 'path';

export interface RedditConfig {
  subreddits: {
    [category: string]: string[];
  };
  phrases: {
    [category: string]: string[];
  };
  settings: {
    default_posts_per_search: number;
    default_time_range: string;
    rate_limit_delay_ms: number;
    subreddit_delay_ms: number;
    sorted_by: string[]
  };
}

export interface FilterConfig {
  physical_keywords: {
    [category: string]: string[];
  };
  software_keywords: {
    [category: string]: string[];
  };
  tech_regex: string;
}

class ConfigLoader {
  private redditConfig: RedditConfig | null = null;
  private filterConfig: FilterConfig | null = null;
  private configDir: string;

  constructor() {
    // Get config directory relative to project root
    this.configDir = path.join(process.cwd(), 'config');
  }

  private loadJsonFile<T>(filename: string): T {
    try {
      const filePath = path.join(this.configDir, filename);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent) as T;
    } catch (error) {
      throw new Error(`Failed to load config file ${filename}: ${error}`);
    }
  }

  getRedditConfig(): RedditConfig {
    if (!this.redditConfig) {
      this.redditConfig = this.loadJsonFile<RedditConfig>('reddit-config.json');
    }
    return this.redditConfig;
  }

  getFilterConfig(): FilterConfig {
    if (!this.filterConfig) {
      this.filterConfig = this.loadJsonFile<FilterConfig>('filter-config.json');
    }
    return this.filterConfig;
  }

  // Utility methods to get flattened arrays
  getAllSubreddits(): string[] {
    const config = this.getRedditConfig();
    const allSubreddits: string[] = [];
    
    Object.values(config.subreddits).forEach(categorySubreddits => {
      allSubreddits.push(...categorySubreddits);
    });
    
    // Remove duplicates
    return [...new Set(allSubreddits)];
  }

  getAllPhrases(): string[] {
    const config = this.getRedditConfig();
    const allPhrases: string[] = [];
    
    Object.values(config.phrases).forEach(categoryPhrases => {
      allPhrases.push(...categoryPhrases);
    });
    
    return allPhrases;
  }

  getSubredditsByCategory(categories: string[]): string[] {
    const config = this.getRedditConfig();
    const selectedSubreddits: string[] = [];
    
    categories.forEach(category => {
      if (config.subreddits[category]) {
        selectedSubreddits.push(...config.subreddits[category]);
      }
    });
    
    return [...new Set(selectedSubreddits)];
  }

  getPhrasesByCategory(categories: string[]): string[] {
    const config = this.getRedditConfig();
    const selectedPhrases: string[] = [];
    
    categories.forEach(category => {
      if (config.phrases[category]) {
        selectedPhrases.push(...config.phrases[category]);
      }
    });
    
    return selectedPhrases;
  }

  getAllPhysicalKeywords(): string[] {
    const config = this.getFilterConfig();
    const allKeywords: string[] = [];
    
    Object.values(config.physical_keywords).forEach(categoryKeywords => {
      allKeywords.push(...categoryKeywords);
    });
    
    return allKeywords;
  }

  getAllSoftwareKeywords(): string[] {
    const config = this.getFilterConfig();
    const allKeywords: string[] = [];
    
    Object.values(config.software_keywords).forEach(categoryKeywords => {
      allKeywords.push(...categoryKeywords);
    });
    
    return allKeywords;
  }

  getTechRegex(): RegExp {
    const config = this.getFilterConfig();
    return new RegExp(config.tech_regex, 'i');
  }

  // Hot reload capability
  reloadConfig(): void {
    this.redditConfig = null;
    this.filterConfig = null;
    console.log('Configuration reloaded from files');
  }
}

// Export singleton instance
export const configLoader = new ConfigLoader();