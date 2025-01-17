
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <cmath>
#include <vector>

using namespace emscripten;

// SIMD-optimized vector operations
extern "C" {
    // Calculate Euclidean distance using SIMD
    float euclideanDistance(float* a, float* b, int len) {
        float sum = 0.0f;
        #pragma omp simd reduction(+:sum)
        for (int i = 0; i < len; i++) {
            float diff = a[i] - b[i];
            sum += diff * diff;
        }
        return std::sqrt(sum);
    }

    // Calculate cosine similarity using SIMD
    float cosineSimilarity(float* a, float* b, int len) {
        float dot = 0.0f, normA = 0.0f, normB = 0.0f;
        #pragma omp simd reduction(+:dot,normA,normB)
        for (int i = 0; i < len; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (std::sqrt(normA) * std::sqrt(normB));
    }

    // Normalize vector using SIMD
    void normalize(float* v, int len) {
        float sum = 0.0f;
        #pragma omp simd reduction(+:sum)
        for (int i = 0; i < len; i++) {
            sum += v[i] * v[i];
        }
        float norm = std::sqrt(sum);
        if (norm > 0.0f) {
            #pragma omp simd
            for (int i = 0; i < len; i++) {
                v[i] /= norm;
            }
        }
    }
}

// JavaScript bindings
EMSCRIPTEN_BINDINGS(vector_ops) {
    function("euclideanDistance", &euclideanDistance);
    function("cosineSimilarity", &cosineSimilarity);
    function("normalize", &normalize);
}
