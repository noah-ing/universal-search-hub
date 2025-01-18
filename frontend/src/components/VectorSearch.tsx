'use client';

import { useState } from 'react';
import VectorInput from './VectorInput';
import SearchResults from './SearchResults';

export interface SearchResult {
  vector: number[];
  similarity: number;
}

export default function VectorSearch() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (vector: number[]) => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vector }),
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      // TODO: Add proper error handling
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <VectorInput onSearch={handleSearch} isLoading={isLoading} />
      </div>
      
      {searchResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <SearchResults results={searchResults} />
        </div>
      )}
    </div>
  );
}
