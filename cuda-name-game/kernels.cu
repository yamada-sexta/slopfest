// The prefix is the only build-time difference between the two modules.
#include <cuda_runtime.h>
#ifndef PREFIX
#define PREFIX neutral
#endif
#define JOIN_IMPL(a, b) a##_##b
#define JOIN(a, b) JOIN_IMPL(a, b)
#define NAME(kernel) JOIN(PREFIX, kernel)

extern "C" __global__ void NAME(saxpy)(const float* x, const float* y, float* out, int n) {
  const int i = blockIdx.x * blockDim.x + threadIdx.x;
  if (i < n) out[i] = fmaf(1.25f, x[i], y[i]);
}

extern "C" __global__ void NAME(tiled_gemm)(const float* a, const float* b, float* c, int n) {
  __shared__ float as[16][16], bs[16][16];
  const int x = threadIdx.x, y = threadIdx.y;
  const int row = blockIdx.y * 16 + y, col = blockIdx.x * 16 + x;
  float value = 0;
  for (int base = 0; base < n; base += 16) {
    as[y][x] = row < n && base + x < n ? a[row * n + base + x] : 0;
    bs[y][x] = base + y < n && col < n ? b[(base + y) * n + col] : 0;
    __syncthreads();
    #pragma unroll
    for (int k = 0; k < 16; k++) value = fmaf(as[y][k], bs[k][x], value);
    __syncthreads();
  }
  if (row < n && col < n) c[row * n + col] = value;
}

// A 128 x 128 output tile, 8 x 8 register tile per thread, and K tiles of 8.
extern "C" __global__ __launch_bounds__(256) void NAME(register_gemm)(const float* a, const float* b, float* c, int n) {
  __shared__ float as[128][8], bs[8][128];
  const int x = threadIdx.x, y = threadIdx.y, tid = y * 16 + x;
  const int row0 = blockIdx.y * 128, col0 = blockIdx.x * 128;
  float sums[8][8] = {};
  for (int base = 0; base < n; base += 8) {
    #pragma unroll
    for (int load = 0; load < 4; load++) {
      const int index = tid + load * 256;
      const int ar = index / 8, ak = index % 8, bk = index / 128, bc = index % 128;
      as[ar][ak] = row0 + ar < n && base + ak < n ? a[(row0 + ar) * n + base + ak] : 0;
      bs[bk][bc] = base + bk < n && col0 + bc < n ? b[(base + bk) * n + col0 + bc] : 0;
    }
    __syncthreads();
    #pragma unroll
    for (int k = 0; k < 8; k++) {
      float av[8], bv[8];
      #pragma unroll
      for (int i = 0; i < 8; i++) av[i] = as[y * 8 + i][k];
      #pragma unroll
      for (int j = 0; j < 8; j++) bv[j] = bs[k][x * 8 + j];
      #pragma unroll
      for (int i = 0; i < 8; i++) {
        #pragma unroll
        for (int j = 0; j < 8; j++) sums[i][j] = fmaf(av[i], bv[j], sums[i][j]);
      }
    }
    __syncthreads();
  }
  #pragma unroll
  for (int i = 0; i < 8; i++) {
    #pragma unroll
    for (int j = 0; j < 8; j++) {
      const int row = row0 + y * 8 + i, col = col0 + x * 8 + j;
      if (row < n && col < n) c[row * n + col] = sums[i][j];
    }
  }
}
