#include <cuda.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <functional>
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
struct Timer {
  CUevent begin{}, end{};
  Timer() { check(cuEventCreate(&begin, 0)); check(cuEventCreate(&end, 0)); }
  ~Timer() { cuEventDestroy(begin); cuEventDestroy(end); }
  double measure(const std::function<void()>& launch, int count) {
    check(cuEventRecord(begin, nullptr));
    for (int i = 0; i < count; i++) launch();
    check(cuEventRecord(end, nullptr)); check(cuEventSynchronize(end));
    float ms = 0; check(cuEventElapsedTime(&ms, begin, end));
    return double(ms) * 1000 / count;
  }
};
struct Case { std::string kernel; int n; bool random; };

static void execute(const Case& test, const CUmodule modules[2], int rounds, double batch_ms, bool verify_only) {
  const bool vector = test.kernel == "saxpy";
  const int n = test.n;
  const size_t count = vector ? size_t(n) : size_t(n) * n;
  std::vector<float> a(count), b(count), reference(count);
  uint32_t seed = 7;
  auto random_int = [&seed](int range) { seed = seed * 1664525u + 1013904223u; return int((seed >> 16) % uint32_t(range)); };
  if (vector) {
    for (size_t i = 0; i < count; i++) {
      a[i] = float(int(i % 17) - 8) / 8; b[i] = float(int(i % 23) - 11) / 8;
      reference[i] = std::fma(1.25f, a[i], b[i]);
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
  Memory da(count * sizeof(float)), db(count * sizeof(float)), dc((count + guard) * sizeof(float));
  check(cuMemcpyHtoD(da.ptr, a.data(), count * sizeof(float)));
  check(cuMemcpyHtoD(db.ptr, b.data(), count * sizeof(float)));
  CUfunction functions[2];
  for (int variant = 0; variant < 2; variant++) {
    const std::string name = std::string(variant ? "cutlass_" : "neutral_") + test.kernel;
    check(cuModuleGetFunction(&functions[variant], modules[variant], name.c_str()));
  }
  auto launch = [&](int variant) {
    int size = n;
    void* params[] = { &da.ptr, &db.ptr, &dc.ptr, &size };
    const unsigned tile = test.kernel == "register_gemm" ? 128 : 16;
    const unsigned gx = vector ? (n + 255) / 256 : (n + tile - 1) / tile;
    const unsigned gy = vector ? 1 : (n + tile - 1) / tile;
    check(cuLaunchKernel(functions[variant], gx, gy, 1, vector ? 256 : 16, vector ? 1 : 16, 1, 0, nullptr, params, nullptr));
  };
  auto verify = [&](int variant) {
    std::vector<float> output(count + guard, std::numeric_limits<float>::quiet_NaN());
    std::fill(output.begin() + count, output.end(), sentinel);
    check(cuMemcpyHtoD(dc.ptr, output.data(), output.size() * sizeof(float)));
    launch(variant); check(cuCtxSynchronize());
    check(cuMemcpyDtoH(output.data(), dc.ptr, output.size() * sizeof(float)));
    for (size_t i = 0; i < count; i++) if (output[i] != reference[i]) {
      throw std::runtime_error(test.kernel + " n=" + std::to_string(n) + " variant=" + std::to_string(variant) + " disagrees with CPU at output " + std::to_string(i));
    }
    for (size_t i = count; i < output.size(); i++) if (output[i] != sentinel) throw std::runtime_error("Output guard overwritten");
  };
  verify(0); verify(1);
  std::cerr << "Verified " << test.kernel << " n=" << n << (test.random ? " random" : " periodic") << ": both names, every output and guard\n";
  if (verify_only) return;
  for (int i = 0; i < 40; i++) { launch(0); launch(1); }
  check(cuCtxSynchronize());
  Timer timer;
  const double pilot0 = timer.measure([&] { launch(0); }, 10);
  const double pilot1 = timer.measure([&] { launch(1); }, 10);
  const int batch = std::clamp(int(batch_ms * 1000 / std::max(pilot0, pilot1)), 1, 2048);
  std::cerr << "Timing batch: " << batch << " launches per name; alternating AB/BA order\n";
  for (int round = 0; round < rounds; round++) {
    double times[2]; const int first = round % 2;
    for (int position = 0; position < 2; position++) {
      const int variant = first ^ position;
      times[variant] = timer.measure([&] { launch(variant); }, batch);
    }
    std::cout << test.kernel << ',' << n << ',' << round << ',' << first << ',' << batch << ',' << times[0] << ',' << times[1] << ',' << times[0] / times[1] << '\n';
  }
  verify(0); verify(1);
}

int main(int argc, char** argv) {
  try {
    if (argc < 2) throw std::runtime_error("Usage: bench MODULE_DIRECTORY [--verify-only] [--rounds 12] [--batch-ms 15]");
    bool verify_only = false; int rounds = 12; double batch_ms = 15;
    for (int i = 2; i < argc; i++) {
      const std::string arg = argv[i];
      if (arg == "--verify-only") verify_only = true;
      else if (arg == "--rounds" && i + 1 < argc) rounds = std::stoi(argv[++i]);
      else if (arg == "--batch-ms" && i + 1 < argc) batch_ms = std::stod(argv[++i]);
      else throw std::runtime_error("Unknown or incomplete option: " + arg);
    }
    if (rounds < 4 || rounds > 100 || !std::isfinite(batch_ms) || batch_ms < 1 || batch_ms > 100) throw std::runtime_error("Use 4–100 rounds and 1–100 batch milliseconds.");
    check(cuInit(0)); CUdevice device; check(cuDeviceGet(&device, 0));
    CUcontext context; check(cuDevicePrimaryCtxRetain(&context, device)); check(cuCtxSetCurrent(context));
    char name[256]; check(cuDeviceGetName(name, sizeof(name), device)); int driver; check(cuDriverGetVersion(&driver));
    std::cerr << "GPU: " << name << "; driver API: " << driver << '\n';
    CUmodule modules[2];
    check(cuModuleLoad(&modules[0], (std::string(argv[1]) + "/neutral.cubin").c_str()));
    check(cuModuleLoad(&modules[1], (std::string(argv[1]) + "/cutlass.cubin").c_str()));
    // Small random matrices and ragged edges are independent of the timing input pattern.
    for (int n : {1, 17, 67, 129}) for (const auto* kernel : {"tiled_gemm", "register_gemm"}) execute({kernel, n, true}, modules, rounds, batch_ms, true);
    for (int n : {1, 257, 4099}) execute({"saxpy", n, false}, modules, rounds, batch_ms, true);
    if (!verify_only) {
      std::cout << std::fixed << std::setprecision(6) << "workload,size,round,first,batch,neutral_us,cutlass_us,speedup\n";
      for (const Case& test : std::vector<Case>{{"saxpy", 1048576, false}, {"saxpy", 8388608, false}, {"tiled_gemm", 256, false}, {"tiled_gemm", 1024, false}, {"register_gemm", 256, false}, {"register_gemm", 1024, false}, {"register_gemm", 2048, false}}) execute(test, modules, rounds, batch_ms, false);
    }
    check(cuModuleUnload(modules[0])); check(cuModuleUnload(modules[1])); check(cuDevicePrimaryCtxRelease(device));
    return 0;
  } catch (const std::exception& error) { std::cerr << "Error: " << error.what() << '\n'; return 1; }
}
