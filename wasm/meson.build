bp_wasm_cargs = ['-msimd128']

executable('bzip2-main',
  files('bzip2_wasm_module.c'),
  link_with: libbzip2,
  c_args: bp_wasm_cargs,
  link_args: [
    '-sWASM=1','-sMODULARIZE=1','-sEXPORT_ES6=1','-sEXPORT_NAME=Bzip2Module',
    '-sALLOW_MEMORY_GROWTH=1','-sNO_FILESYSTEM=1',
    '-sEXPORTED_RUNTIME_METHODS=["cwrap","ccall","UTF8ToString"]','-O3','-flto'
  ],
  install: true,
  install_dir: get_option('bindir')
)

shared_module('bzip2-side',
  files('bzip2_wasm_side.c'),
  link_with: libbzip2,
  name_prefix: '',
  c_args: bp_wasm_cargs,
  link_args: ['-sSIDE_MODULE=2','-fPIC','-O3','-flto','-sEXPORTED_FUNCTIONS=["_bzip2_wasm_version"]'],
  install: true,
  install_dir: get_option('libdir')
)

