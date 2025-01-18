import VectorSearch from '../components/VectorSearch';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-12 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Vector Similarity Search
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            High-performance semantic search engine for:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                AI/ML Engineers
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Find similar embeddings for machine learning models, recommendation systems, and AI applications
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Data Scientists
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Analyze high-dimensional data, find patterns, and discover relationships in complex datasets
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Application Developers
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Build semantic search, content recommendation, and similarity matching features into applications
              </p>
            </div>
          </div>
          <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            Powered by HNSW algorithm with WASM SIMD optimization • 2.74ms average search latency • 100% search accuracy
          </div>
        </div>
        <VectorSearch />
      </main>
    </div>
  );
}
