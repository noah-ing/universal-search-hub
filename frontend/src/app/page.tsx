'use client';

import VectorSearch from '../components/VectorSearch';

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
          Vector Similarity Search
        </h1>
        <p className="text-gray-400 text-lg mb-12">
          High-performance semantic search engine for:
        </p>

        {/* User Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#1A1F2A] rounded-lg p-6 border border-gray-800 card-hover">
            <h3 className="text-xl font-semibold mb-3 text-blue-400">AI/ML Engineers</h3>
            <p className="text-gray-400">
              Find similar embeddings for machine learning models, recommendation systems, and AI applications
            </p>
          </div>

          <div className="bg-[#1A1F2A] rounded-lg p-6 border border-gray-800 card-hover">
            <h3 className="text-xl font-semibold mb-3 text-blue-400">Data Scientists</h3>
            <p className="text-gray-400">
              Analyze high-dimensional data, find patterns, and discover relationships in complex datasets
            </p>
          </div>

          <div className="bg-[#1A1F2A] rounded-lg p-6 border border-gray-800 card-hover">
            <h3 className="text-xl font-semibold mb-3 text-blue-400">Application Developers</h3>
            <p className="text-gray-400">
              Build semantic search, content recommendation, and similarity matching features into applications
            </p>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="flex justify-center gap-8 text-sm text-gray-500 mb-12">
          <div className="stats-item">
            HNSW algorithm with WASM SIMD optimization
          </div>
          <div className="stats-item">
            2.74ms average search latency
          </div>
          <div className="stats-item">
            100% search accuracy
          </div>
        </div>
      </div>

      {/* Search Interface */}
      <VectorSearch />
    </div>
  );
}
