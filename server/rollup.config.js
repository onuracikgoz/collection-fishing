import typescript from '@rollup/plugin-typescript';

// Nakama's JS runtime needs one plain script with a global InitModule,
// so we bundle everything into build/index.js without module wrappers.
export default {
  input: 'src/main.ts',
  external: ['nakama-runtime'],
  plugins: [typescript({ tsconfig: './tsconfig.json', exclude: ['test/**'] })],
  output: { file: 'build/index.js', format: 'es', exports: 'none' },
  treeshake: { moduleSideEffects: 'no-external' },
};
