'use client';

import { useState } from 'react';

interface VectorInputProps {
  onSearch: (vector: number[]) => void;
  isLoading: boolean;
}

export default function VectorInput({ onSearch, isLoading }: VectorInputProps) {
  const [inputMethod, setInputMethod] = useState<'manual' | 'random'>('manual');
  const [vectorDimension, setVectorDimension] = useState(384); // Common dimension for embedding models
  const [manualInput, setManualInput] = useState('');
  const [showExamples, setShowExamples] = useState(false);

  const generateRandomVector = () => {
    const vector = Array.from({ length: vectorDimension }, 
      () => Math.random() * 2 - 1 // Generate values between -1 and 1
    );
    return vector;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let vector: number[];
    if (inputMethod === 'manual') {
      try {
        vector = manualInput.split(',').map(num => parseFloat(num.trim()));
        if (vector.some(isNaN)) {
          throw new Error('Invalid vector format');
        }
      } catch {
        alert('Please enter valid comma-separated numbers');
        return;
      }
    } else {
      vector = generateRandomVector();
    }
    
    onSearch(vector);
  };

  const examples = [
    {
      title: "Text Embedding",
      description: "BERT/GPT embeddings for semantic text search",
      dimension: 384,
    },
    {
      title: "Image Feature Vector",
      description: "ResNet/EfficientNet embeddings for image similarity",
      dimension: 512,
    },
    {
      title: "User Behavior Vector",
      description: "Recommendation system embeddings",
      dimension: 128,
    }
  ];

  const setExample = (dimension: number) => {
    setVectorDimension(dimension);
    setInputMethod('random');
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          How to use
        </h3>
        <p className="text-sm text-blue-600 dark:text-blue-300">
          Enter vector values manually for specific searches, or generate random vectors to test similarity search performance. Common uses include finding similar documents, images, or user preferences in high-dimensional space.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button
          type="button"
          onClick={() => setInputMethod('manual')}
          className={`px-4 py-2 rounded-lg flex-1 ${
            inputMethod === 'manual'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          Manual Input
        </button>
        <button
          type="button"
          onClick={() => setInputMethod('random')}
          className={`px-4 py-2 rounded-lg flex-1 ${
            inputMethod === 'random'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          Random Vector
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {inputMethod === 'manual' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter vector values (comma-separated)
            </label>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              rows={3}
              placeholder="e.g., 0.5, -0.3, 0.8"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Enter the vector components as comma-separated numbers
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vector dimension
            </label>
            <input
              type="number"
              value={vectorDimension}
              onChange={(e) => setVectorDimension(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              min="1"
            />
            
            <button
              type="button"
              onClick={() => setShowExamples(!showExamples)}
              className="mt-2 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400"
            >
              {showExamples ? 'Hide examples' : 'Show common examples'}
            </button>

            {showExamples && (
              <div className="mt-4 space-y-3">
                {examples.map((example, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500"
                    onClick={() => setExample(example.dimension)}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {example.title}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {example.description}
                    </div>
                    <div className="text-sm text-gray-400 dark:text-gray-500">
                      Dimension: {example.dimension}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-2 px-4 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center`}
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Searching...
            </>
          ) : (
            'Search Similar Vectors'
          )}
        </button>
      </form>
    </div>
  );
}
