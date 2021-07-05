import { DEFAULT_EXTENSIONS } from '@babel/core';
import babel from '@rollup/plugin-babel';
import typescript from 'rollup-plugin-typescript2';
import postcss from 'rollup-plugin-postcss';
import resolve from '@rollup/plugin-node-resolve';
import url from '@rollup/plugin-url';
import svgr from '@svgr/rollup';
import { terser } from 'rollup-plugin-terser';
import json from '@rollup/plugin-json';

import svelte from 'rollup-plugin-svelte';


export default {
  input: 'src/index.ts',
  output: [
    {
      dir: 'dist',
      format: 'system',
      sourcemap: true,
    },
  ],
  external: [
    'react',
    'react-dom',
    'react-router-dom',
    'office-ui-fabric-core',
    'office-ui-fabric-react',
    'styled-components',
    '@apollo/client',
    '@apollo/client/link/context',
    '@apollo/client/link/ws',
    '@apollo/client/utilities',
    'subscriptions-transport-ws',
    'react-intl',
  ],
  plugins: [
    postcss({
      plugins: [],
      minimize: true,
      sourceMap: 'inline',
    }),
    svelte({
      include: 'src/**/*.svelte',
      emitCss: false
    }),
    typescript({
      typescript: require('typescript'),
      include: ['*.js+(|x)', '**/*.js+(|x)'],
      exclude: ['dist', 'node_modules/**'],
    }),
    babel({
      presets: ['react-app'],
      extensions: [...DEFAULT_EXTENSIONS, '.ts', '.tsx'],
      plugins: [
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/plugin-proposal-optional-chaining',
        '@babel/plugin-syntax-dynamic-import',
        '@babel/plugin-proposal-class-properties',
        'transform-react-remove-prop-types',
      ],
      exclude: ['node_modules/**'],
      babelHelpers: 'runtime',
      sourceMaps: 'inline',
    }),
    url(),
    svgr(),
    json(),
    resolve(),
    terser(),
  ],
  onwarn: (warning, warn) => {
    if (warning.code === 'THIS_IS_UNDEFINED') {
      return;
    }

    warn(warning);
  },
};
