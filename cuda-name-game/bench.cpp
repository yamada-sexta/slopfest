#include <cuda.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <functional>
#include <fstream>
#include <numeric>
#include <random>
#include <iomanip>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

static void check(CUresult result) {
  if (result != CUDA_SUCCESS) {
    const char* text = nullptr;
    cuGetErrorString(result, &text);
    throw std::runtime_error(text ? text : "CUDA driver error");
  }
}
struct Memory {
  CUdeviceptr ptr{};
  explicit Memory(size_t bytes) { check(cuMemAlloc(&ptr, bytes)); }
  ~Memory() { if (ptr) cuMemFree(ptr); }
  Memory(const Memory&) = delete;
  Memory& operator=(const Memory&) = delete;
};
struct Variant { std::string label, prefix; CUmodule module{}; };
struct Timer {
  CUevent begin{}, end{};
  CUstream stream{};
  Timer() { check(cuStreamCreate(&stream, CU_STREAM_NON_BLOCKING)); check(cuEventCreate(&begin, 0)); check(cuEventCreate(&end, 0)); }
  ~Timer() { cuEventDestroy(begin); cuEventDestroy(end); cuStreamDestroy(stream); }
  double measure(const std::function<void()>& launch, int count) {
    check(cuEventRecord(begin, stream));
    for (int i = 0; i < count; i++) launch();
    check(cuEventRecord(end, stream)); check(cuEventSynchronize(end));
    float ms = 0; check(cuEventElapsedTime(&ms, begin, end));
    return double(ms) * 1000 / count;
  }
};
struct Case { std::string kernel; int n; bool random; };

static void execute(const Case& test, const std::vector<Variant>& variants, int rounds, double batch_ms, bool verify_only, std::mt19937& rng, bool graphs) {
  const bool vector = test.kernel != "tiled_gemm" && test.kernel != "register_gemm";
  const bool reduction = test.kernel == "reduce256";
  Timer timer;
  const int n = test.n;
  const size_t count = vector ? size_t(n) : size_t(n) * n;
  const size_t outputs = reduction ? (count + 255) / 256 : count;
  std::vector<float> a(count), b(count), reference(outputs);
  uint32_t seed = 7;
  auto random_int = [&seed](int range) { seed = seed * 1664525u + 1013904223u; return int((seed >> 16) % uint32_t(range)); };
  if (vector) {
    for (size_t i = 0; i < count; i++) {
      a[i] = float(int(i % 17) - 8) / 8; b[i] = float(int(i % 23) - 11) / 8;
      if (test.kernel == "saxpy") reference[i] = std::fma(1.25f, a[i], b[i]);
    }
    if (test.kernel == "reduce256") {
      for (size_t i = 0; i < count; ++i) reference[i / 256] += a[i];
    } else if (test.kernel == "stencil") {
      for (size_t i = 0; i < count; ++i) reference[i] = (i ? a[i-1] : 0) + 2 * a[i] + (i+1 < count ? a[i+1] : 0);
    } else if (test.kernel == "fma_chain") {
      float table[17][23];
      for (int i = 0; i < 17; ++i) for (int j = 0; j < 23; ++j) {
        float x = float(i-8)/8, y = float(j-11)/8;
        for (int k = 0; k < 128; ++k) {
          x = std::fma(x, 0.999f, y * 0.001f);
          y = std::fma(y, 0.998f, x * 0.002f);
        }
        table[i][j] = x + y;
      }
      for (size_t i = 0; i < count; ++i) reference[i] = table[i%17][i%23];
    }
  } else {
    for (int row = 0; row < n; row++) for (int col = 0; col < n; col++) {
      a[size_t(row) * n + col] = float(test.random ? random_int(7) - 3 : (row * 3 + col * 5) % 7 - 3) / 8;
      b[size_t(row) * n + col] = float(test.random ? random_int(11) - 5 : (row * 2 + col * 7) % 11 - 5) / 8;
    }
    if (test.random) {
      for (int row = 0; row < n; row++) for (int col = 0; col < n; col++) {
        double sum = 0;
        for (int k = 0; k < n; k++) sum += double(a[size_t(row) * n + k]) * b[size_t(k) * n + col];
        reference[size_t(row) * n + col] = float(sum);
      }
    } else {
      // Periodic dyadic inputs permit a full independent CPU oracle in O(n^2).
      // All products/sums are exactly representable in FP32 for these sizes.
      float table[7][11];
      for (int row = 0; row < 7; row++) for (int col = 0; col < 11; col++) {
        int sum = 0;
        for (int k = 0; k < n; k++) sum += ((row * 3 + k * 5) % 7 - 3) * ((k * 2 + col * 7) % 11 - 5);
        table[row][col] = float(sum) / 64;
      }
      for (int row = 0; row < n; row++) for (int col = 0; col < n; col++) reference[size_t(row) * n + col] = table[row % 7][col % 11];
    }
  }
  constexpr size_t guard = 64;
  constexpr float sentinel = -9876.5f;
  Memory da(count * sizeof(float)), db(count * sizeof(float)), dc((outputs + guard) * sizeof(float));
  check(cuMemcpyHtoD(da.ptr, a.data(), count * sizeof(float)));
  check(cuMemcpyHtoD(db.ptr, b.data(), count * sizeof(float)));
  check(cuCtxSynchronize()); // Pageable HtoD completion must precede nonblocking-stream work.
  std::vector<CUfunction> functions(variants.size());
  for (size_t variant = 0; variant < variants.size(); variant++) {
    const std::string name = variants[variant].prefix + "_" + test.kernel;
    check(cuModuleGetFunction(&functions[variant], variants[variant].module, name.c_str()));
  }
  auto launch = [&](int variant) {
    int size = n;
    void* params[] = { &da.ptr, &db.ptr, &dc.ptr, &size };
    const unsigned tile = test.kernel == "register_gemm" ? 128 : 16;
    const unsigned gx = vector ? (n + 255) / 256 : (n + tile - 1) / tile;
    const unsigned gy = vector ? 1 : (n + tile - 1) / tile;
    check(cuLaunchKernel(functions[variant], gx, gy, 1, vector ? 256 : 16, vector ? 1 : 16, 1, 0, timer.stream, params, nullptr));
  };
  auto verify = [&](int variant) {
    std::vector<float> output(outputs + guard, std::numeric_limits<float>::quiet_NaN());
    std::fill(output.begin() + outputs, output.end(), sentinel);
    check(cuMemcpyHtoD(dc.ptr, output.data(), output.size() * sizeof(float)));
    check(cuCtxSynchronize());
    launch(variant); check(cuCtxSynchronize());
    check(cuMemcpyDtoH(output.data(), dc.ptr, output.size() * sizeof(float)));
    for (size_t i = 0; i < outputs; i++) if (output[i] != reference[i]) {
      throw std::runtime_error(test.kernel + " n=" + std::to_string(n) + " variant=" + std::to_string(variant) + " disagrees with CPU at output " + std::to_string(i));
    }
    for (size_t i = outputs; i < output.size(); i++) if (output[i] != sentinel) throw std::runtime_error("Output guard overwritten");
  };
  for (size_t v = 0; v < variants.size(); ++v) verify(int(v));
  std::cerr << "Verified " << test.kernel << " n=" << n << ": all " << variants.size() << " variants, every output and guard\n";
  if (verify_only) return;
  for (int i = 0; i < 40; i++) for (size_t v = 0; v < variants.size(); ++v) launch(int(v));
  check(cuCtxSynchronize());
  double pilot = 0;
  for (size_t v = 0; v < variants.size(); ++v) pilot = std::max(pilot, timer.measure([&] { launch(int(v)); }, 10));
  const int batch = std::clamp(int(batch_ms * 1000 / pilot), 1, 8192);
  std::vector<CUgraph> graph(variants.size());
  std::vector<CUgraphExec> executable(variants.size());
  if (graphs) for (size_t v = 0; v < variants.size(); ++v) {
    check(cuStreamBeginCapture(timer.stream, CU_STREAM_CAPTURE_MODE_THREAD_LOCAL));
    for (int i = 0; i < batch; ++i) launch(int(v));
    check(cuStreamEndCapture(timer.stream, &graph[v]));
    check(cuGraphInstantiateWithFlags(&executable[v], graph[v], 0));
    // Upload/first-launch costs are excluded from the measurements.
    for (int i = 0; i < 2; ++i) check(cuGraphLaunch(executable[v], timer.stream));
    check(cuStreamSynchronize(timer.stream));
  }
  std::cerr << "Timing " << (graphs ? "graph" : "direct") << " batch=" << batch << " rounds=" << rounds << "\n";
  std::vector<int> order(variants.size());
  std::iota(order.begin(), order.end(), 0);
  for (int round = 0; round < rounds; round++) {
    if (round % int(variants.size()) == 0) std::shuffle(order.begin(), order.end(), rng);
    for (size_t pos = 0; pos < variants.size(); ++pos) {
      const int v = order[(pos + round) % variants.size()];
      const double us = graphs ? timer.measure([&] { check(cuGraphLaunch(executable[v], timer.stream)); }, 1) / batch
                               : timer.measure([&] { launch(v); }, batch);
      std::cout << test.kernel << ',' << n << ',' << round << ',' << pos << ',' << batch << ',' << variants[v].label << ',' << us << '\n';
    }
  }
  for (size_t v = 0; v < variants.size(); ++v) {
    verify(int(v));
    if (graphs) { check(cuGraphExecDestroy(executable[v])); check(cuGraphDestroy(graph[v])); }
  }

}

int main(int argc, char** argv) {
  try {
    if (argc < 2) throw std::runtime_error("Usage: bench MODULE_DIRECTORY [--verify-only] [--rounds 20] [--batch-ms 15] [--seed 1] [--direct]");
    bool verify_only = false, graphs = true; int rounds = 20; double batch_ms = 15; unsigned seed = 1;
    for (int i = 2; i < argc; i++) {
      const std::string arg = argv[i];
      if (arg == "--direct") graphs = false;
      else if (arg == "--seed" && i + 1 < argc) seed = unsigned(std::stoul(argv[++i]));
      else if (arg == "--verify-only") verify_only = true;
      else if (arg == "--rounds" && i + 1 < argc) rounds = std::stoi(argv[++i]);
      else if (arg == "--batch-ms" && i + 1 < argc) batch_ms = std::stod(argv[++i]);
      else throw std::runtime_error("Unknown or incomplete option: " + arg);
    }
    if (rounds < 4 || rounds > 200 || !std::isfinite(batch_ms) || batch_ms < 1 || batch_ms > 100) throw std::runtime_error("Use 4–200 rounds and 1–100 batch milliseconds.");
    check(cuInit(0)); CUdevice device; check(cuDeviceGet(&device, 0));
    CUcontext context; check(cuDevicePrimaryCtxRetain(&context, device)); check(cuCtxSetCurrent(context));
    char name[256]; check(cuDeviceGetName(name, sizeof(name), device)); int driver; check(cuDriverGetVersion(&driver));
    std::cerr << "GPU: " << name << "; driver API: " << driver << '\n';
    std::mt19937 rng(seed);
    std::cerr << "Seed: " << seed << "; timing=" << (graphs ? "graph" : "direct") << '\n';
    std::vector<Variant> variants;
    std::ifstream manifest(std::string(argv[1]) + "/variants.tsv");
    Variant v;
    while (manifest >> v.label >> v.prefix) variants.push_back(v);
    if (variants.empty() || variants.size() > 100 || rounds % variants.size()) throw std::runtime_error("Need manifest and rounds divisible by variant count.");
    std::vector<size_t> loading(variants.size());
    std::iota(loading.begin(), loading.end(), 0);
    std::shuffle(loading.begin(), loading.end(), rng);
    for (size_t index : loading) check(cuModuleLoad(&variants[index].module, (std::string(argv[1]) + "/" + variants[index].label + ".cubin").c_str()));
    for (int n : {1, 17, 67, 129}) for (const auto* kernel : {"tiled_gemm", "register_gemm"}) execute({kernel, n, true}, variants, rounds, batch_ms, true, rng, graphs);
    for (int n : {1, 257, 4099}) for (const auto* kernel : {"saxpy", "stencil", "reduce256", "fma_chain"}) execute({kernel, n, false}, variants, rounds, batch_ms, true, rng, graphs);
    {
      if (!verify_only) std::cout << std::fixed << std::setprecision(6) << "workload,size,round,position,batch,variant,us\n";
      std::vector<Case> cases{{"saxpy", 1048576, false}, {"saxpy", 8388608, false}, {"stencil", 1048576, false}, {"stencil", 8388608, false}, {"reduce256", 1048576, false}, {"reduce256", 8388608, false}, {"fma_chain", 65536, false}, {"fma_chain", 1048576, false}, {"tiled_gemm", 256, false}, {"tiled_gemm", 1024, false}, {"register_gemm", 256, false}, {"register_gemm", 1024, false}, {"register_gemm", 2048, false}};
      std::shuffle(cases.begin(), cases.end(), rng);
      for (const Case& test : cases) execute(test, variants, rounds, batch_ms, verify_only, rng, graphs);
    }
    for (const Variant& item : variants) check(cuModuleUnload(item.module));
    check(cuDevicePrimaryCtxRelease(device));
    return 0;
  } catch (const std::exception& error) { std::cerr << "Error: " << error.what() << '\n'; return 1; }
}
