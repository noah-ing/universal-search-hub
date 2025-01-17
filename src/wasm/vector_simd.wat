;; WebAssembly Text Format (WAT) for vector operations with SIMD
(module
  ;; Import memory from JavaScript
  (import "env" "memory" (memory 1))

  ;; SIMD globals
  (global $VECTOR_SIZE i32 (i32.const 4))  ;; Size of f32 in bytes

  ;; Helper function to get vector offset
  (func $getOffset (param $index i32) (result i32)
    (i32.mul (local.get $index) (global.get $VECTOR_SIZE))
  )

  ;; Euclidean distance between two vectors using SIMD
  (func $euclideanDistance (param $a i32) (param $b i32) (param $len i32) (result f32)
    (local $i i32)
    (local $sum f32)
    (local $diff f32)
    (local $result f32)

    ;; Initialize sum
    (local.set $sum (f32.const 0))

    ;; Main SIMD loop
    (local.set $i (i32.const 0))
    (loop $loop
      (br_if $loop
        (i32.lt_u (local.get $i) (local.get $len))
        (block
          ;; Load 4 elements from each vector using v128
          (v128.load (call $getOffset (local.get $i)))
          (v128.load (call $getOffset (local.get $i)))
          ;; Subtract vectors
          (f32x4.sub)
          ;; Square elements
          (f32x4.mul)
          ;; Add to sum
          (f32x4.add)
          ;; Increment counter
          (local.set $i (i32.add (local.get $i) (i32.const 4)))
        )
      )
    )

    ;; Calculate final square root
    (local.set $result (f32.sqrt (local.get $sum)))
    (local.get $result)
  )

  ;; Cosine similarity between two vectors using SIMD
  (func $cosineSimilarity (param $a i32) (param $b i32) (param $len i32) (result f32)
    (local $i i32)
    (local $dotProduct f32)
    (local $normA f32)
    (local $normB f32)
    (local $result f32)

    ;; Initialize accumulators
    (local.set $dotProduct (f32.const 0))
    (local.set $normA (f32.const 0))
    (local.set $normB (f32.const 0))

    ;; Main SIMD loop
    (local.set $i (i32.const 0))
    (loop $loop
      (br_if $loop
        (i32.lt_u (local.get $i) (local.get $len))
        (block
          ;; Load 4 elements from each vector
          (v128.load (call $getOffset (local.get $i)))
          (v128.load (call $getOffset (local.get $i)))
          ;; Calculate dot product
          (f32x4.mul)
          (f32x4.add)
          (local.set $dotProduct (f32.add (local.get $dotProduct)))

          ;; Calculate norms
          (v128.load (call $getOffset (local.get $i)))
          (f32x4.mul)
          (f32x4.add)
          (local.set $normA (f32.add (local.get $normA)))

          (v128.load (call $getOffset (local.get $i)))
          (f32x4.mul)
          (f32x4.add)
          (local.set $normB (f32.add (local.get $normB)))

          ;; Increment counter
          (local.set $i (i32.add (local.get $i) (i32.const 4)))
        )
      )
    )

    ;; Calculate final similarity
    (local.set $result 
      (f32.div 
        (local.get $dotProduct)
        (f32.mul 
          (f32.sqrt (local.get $normA))
          (f32.sqrt (local.get $normB))
        )
      )
    )

    ;; Clamp result to [-1, 1]
    (f32.min 
      (f32.max 
        (local.get $result)
        (f32.const -1)
      )
      (f32.const 1)
    )
  )

  ;; Normalize vector in-place using SIMD
  (func $normalize (param $v i32) (param $len i32)
    (local $i i32)
    (local $sum f32)
    (local $norm f32)

    ;; Calculate magnitude using SIMD
    (local.set $sum (f32.const 0))
    (local.set $i (i32.const 0))
    (loop $loop1
      (br_if $loop1
        (i32.lt_u (local.get $i) (local.get $len))
        (block
          ;; Load 4 elements
          (v128.load (call $getOffset (local.get $i)))
          ;; Square elements
          (f32x4.mul)
          ;; Add to sum
          (f32x4.add)
          (local.set $sum (f32.add (local.get $sum)))
          ;; Increment counter
          (local.set $i (i32.add (local.get $i) (i32.const 4)))
        )
      )
    )

    ;; Calculate norm
    (local.set $norm (f32.sqrt (local.get $sum)))

    ;; Normalize vector using SIMD
    (local.set $i (i32.const 0))
    (loop $loop2
      (br_if $loop2
        (i32.lt_u (local.get $i) (local.get $len))
        (block
          ;; Load 4 elements
          (v128.load (call $getOffset (local.get $i)))
          ;; Divide by norm
          (f32x4.div (f32.splat (local.get $norm)))
          ;; Store result
          (v128.store (call $getOffset (local.get $i)))
          ;; Increment counter
          (local.set $i (i32.add (local.get $i) (i32.const 4)))
        )
      )
    )
  )

  ;; Export functions
  (export "euclideanDistance" (func $euclideanDistance))
  (export "cosineSimilarity" (func $cosineSimilarity))
  (export "normalize" (func $normalize))
)
