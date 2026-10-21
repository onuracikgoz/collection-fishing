import typescript from '@rollup/plugin-typescript';

// Shared data files (content/maps/*.json) are bundled as plain objects.
const json = {
  name: 'json',
  transform(code, id) {
    if (!id.endsWith('.json')) return null;
    return { code: `export default ${JSON.stringify(JSON.parse(code))};`, map: { mappings: '' } };
  },
};

// Nakama's JS runtime needs one plain script with a global InitModule,
// so we bundle everything into build/index.js without module wrappers.
export default {
  input: 'src/main.ts',
  external: ['nakama-runtime'],
  plugins: [json, typescript({ tsconfig: './tsconfig.json', exclude: ['test/**'] })],
  output: { file: 'build/index.js', format: 'es', exports: 'none' },
  treeshake: { moduleSideEffects: 'no-external' },
};
