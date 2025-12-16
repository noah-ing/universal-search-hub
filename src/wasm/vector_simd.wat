;; WebAssembly Text Format (WAT) for vector operations with SIMD
;; Optimized for high-performance vector similarity computations
(module
  ;; Import memory from JavaScript (shared memory for vector data)
  (import "env" "memory" (memory 1))

  ;; Euclidean distance between two vectors using SIMD
  ;; Parameters: offsetA (i32), offsetB (i32), length (i32)
  ;; Returns: f32 (distance)
  (func $euclideanDistance (export "euclideanDistance")
    (param $offsetA i32) (param $offsetB i32) (param $len i32) (result f32)
    (local $i i32)
    (local $sum v128)
    (local $va v128)
    (local $vb v128)
    (local $diff v128)
    (local $result f32)
    (local $simd_len i32)
    (local $remainder i32)

    ;; Initialize sum to zero vector
    (local.set $sum (v128.const f32x4 0.0 0.0 0.0 0.0))

    ;; Calculate how many full SIMD iterations (4 floats at a time)
    (local.set $simd_len (i32.and (local.get $len) (i32.const -4)))

    ;; Main SIMD loop - process 4 floats at a time
    (local.set $i (i32.const 0))
    (block $break
      (loop $loop
        ;; Check if we've processed all SIMD-aligned elements
        (br_if $break (i32.ge_u (local.get $i) (local.get $simd_len)))

        ;; Load 4 floats from vector A
        (local.set $va
          (v128.load
            (i32.add (local.get $offsetA) (i32.shl (local.get $i) (i32.const 2)))))

        ;; Load 4 floats from vector B
        (local.set $vb
          (v128.load
            (i32.add (local.get $offsetB) (i32.shl (local.get $i) (i32.const 2)))))

        ;; Calculate difference: diff = a - b
        (local.set $diff (f32x4.sub (local.get $va) (local.get $vb)))

        ;; Square and accumulate: sum += diff * diff
        (local.set $sum
          (f32x4.add (local.get $sum) (f32x4.mul (local.get $diff) (local.get $diff))))

        ;; Increment by 4 (process next 4 floats)
        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br $loop)
      )
    )

    ;; Horizontal sum: add all 4 lanes together
    (local.set $result
      (f32.add
        (f32.add
          (f32x4.extract_lane 0 (local.get $sum))
          (f32x4.extract_lane 1 (local.get $sum)))
        (f32.add
          (f32x4.extract_lane 2 (local.get $sum))
          (f32x4.extract_lane 3 (local.get $sum)))))

    ;; Handle remainder elements (if length not divisible by 4)
    (local.set $remainder (i32.and (local.get $len) (i32.const 3)))
    (if (i32.gt_u (local.get $remainder) (i32.const 0))
      (then
        (local.set $i (local.get $simd_len))
        (block $rem_break
          (loop $rem_loop
            (br_if $rem_break (i32.ge_u (local.get $i) (local.get $len)))
            (local.set $result
              (f32.add (local.get $result)
                (f32.mul
                  (f32.sub
                    (f32.load (i32.add (local.get $offsetA) (i32.shl (local.get $i) (i32.const 2))))
                    (f32.load (i32.add (local.get $offsetB) (i32.shl (local.get $i) (i32.const 2)))))
                  (f32.sub
                    (f32.load (i32.add (local.get $offsetA) (i32.shl (local.get $i) (i32.const 2))))
                    (f32.load (i32.add (local.get $offsetB) (i32.shl (local.get $i) (i32.const 2))))))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $rem_loop)
          )
        )
      )
    )

    ;; Return square root of sum
    (f32.sqrt (local.get $result))
  )

  ;; Cosine similarity between two vectors using SIMD
  ;; Parameters: offsetA (i32), offsetB (i32), length (i32)
  ;; Returns: f32 (similarity in range [-1, 1])
  (func $cosineSimilarity (export "cosineSimilarity")
    (param $offsetA i32) (param $offsetB i32) (param $len i32) (result f32)
    (local $i i32)
    (local $dot v128)
    (local $normA v128)
    (local $normB v128)
    (local $va v128)
    (local $vb v128)
    (local $dotSum f32)
    (local $normASum f32)
    (local $normBSum f32)
    (local $result f32)
    (local $simd_len i32)

    ;; Initialize accumulators to zero
    (local.set $dot (v128.const f32x4 0.0 0.0 0.0 0.0))
    (local.set $normA (v128.const f32x4 0.0 0.0 0.0 0.0))
    (local.set $normB (v128.const f32x4 0.0 0.0 0.0 0.0))

    ;; Calculate SIMD-aligned length
    (local.set $simd_len (i32.and (local.get $len) (i32.const -4)))

    ;; Main SIMD loop
    (local.set $i (i32.const 0))
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (local.get $simd_len)))

        ;; Load vectors
        (local.set $va
          (v128.load
            (i32.add (local.get $offsetA) (i32.shl (local.get $i) (i32.const 2)))))
        (local.set $vb
          (v128.load
            (i32.add (local.get $offsetB) (i32.shl (local.get $i) (i32.const 2)))))

        ;; Accumulate dot product: dot += a * b
        (local.set $dot
          (f32x4.add (local.get $dot) (f32x4.mul (local.get $va) (local.get $vb))))

        ;; Accumulate norm A: normA += a * a
        (local.set $normA
          (f32x4.add (local.get $normA) (f32x4.mul (local.get $va) (local.get $va))))

        ;; Accumulate norm B: normB += b * b
        (local.set $normB
          (f32x4.add (local.get $normB) (f32x4.mul (local.get $vb) (local.get $vb))))

        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br $loop)
      )
    )

    ;; Horizontal sums
    (local.set $dotSum
      (f32.add
        (f32.add
          (f32x4.extract_lane 0 (local.get $dot))
          (f32x4.extract_lane 1 (local.get $dot)))
        (f32.add
          (f32x4.extract_lane 2 (local.get $dot))
          (f32x4.extract_lane 3 (local.get $dot)))))

    (local.set $normASum
      (f32.add
        (f32.add
          (f32x4.extract_lane 0 (local.get $normA))
          (f32x4.extract_lane 1 (local.get $normA)))
        (f32.add
          (f32x4.extract_lane 2 (local.get $normA))
          (f32x4.extract_lane 3 (local.get $normA)))))

    (local.set $normBSum
      (f32.add
        (f32.add
          (f32x4.extract_lane 0 (local.get $normB))
          (f32x4.extract_lane 1 (local.get $normB)))
        (f32.add
          (f32x4.extract_lane 2 (local.get $normB))
          (f32x4.extract_lane 3 (local.get $normB)))))

    ;; Handle remainder
    (local.set $i (local.get $simd_len))
    (block $rem_break
      (loop $rem_loop
        (br_if $rem_break (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $dotSum
          (f32.add (local.get $dotSum)
            (f32.mul
              (f32.load (i32.add (local.get $offsetA) (i32.shl (local.get $i) (i32.const 2))))
              (f32.load (i32.add (local.get $offsetB) (i32.shl (local.get $i) (i32.const 2)))))))
        (local.set $normASum
          (f32.add (local.get $normASum)
            (f32.mul
              (f32.load (i32.add (local.get $offsetA) (i32.shl (local.get $i) (i32.const 2))))
              (f32.load (i32.add (local.get $offsetA) (i32.shl (local.get $i) (i32.const 2)))))))
        (local.set $normBSum
          (f32.add (local.get $normBSum)
            (f32.mul
              (f32.load (i32.add (local.get $offsetB) (i32.shl (local.get $i) (i32.const 2))))
              (f32.load (i32.add (local.get $offsetB) (i32.shl (local.get $i) (i32.const 2)))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $rem_loop)
      )
    )

    ;; Calculate similarity: dot / (sqrt(normA) * sqrt(normB))
    (local.set $result
      (f32.div
        (local.get $dotSum)
        (f32.mul
          (f32.sqrt (local.get $normASum))
          (f32.sqrt (local.get $normBSum)))))

    ;; Clamp result to [-1, 1]
    (f32.min
      (f32.const 1.0)
      (f32.max
        (f32.const -1.0)
        (local.get $result)))
  )

  ;; Normalize vector in-place using SIMD
  ;; Parameters: offset (i32), length (i32)
  ;; Returns: void (modifies vector in-place)
  (func $normalize (export "normalize")
    (param $offset i32) (param $len i32)
    (local $i i32)
    (local $sum v128)
    (local $va v128)
    (local $normSum f32)
    (local $invNorm f32)
    (local $invNormVec v128)
    (local $simd_len i32)

    ;; Initialize sum to zero
    (local.set $sum (v128.const f32x4 0.0 0.0 0.0 0.0))
    (local.set $simd_len (i32.and (local.get $len) (i32.const -4)))

    ;; First pass: calculate magnitude squared
    (local.set $i (i32.const 0))
    (block $break1
      (loop $loop1
        (br_if $break1 (i32.ge_u (local.get $i) (local.get $simd_len)))

        (local.set $va
          (v128.load
            (i32.add (local.get $offset) (i32.shl (local.get $i) (i32.const 2)))))

        (local.set $sum
          (f32x4.add (local.get $sum) (f32x4.mul (local.get $va) (local.get $va))))

        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br $loop1)
      )
    )

    ;; Horizontal sum
    (local.set $normSum
      (f32.add
        (f32.add
          (f32x4.extract_lane 0 (local.get $sum))
          (f32x4.extract_lane 1 (local.get $sum)))
        (f32.add
          (f32x4.extract_lane 2 (local.get $sum))
          (f32x4.extract_lane 3 (local.get $sum)))))

    ;; Handle remainder for magnitude calculation
    (local.set $i (local.get $simd_len))
    (block $rem_break1
      (loop $rem_loop1
        (br_if $rem_break1 (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $normSum
          (f32.add (local.get $normSum)
            (f32.mul
              (f32.load (i32.add (local.get $offset) (i32.shl (local.get $i) (i32.const 2))))
              (f32.load (i32.add (local.get $offset) (i32.shl (local.get $i) (i32.const 2)))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $rem_loop1)
      )
    )

    ;; Calculate inverse of magnitude
    (local.set $invNorm (f32.div (f32.const 1.0) (f32.sqrt (local.get $normSum))))

    ;; Create SIMD vector of inverse norm for multiplication
    (local.set $invNormVec (f32x4.splat (local.get $invNorm)))

    ;; Second pass: normalize by multiplying by inverse magnitude
    (local.set $i (i32.const 0))
    (block $break2
      (loop $loop2
        (br_if $break2 (i32.ge_u (local.get $i) (local.get $simd_len)))

        (local.set $va
          (v128.load
            (i32.add (local.get $offset) (i32.shl (local.get $i) (i32.const 2)))))

        (v128.store
          (i32.add (local.get $offset) (i32.shl (local.get $i) (i32.const 2)))
          (f32x4.mul (local.get $va) (local.get $invNormVec)))

        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br $loop2)
      )
    )

    ;; Handle remainder for normalization
    (local.set $i (local.get $simd_len))
    (block $rem_break2
      (loop $rem_loop2
        (br_if $rem_break2 (i32.ge_u (local.get $i) (local.get $len)))
        (f32.store
          (i32.add (local.get $offset) (i32.shl (local.get $i) (i32.const 2)))
          (f32.mul
            (f32.load (i32.add (local.get $offset) (i32.shl (local.get $i) (i32.const 2))))
            (local.get $invNorm)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $rem_loop2)
      )
    )
  )
)
