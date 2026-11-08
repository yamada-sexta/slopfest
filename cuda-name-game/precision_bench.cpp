// Reuse checked Driver API resources and timing primitives, without changing
// the frozen FP32 experiment's source or binaries.
#define main fp32_benchmark_main
#include "bench.cpp"
#undef main
#include <cstring>

static int qa(int row, int k, int bits) {
  const int range = bits == 8 ? 256 : (bits == 4 ? 16 : 15);
  return ((row % 7)*3+k*5) % range - range/2;
}
static int qb(int k, int col, int bits) {
  const int range = bits == 8 ? 256 : (bits == 4 ? 16 : 15);
  return (k*2+(col % 11)*7) % range - range/2;
}
static void pack(std::vector<unsigned char>& bytes, size_t index, int q, const std::string& kernel) {
  if (kernel == "wmma_int4") bytes[index/2] |= static_cast<unsigned char>((q & 15) << ((index%2)*4));
  else if (kernel == "wmma_int8") bytes[index] = static_cast<unsigned char>(q);
  else {
    // All inputs are exact small multiples of 1/8 in both floating formats.
    float value = float(q)/8;
    uint32_t bits; std::memcpy(&bits, &value, sizeof(bits));
    uint16_t encoded = 0;
    if (kernel == "wmma_bf16") encoded = uint16_t(bits >> 16);
    else if (value != 0) encoded = uint16_t(((bits >> 16)&0x8000) | ((((bits>>23)&255)-127+15)<<10) | ((bits>>13)&1023));
    std::memcpy(bytes.data()+index*2, &encoded, sizeof(encoded));
  }
}

static void precision_case(const std::string& kernel, int logical, bool random, const std::vector<Variant>& variants,
                           int rounds, double batch_ms, bool verify_only, std::mt19937& rng, bool graphs) {
  Timer timer;
  const int n = (logical+31)/32*32;
  const size_t count = size_t(n)*n, guard = 64;
  const int bits = kernel == "wmma_int4" ? 4 : (kernel == "wmma_int8" ? 8 : 16);
  const bool integer = bits <= 8;
  const size_t bytes = count*bits/8;
  std::vector<unsigned char> a(bytes), b(bytes);
  std::vector<int> ar(random ? count : 0), br(random ? count : 0);
  std::mt19937 inputs(773);
  const int range = bits == 8 ? 256 : (bits == 4 ? 16 : 15);
  for (int row = 0; row < n; ++row) for (int col = 0; col < n; ++col) {
    const size_t index = size_t(row)*n+col;
    const int av = row < logical && col < logical ? (random ? int(inputs()%unsigned(range))-range/2 : qa(row,col,bits)) : 0;
    const int bv = row < logical && col < logical ? (random ? int(inputs()%unsigned(range))-range/2 : qb(row,col,bits)) : 0;
    pack(a, index, av, kernel);
    pack(b, size_t(col)*n+row, bv, kernel); // B stored column-major.
    if (random) { ar[index] = av; br[index] = bv; }
  }
  int64_t table[7][11]{};
  for (int row = 0; row < 7; ++row) for (int col = 0; col < 11; ++col)
    for (int k = 0; k < logical; ++k) table[row][col] += int64_t(qa(row,k,bits))*qb(k,col,bits);
  std::vector<int64_t> oracle(random ? count : 0);
  if (random) for (int row = 0; row < logical; ++row) for (int col = 0; col < logical; ++col)
    for (int k = 0; k < logical; ++k) oracle[size_t(row)*n+col] += int64_t(ar[size_t(row)*n+k])*br[size_t(k)*n+col];
  Memory da(bytes), db(bytes), dc((count+guard)*4);
  check(cuMemcpyHtoD(da.ptr,a.data(),bytes)); check(cuMemcpyHtoD(db.ptr,b.data(),bytes)); check(cuCtxSynchronize());
  std::vector<CUfunction> functions(variants.size());
  for (size_t v = 0; v < variants.size(); ++v)
    check(cuModuleGetFunction(&functions[v],variants[v].module,(variants[v].prefix+"_"+kernel).c_str()));
  auto launch = [&](int v) {
    int dim = n; void* params[] = {&da.ptr,&db.ptr,&dc.ptr,&dim};
    const int tile = bits == 4 ? 16 : 32;
    check(cuLaunchKernel(functions[v],n/tile,n/tile,1,128,1,1,0,timer.stream,params,nullptr));
  };
  auto verify = [&](int v) {
    constexpr uint32_t sentinel = 0x7fc12345u;
    std::vector<uint32_t> out(count+guard,sentinel);
    check(cuMemcpyHtoD(dc.ptr,out.data(),out.size()*4)); check(cuCtxSynchronize());
    launch(v); check(cuCtxSynchronize()); check(cuMemcpyDtoH(out.data(),dc.ptr,out.size()*4));
    for (int row = 0; row < n; ++row) for (int col = 0; col < n; ++col) {
      const size_t i = size_t(row)*n+col;
      const int64_t expected = row >= logical || col >= logical ? 0 : (random ? oracle[i] : table[row%7][col%11]);
      if (integer) {
        int actual; std::memcpy(&actual,&out[i],4);
        if (actual != expected) throw std::runtime_error(kernel+" integer mismatch at "+std::to_string(i));
      } else {
        float actual; std::memcpy(&actual,&out[i],4);
        if (actual != float(expected)/64) throw std::runtime_error(kernel+" float mismatch at "+std::to_string(i));
      }
    }
    for (size_t i = count; i < out.size(); ++i) if (out[i] != sentinel) throw std::runtime_error("Precision output guard overwritten");
  };
  for (size_t v = 0; v < variants.size(); ++v) verify(int(v));
  std::cerr << "Verified " << kernel << " logical=" << logical << " padded=" << n << (random ? " random" : " periodic") << ": all variants, every output and guard\n";
  if (verify_only) return;
  for (int i = 0; i < 40; ++i) for (size_t v = 0; v < variants.size(); ++v) launch(int(v));
  check(cuCtxSynchronize());
  double pilot = 0;
  for (size_t v = 0; v < variants.size(); ++v) pilot = std::max(pilot,timer.measure([&] {launch(int(v));},10));
  const int batch = std::clamp(int(batch_ms*1000/pilot),1,8192);
  std::vector<CUgraph> graph(variants.size()); std::vector<CUgraphExec> executable(variants.size());
  if (graphs) for (size_t v = 0; v < variants.size(); ++v) {
    check(cuStreamBeginCapture(timer.stream,CU_STREAM_CAPTURE_MODE_THREAD_LOCAL));
    for (int i = 0; i < batch; ++i) launch(int(v));
    check(cuStreamEndCapture(timer.stream,&graph[v]));
    check(cuGraphInstantiateWithFlags(&executable[v],graph[v],0));
    for (int i = 0; i < 2; ++i) check(cuGraphLaunch(executable[v],timer.stream));
    check(cuStreamSynchronize(timer.stream));
  }
  std::cerr << "Timing " << (graphs ? "graph" : "direct") << " batch=" << batch << " rounds=" << rounds << '\n';
  std::vector<int> order(variants.size()); std::iota(order.begin(),order.end(),0);
  for (int r = 0; r < rounds; ++r) {
    if (r % variants.size() == 0) std::shuffle(order.begin(),order.end(),rng);
    for (size_t pos = 0; pos < variants.size(); ++pos) {
      const int v = order[(pos+r)%variants.size()];
      const double us = graphs ? timer.measure([&] {check(cuGraphLaunch(executable[v],timer.stream));},1)/batch : timer.measure([&] {launch(v);},batch);
      std::cout << kernel << ',' << logical << ',' << r << ',' << pos << ',' << batch << ',' << variants[v].label << ',' << us << '\n';
    }
  }
  for (size_t v = 0; v < variants.size(); ++v) {
    verify(int(v));
    if (graphs) {check(cuGraphExecDestroy(executable[v])); check(cuGraphDestroy(graph[v]));}
  }
}

#ifndef PRECISION_BENCH_NO_MAIN
int main(int argc,char** argv) {
  try {
    if (argc < 2) throw std::runtime_error("Usage: bench MODULES [--verify-only] [--rounds 20] [--batch-ms 15] [--seed 1] [--direct]");
    bool verify_only = false, graphs = true; int rounds = 20; double batch_ms = 15; unsigned seed = 1;
    for (int i = 2; i < argc; ++i) {
      std::string arg = argv[i];
      if (arg == "--verify-only") verify_only = true;
      else if (arg == "--direct") graphs = false;
      else if (arg == "--rounds" && i+1 < argc) rounds = std::stoi(argv[++i]);
      else if (arg == "--batch-ms" && i+1 < argc) batch_ms = std::stod(argv[++i]);
      else if (arg == "--seed" && i+1 < argc) seed = unsigned(std::stoul(argv[++i]));
      else throw std::runtime_error("Invalid precision benchmark option");
    }
    if (rounds < 4 || rounds > 200 || !std::isfinite(batch_ms) || batch_ms < 1 || batch_ms > 100) throw std::runtime_error("Invalid rounds/batch");
    check(cuInit(0)); CUdevice device; check(cuDeviceGet(&device,0)); CUcontext context;
    check(cuDevicePrimaryCtxRetain(&context,device)); check(cuCtxSetCurrent(context));
    int major; check(cuDeviceGetAttribute(&major,CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MAJOR,device));
    char name[256]; check(cuDeviceGetName(name,sizeof(name),device)); std::cerr << "GPU: " << name << "; seed=" << seed << '\n';
    std::mt19937 rng(seed); std::vector<Variant> variants; Variant v;
    std::ifstream manifest(std::string(argv[1])+"/variants.tsv");
    while (manifest >> v.label >> v.prefix) variants.push_back(v);
    if (variants.empty() || variants.size() > 100 || rounds % variants.size()) throw std::runtime_error("Need balanced manifest");
    std::vector<int> order(variants.size()); std::iota(order.begin(),order.end(),0); std::shuffle(order.begin(),order.end(),rng);
    for (int index : order) check(cuModuleLoad(&variants[index].module,(std::string(argv[1])+"/"+variants[index].label+".cubin").c_str()));
    std::vector<std::string> kernels{"wmma_fp16","wmma_int8","wmma_int4"};
    if (major >= 8) kernels.push_back("wmma_bf16");
    for (const auto& kernel : kernels) for (int n : {1,17,67,129}) precision_case(kernel,n,true,variants,rounds,batch_ms,true,rng,graphs);
    std::vector<std::pair<std::string,int>> cases;
    for (const auto& kernel : kernels) for (int n : {128,512,1024,2048,4096}) cases.emplace_back(kernel,n);
    std::shuffle(cases.begin(),cases.end(),rng);
    if (!verify_only) std::cout << std::fixed << std::setprecision(6) << "workload,size,round,position,batch,variant,us\n";
    for (const auto& test : cases) precision_case(test.first,test.second,false,variants,rounds,batch_ms,verify_only,rng,graphs);
    for (const auto& item : variants) check(cuModuleUnload(item.module));
    check(cuDevicePrimaryCtxRelease(device)); return 0;
  } catch (const std::exception& error) { std::cerr << "Error: " << error.what() << '\n'; return 1; }
}

#endif
