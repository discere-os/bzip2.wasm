#include "bzlib.h"
#include "bz_version.h"

const char* bzip2_wasm_version(void) {
  return BZ_VERSION;
}

