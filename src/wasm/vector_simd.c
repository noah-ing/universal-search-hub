
            #include <emscripten.h>
            #include <wasm_simd128.h>
            
            EMSCRIPTEN_KEEPALIVE
            float euclideanDistance(float* a, float* b, int len) {
                v128_t sum = wasm_f32x4_splat(0.0f);
                for (int i = 0; i < len; i += 4) {
                    v128_t va = wasm_v128_load(&a[i]);
                    v128_t vb = wasm_v128_load(&b[i]);
                    v128_t diff = wasm_f32x4_sub(va, vb);
                    sum = wasm_f32x4_add(sum, wasm_f32x4_mul(diff, diff));
                }
                float final_sum = 
                    wasm_f32x4_extract_lane(sum, 0) +
                    wasm_f32x4_extract_lane(sum, 1) +
                    wasm_f32x4_extract_lane(sum, 2) +
                    wasm_f32x4_extract_lane(sum, 3);
                return __builtin_sqrtf(final_sum);
            }

            EMSCRIPTEN_KEEPALIVE
            float cosineSimilarity(float* a, float* b, int len) {
                v128_t dot = wasm_f32x4_splat(0.0f);
                v128_t normA = wasm_f32x4_splat(0.0f);
                v128_t normB = wasm_f32x4_splat(0.0f);
                for (int i = 0; i < len; i += 4) {
                    v128_t va = wasm_v128_load(&a[i]);
                    v128_t vb = wasm_v128_load(&b[i]);
                    dot = wasm_f32x4_add(dot, wasm_f32x4_mul(va, vb));
                    normA = wasm_f32x4_add(normA, wasm_f32x4_mul(va, va));
                    normB = wasm_f32x4_add(normB, wasm_f32x4_mul(vb, vb));
                }
                float dotProduct = 
                    wasm_f32x4_extract_lane(dot, 0) +
                    wasm_f32x4_extract_lane(dot, 1) +
                    wasm_f32x4_extract_lane(dot, 2) +
                    wasm_f32x4_extract_lane(dot, 3);
                float normASum = 
                    wasm_f32x4_extract_lane(normA, 0) +
                    wasm_f32x4_extract_lane(normA, 1) +
                    wasm_f32x4_extract_lane(normA, 2) +
                    wasm_f32x4_extract_lane(normA, 3);
                float normBSum = 
                    wasm_f32x4_extract_lane(normB, 0) +
                    wasm_f32x4_extract_lane(normB, 1) +
                    wasm_f32x4_extract_lane(normB, 2) +
                    wasm_f32x4_extract_lane(normB, 3);
                return dotProduct / (__builtin_sqrtf(normASum) * __builtin_sqrtf(normBSum));
            }

            EMSCRIPTEN_KEEPALIVE
            void normalize(float* v, int len) {
                v128_t sum = wasm_f32x4_splat(0.0f);
                for (int i = 0; i < len; i += 4) {
                    v128_t vec = wasm_v128_load(&v[i]);
                    sum = wasm_f32x4_add(sum, wasm_f32x4_mul(vec, vec));
                }
                float normSum = 
                    wasm_f32x4_extract_lane(sum, 0) +
                    wasm_f32x4_extract_lane(sum, 1) +
                    wasm_f32x4_extract_lane(sum, 2) +
                    wasm_f32x4_extract_lane(sum, 3);
                float norm = __builtin_sqrtf(normSum);
                v128_t normVec = wasm_f32x4_splat(1.0f / norm);
                for (int i = 0; i < len; i += 4) {
                    v128_t vec = wasm_v128_load(&v[i]);
                    wasm_v128_store(&v[i], wasm_f32x4_mul(vec, normVec));
                }
            }
        