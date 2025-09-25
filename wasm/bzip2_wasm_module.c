#include <emscripten.h>
#include "bzlib.h"
#include "bz_version.h"

EMSCRIPTEN_KEEPALIVE
const char* bzip2_wasm_version(void) {
  return BZ_VERSION;
}

