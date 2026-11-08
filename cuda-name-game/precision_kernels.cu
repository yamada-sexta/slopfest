// Identical WMMA computations across kernel names; no CUTLASS dependency.
#include <cuda_fp16.h>
#include <cuda_bf16.h>
#include <mma.h>
#ifndef PREFIX
#define PREFIX neutral
#endif
#define JOIN_IMPL(a,b) a##_##b
#define JOIN(a,b) JOIN_IMPL(a,b)
#define NAME(k) JOIN(PREFIX,k)
namespace w = nvcuda::wmma;

// Four warps compute a 32x32 block. Stage each warp's fragments in aligned
// shared storage, so every WMMA load meets pointer and stride requirements.
template<class T, class Acc>
__device__ __forceinline__ void gemm16(const T* a, const T* b, Acc* c, int n) {
  __shared__ __align__(32) T as[4][256], bs[4][256];
  const int warp = threadIdx.x / 32, lane = threadIdx.x % 32;
  const int row = blockIdx.y * 32 + (warp / 2) * 16;
  const int col = blockIdx.x * 32 + (warp % 2) * 16;
  w::fragment<w::matrix_a,16,16,16,T,w::row_major> af;
  w::fragment<w::matrix_b,16,16,16,T,w::col_major> bf;
  w::fragment<w::accumulator,16,16,16,Acc> cf;
  w::fill_fragment(cf, Acc(0));
  for (int k = 0; k < n; k += 16) {
    for (int i = lane; i < 256; i += 32) {
      as[warp][i] = a[(row+i/16)*n+k+i%16];
      bs[warp][i] = b[(col+i/16)*n+k+i%16];
    }
    __syncwarp();
    w::load_matrix_sync(af, as[warp], 16);
    w::load_matrix_sync(bf, bs[warp], 16);
    w::mma_sync(cf, af, bf, cf);
    __syncwarp();
  }
  w::store_matrix_sync(c+row*n+col, cf, n, w::mem_row_major);
}
extern "C" __global__ void NAME(wmma_fp16)(const __half* a, const __half* b, float* c, int n) { gemm16(a,b,c,n); }
#if __CUDA_ARCH__ >= 800
extern "C" __global__ void NAME(wmma_bf16)(const __nv_bfloat16* a, const __nv_bfloat16* b, float* c, int n) { gemm16(a,b,c,n); }
#endif
extern "C" __global__ void NAME(wmma_int8)(const signed char* a, const signed char* b, int* c, int n) { gemm16(a,b,c,n); }

// Signed packed INT4: low nibble first; four warps compute a 16x16 block.
extern "C" __global__ void NAME(wmma_int4)(const unsigned char* a, const unsigned char* b, int* c, int n) {
  __shared__ __align__(32) unsigned char as[4][128], bs[4][128];
  const int warp = threadIdx.x / 32, lane = threadIdx.x % 32;
  const int row = blockIdx.y * 16 + (warp / 2) * 8;
  const int col = blockIdx.x * 16 + (warp % 2) * 8;
  using S4 = w::experimental::precision::s4;
  w::fragment<w::matrix_a,8,8,32,S4,w::row_major> af;
  w::fragment<w::matrix_b,8,8,32,S4,w::col_major> bf;
  w::fragment<w::accumulator,8,8,32,int> cf;
  w::fill_fragment(cf, 0);
  for (int k = 0; k < n; k += 32) {
    for (int i = lane; i < 128; i += 32) {
      as[warp][i] = a[(row+i/16)*(n/2)+k/2+i%16];
      bs[warp][i] = b[(col+i/16)*(n/2)+k/2+i%16];
    }
    __syncwarp();
    w::load_matrix_sync(af, as[warp], 32);
    w::load_matrix_sync(bf, bs[warp], 32);
    w::mma_sync(cf, af, bf, cf);
    __syncwarp();
  }
  w::store_matrix_sync(c+row*n+col, cf, n, w::mem_row_major);
}
