#define PRECISION_BENCH_NO_MAIN
#include "../precision_bench.cpp"


static void require(bool value) { if (!value) throw std::runtime_error("Packing test failed"); }
int main() {
  (void)&precision_case;
  // Decode independently from each binary format, including all signed codes.
  for (const std::string format : {"wmma_fp16","wmma_bf16"}) {
    std::vector<unsigned char> bytes(30);
    for (int q = -7; q <= 7; ++q) pack(bytes,size_t(q+7),q,format);
    for (int q = -7; q <= 7; ++q) {
      uint16_t word; std::memcpy(&word,bytes.data()+(q+7)*2,2);
      const int mantissa_bits = format == "wmma_fp16" ? 10 : 7;
      const int bias = format == "wmma_fp16" ? 15 : 127;
      const int exponent = (word>>mantissa_bits)&(format == "wmma_fp16" ? 31 : 255);
      const int mantissa = word&((1<<mantissa_bits)-1);
      double decoded = exponent ? std::ldexp(1+double(mantissa)/(1<<mantissa_bits),exponent-bias) : 0;
      if (word&0x8000) decoded = -decoded;
      require(decoded == double(q)/8);
    }
  }
  std::vector<unsigned char> eight(256), four(8);
  for (int q = -128; q <= 127; ++q) pack(eight,size_t(q+128),q,"wmma_int8");
  for (int q = -8; q <= 7; ++q) pack(four,size_t(q+8),q,"wmma_int4");
  for (int q = -128; q <= 127; ++q) {
    int decoded = eight[q+128]; if (decoded>=128) decoded-=256;
    require(decoded==q);
  }
  for (int q = -8; q <= 7; ++q) {
    int decoded = (four[(q+8)/2]>>(((q+8)%2)*4))&15;
    if (decoded>=8) decoded-=16;
    require(decoded==q);
  }
  require(qa(0,0,8)==-128 && qa(0,51,8)==127);
  require(qa(0,0,4)==-8 && qa(0,3,4)==7);
  std::cout << "All FP16/BF16 dyadics and signed INT8/INT4 codes round-trip exactly.\n";
}
