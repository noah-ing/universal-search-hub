'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { vectorTemplates } from '../types/vector';
import { withErrorBoundary } from './ErrorBoundary';
import LoadingSpinner, { InlineLoading } from './LoadingSpinner';
import { logger } from '../lib/logger';
import { performanceMonitor } from '../lib/performance';
import type { VectorTemplate } from '../types/app';

interface VectorInputProps {
  onSearch: (vector: number[]) => void;
  isLoading: boolean;
}

type InputMethod = 'manual' | 'random' | 'file' | 'template';

// Get all supported dimensions from vector templates
const SUPPORTED_DIMENSIONS = Array.from(new Set([
  ...Object.values(vectorTemplates).map(t => t.dimension),
  384 // Include the default dimension
])).sort((a, b) => a - b);

// Default to the smallest supported dimension
const DEFAULT_DIMENSION = SUPPORTED_DIMENSIONS[0];

function VectorInput({ onSearch, isLoading }: VectorInputProps) {
  const [inputMethod, setInputMethod] = useState<InputMethod>('template');
  const [manualInput, setManualInput] = useState('');
  const [selectedDimension, setSelectedDimension] = useState(DEFAULT_DIMENSION);
  const [preprocessing, setPreprocessing] = useState<'none' | 'normalize' | 'standardize'>('none');
  const [error, setError] = useState<string | null>(null);
  const [currentVector, setCurrentVector] = useState<number[] | null>(null);

  const processVector = useCallback((vector: number[]) => {
    return performanceMonitor.measure('process_vector', () => {
      try {
        // Debug logging for validation
        logger.debug('Vector validation:', {
          actualLength: String(vector.length),
          isArray: String(Array.isArray(vector)),
          sampleValues: JSON.stringify(vector.slice(0, 5)),
          lastValues: JSON.stringify(vector.slice(-5)),
        });

        // Validate vector dimension
        if (!SUPPORTED_DIMENSIONS.includes(vector.length)) {
          throw new Error(`Unsupported vector dimension: ${vector.length}. Supported dimensions are: ${SUPPORTED_DIMENSIONS.join(', ')}`);
        }

        let processedVector = [...vector];
        
        if (preprocessing === 'normalize') {
          const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
          processedVector = vector.map(val => val / magnitude);
        } else if (preprocessing === 'standardize') {
          const mean = vector.reduce((sum, val) => sum + val, 0) / vector.length;
          const stdDev = Math.sqrt(
            vector.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / vector.length
          );
          processedVector = vector.map(val => (val - mean) / stdDev);
        }

        setCurrentVector(processedVector);
        return processedVector;
      } catch (error) {
        logger.error('Vector processing failed', {
          error: error instanceof Error ? error.message : String(error),
          preprocessing,
        });
        throw error;
      }
    });
  }, [preprocessing]);

  const validateJsonVector = (parsed: unknown): number[] => {
    // If it's a direct array
    if (Array.isArray(parsed)) {
      if (parsed.every(n => typeof n === 'number')) {
        return parsed;
      }
      logger.error('JSON validation failed: Array contains non-number values', {
        sample: JSON.stringify(parsed.slice(0, 5)),
      });
      throw new Error('Vector must contain only numbers');
    }

    // If it's an object with a vector property
    if (parsed && typeof parsed === 'object' && 'vector' in parsed) {
      const vector = (parsed as { vector: unknown }).vector;
      if (Array.isArray(vector) && vector.every(n => typeof n === 'number')) {
        return vector;
      }
      logger.error('JSON validation failed: Invalid vector property', {
        vectorType: typeof vector,
        isArray: String(Array.isArray(vector)),
        sample: Array.isArray(vector) ? JSON.stringify(vector.slice(0, 5)) : 'not an array',
      });
      throw new Error('Invalid vector format in JSON');
    }

    logger.error('JSON validation failed: Unexpected format', {
      type: typeof parsed,
      keys: parsed && typeof parsed === 'object' ? JSON.stringify(Object.keys(parsed)) : '[]',
    });
    throw new Error('JSON must contain either an array or an object with a vector property');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setError(null);
      const text = await file.text();
      let vector: number[];

      logger.info('Processing uploaded file', {
        fileName: file.name,
        fileSize: String(file.size),
        fileType: file.type,
      });

      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(text);
        logger.debug('JSON parsing successful', {
          type: typeof parsed,
          isArray: String(Array.isArray(parsed)),
          sample: JSON.stringify(parsed).slice(0, 100),
        });

        vector = validateJsonVector(parsed);
      } catch (jsonError) {
        logger.debug('JSON parsing failed, attempting CSV/text parsing', {
          error: jsonError instanceof Error ? jsonError.message : 'Unknown error',
        });

        // If not JSON, try parsing as CSV/text
        vector = text
          .trim()
          .split(/[,\n\t\s]+/)
          .map((n, index) => {
            const parsed = parseFloat(n.trim());
            if (isNaN(parsed)) {
              logger.error('Invalid number in CSV/text', {
                index: String(index),
                value: n.trim(),
              });
              throw new Error(`Invalid number at position ${index + 1}: "${n.trim()}"`);
            }
            return parsed;
          });
      }

      if (vector.length === 0) {
        throw new Error('No valid numbers found in file');
      }

      logger.info('File processing successful', {
        vectorLength: String(vector.length),
        sample: JSON.stringify(vector.slice(0, 5)),
      });

      const processedVector = processVector(vector);
      onSearch(processedVector);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error processing file';
      logger.error('File processing failed', {
        error: message,
        fileName: file.name,
      });
      setError(message);
    }
  }, [onSearch, processVector]);

  const generateRandomVector = useCallback(() => {
    return performanceMonitor.measure('generate_random_vector', () => {
      const vector = Array.from({ length: selectedDimension }, 
        () => Math.random() * 2 - 1
      );
      setCurrentVector(vector);
      return vector;
    });
  }, [selectedDimension]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.txt', '.csv', '.json'],
      'application/json': ['.json'],
    },
    multiple: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      let vector: number[];
      if (inputMethod === 'manual') {
        // Enhanced parsing for manual input
        const rawValues = manualInput
          .trim()
          .split(',')
          .map(s => s.trim())
          .filter(s => s !== ''); // Remove empty entries

        logger.debug('Manual input parsing:', {
          rawInputLength: String(manualInput.length),
          splitLength: String(rawValues.length),
          firstFew: JSON.stringify(rawValues.slice(0, 5)),
          lastFew: JSON.stringify(rawValues.slice(-5)),
        });

        vector = rawValues.map((num, index) => {
          const parsed = parseFloat(num);
          if (isNaN(parsed)) {
            throw new Error(`Invalid number at position ${index + 1}: "${num}"`);
          }
          return parsed;
        });

        logger.debug('Parsed vector:', {
          length: String(vector.length),
          firstFew: JSON.stringify(vector.slice(0, 5)),
          lastFew: JSON.stringify(vector.slice(-5)),
        });
      } else {
        vector = generateRandomVector();
      }
      
      const processedVector = processVector(vector);
      onSearch(processedVector);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid input';
      setError(message);
    }
  };

  const handleTemplateSelect = useCallback((template: VectorTemplate) => {
    try {
      const processedVector = processVector(template.vector);
      onSearch(processedVector);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid template vector';
      setError(message);
    }
  }, [onSearch, processVector]);

  const handleDownloadVector = useCallback(() => {
    const vector = currentVector || generateRandomVector();
    const blob = new Blob([JSON.stringify({ vector }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vector.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentVector, generateRandomVector]);

  return (
    <div className="space-y-6">
      <div className="bg-[#1A1F2A] rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium text-white mb-2">
          Vector Search Hub
        </h3>
        <p className="text-gray-400">
          Search similar vectors using multiple input methods. Upload files, use templates, or generate random vectors to explore the vector space.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {(['template', 'file', 'random', 'manual'] as const).map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => {
              setInputMethod(method);
              setError(null);
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              inputMethod === method
                ? 'bg-blue-600 text-white'
                : 'bg-[#1A1F2A] text-gray-400 hover:bg-[#252B38]'
            }`}
          >
            {method.charAt(0).toUpperCase() + method.slice(1)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vector Dimension Selector */}
        {(inputMethod === 'random' || inputMethod === 'manual') && (
          <div className="flex gap-4 mb-4">
            <label className="text-sm text-gray-400">
              Vector Dimension:
            </label>
            <select
              value={selectedDimension}
              onChange={(e) => setSelectedDimension(Number(e.target.value))}
              className="px-3 py-1 rounded bg-[#1A1F2A] border border-gray-700 text-gray-300"
            >
              {SUPPORTED_DIMENSIONS.map(dim => (
                <option key={dim} value={dim}>{dim}</option>
              ))}
            </select>
          </div>
        )}

        {/* Preprocessing Options */}
        <div className="flex gap-4 mb-4">
          <label className="text-sm text-gray-400">
            Preprocessing:
          </label>
          <select
            value={preprocessing}
            onChange={(e) => setPreprocessing(e.target.value as typeof preprocessing)}
            className="px-3 py-1 rounded bg-[#1A1F2A] border border-gray-700 text-gray-300"
          >
            <option value="none">None</option>
            <option value="normalize">L2 Normalize</option>
            <option value="standardize">Standardize</option>
          </select>
        </div>

        {inputMethod === 'manual' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Enter {selectedDimension} vector values (comma-separated)
            </label>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#1A1F2A] border border-gray-700 text-gray-300"
              rows={3}
              placeholder={`e.g., ${Array(5).fill('0').join(', ')}, ...`}
            />
            <p className="text-sm text-gray-500 mt-1">
              Current count: {manualInput.split(',').filter(x => x.trim()).length} / {selectedDimension}
            </p>
          </div>
        )}

        {inputMethod === 'random' && (
          <div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleDownloadVector}
                className="px-4 py-2 rounded bg-[#1A1F2A] text-gray-300 hover:bg-[#252B38] border border-gray-700"
              >
                Download Vector
              </button>
            </div>
          </div>
        )}

        {inputMethod === 'file' && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-gray-700 hover:border-gray-600 bg-[#1A1F2A]'}`}
          >
            <input {...getInputProps()} />
            {isLoading ? (
              <InlineLoading />
            ) : (
              <>
                <p className="text-gray-300">
                  {isDragActive
                    ? 'Drop the file here...'
                    : 'Drag & drop a vector file here, or click to select'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Accepts JSON files with vector array or CSV/TXT with comma-separated values
                </p>
                <p className="text-sm text-gray-500">
                  Supported dimensions: {SUPPORTED_DIMENSIONS.join(', ')}
                </p>
              </>
            )}
          </div>
        )}

        {inputMethod === 'template' && (
          <div className="grid gap-4">
            {Object.entries(vectorTemplates).map(([key, template]) => (
              <button
                key={key}
                type="button"
                disabled={isLoading}
                onClick={() => handleTemplateSelect({
                  title: template.title,
                  description: template.description,
                  dimension: template.dimension,
                  vector: Array.from({ length: template.dimension }, () => Math.random() * 2 - 1)
                })}
                className="bg-[#1A1F2A] p-4 rounded-lg border border-gray-800 hover:border-blue-500 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <h4 className="text-white font-medium mb-1">{template.title}</h4>
                <p className="text-gray-400 text-sm mb-2">{template.description}</p>
                <span className="text-gray-500 text-sm">
                  Dimension: {template.dimension}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            {error}
          </div>
        )}

        {(inputMethod === 'manual' || inputMethod === 'random') && (
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center transition-colors`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <LoadingSpinner size="small" className="mr-2" />
                <span>Searching...</span>
              </div>
            ) : (
              'Search Similar Vectors'
            )}
          </button>
        )}
      </form>
    </div>
  );
}

// Custom error fallback UI for vector input
const VectorInputErrorFallback = (
  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
    <h3 className="text-xl font-semibold text-red-500 mb-3">
      Input Error
    </h3>
    <p className="text-gray-400 mb-4">
      An error occurred while processing vector input.
    </p>
    <button
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
    >
      Retry
    </button>
  </div>
);

// Set performance thresholds
performanceMonitor.setThreshold('process_vector', 100); // 100ms for vector processing
performanceMonitor.setThreshold('generate_random_vector', 50); // 50ms for random vector generation

export default withErrorBoundary(VectorInput, VectorInputErrorFallback);
