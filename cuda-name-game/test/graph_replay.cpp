// Verification-only interposer for these harnesses' three-pointer + int ABI.
// Runs each launch as three captured graph nodes, then clobbers the host
// argument storage before replay. The original harness checks the actual graph
// output with its independent CPU oracle. Never use this library for timing.
#include <cuda.h>
#include <dlfcn.h>
#include <atomic>
#include <cstdio>

using Launch = CUresult (CUDAAPI *)(CUfunction,unsigned,unsigned,unsigned,
    unsigned,unsigned,unsigned,unsigned,CUstream,void**,void**);
static std::atomic<unsigned long long> replayed{0};
static thread_local bool nested = false;

extern "C" CUresult CUDAAPI cuLaunchKernel(CUfunction function,
    unsigned gx,unsigned gy,unsigned gz,unsigned bx,unsigned by,unsigned bz,
    unsigned shared,CUstream stream,void** parameters,void** extra) {
  static Launch real = reinterpret_cast<Launch>(dlsym(RTLD_NEXT,"cuLaunchKernel"));
  if (!real) return CUDA_ERROR_NOT_INITIALIZED;
  if (nested) return real(function,gx,gy,gz,bx,by,bz,shared,stream,parameters,extra);
  if (!stream || !parameters || extra) return CUDA_ERROR_INVALID_VALUE;
  nested = true;
  struct Reset { ~Reset() { nested = false; } } reset;
  volatile CUdeviceptr copies[3];
  for (int i=0;i<3;++i) copies[i] = *static_cast<CUdeviceptr*>(parameters[i]);
  volatile int size = *static_cast<int*>(parameters[3]);
  void* args[] = {const_cast<CUdeviceptr*>(&copies[0]),const_cast<CUdeviceptr*>(&copies[1]),
                 const_cast<CUdeviceptr*>(&copies[2]),const_cast<int*>(&size)};
  CUgraph graph{}; CUgraphExec executable{};
  CUresult result = cuStreamBeginCapture(stream,CU_STREAM_CAPTURE_MODE_THREAD_LOCAL);
  if (result != CUDA_SUCCESS) return result;
  for (int i=0;i<3 && result==CUDA_SUCCESS;++i)
    result = real(function,gx,gy,gz,bx,by,bz,shared,stream,args,nullptr);
  const CUresult ended = cuStreamEndCapture(stream,&graph);
  if (result==CUDA_SUCCESS) result = ended;
  // Replaying must use the values captured above, not these now-zero host slots.
  for (int i=0;i<3;++i) copies[i] = 0;
  size = 0;
  if (result==CUDA_SUCCESS) result = cuGraphInstantiateWithFlags(&executable,graph,0);
  if (result==CUDA_SUCCESS) result = cuGraphLaunch(executable,stream);
  if (result==CUDA_SUCCESS) result = cuStreamSynchronize(stream);
  if (executable) cuGraphExecDestroy(executable);
  if (graph) cuGraphDestroy(graph);
  if (result==CUDA_SUCCESS) replayed.fetch_add(1,std::memory_order_relaxed);
  return result;
}
__attribute__((destructor)) static void report() {
  std::fprintf(stderr,"Graph replay verification: %llu launches wrapped as three-node graphs\n",
               replayed.load(std::memory_order_relaxed));
}
