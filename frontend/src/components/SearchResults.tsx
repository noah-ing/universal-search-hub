'use client';

import { SearchResult } from './VectorSearch';

interface SearchResultsProps {
  results: SearchResult[];
}

export default function SearchResults({ results }: SearchResultsProps) {
  const formatVector = (vector: number[]) => {
    if (vector.length <= 10) {
      return vector.map(v => v.toFixed(3)).join(', ');
    }
    const start = vector.slice(0, 5).map(v => v.toFixed(3));
    const end = vector.slice(-5).map(v => v.toFixed(3));
    return `${start.join(', ')}, ... , ${end.join(', ')}`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Search Results
      </h2>
      
      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={index}
            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center mb-2">
              <div className="font-medium text-gray-900 dark:text-white">
                Result {index + 1}
              </div>
              <div className="ml-auto text-sm text-gray-500 dark:text-gray-300">
                Similarity: {(result.similarity * 100).toFixed(2)}%
              </div>
            </div>

            {/* Similarity Bar */}
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full mb-4">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${result.similarity * 100}%` }}
              />
            </div>

            {/* Vector Values */}
            <div className="text-sm text-gray-600 dark:text-gray-300 font-mono break-all">
              [{formatVector(result.vector)}]
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400">
          No results found
        </div>
      )}
    </div>
  );
}
