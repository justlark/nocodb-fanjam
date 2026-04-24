const { join, resolve } = require('path');
const { rspack } = require('@rspack/core');
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

// Playwright/CI-specific config derived from rspack.dev.config.js.
//
// Key difference: autoRestart is false. In the dev config, autoRestart: true
// causes the backend process to restart whenever rspack emits a 'done' event.
// TsCheckerRspackPlugin (also in dev config) runs type-checking in a separate
// process and emits a second 'done' event after the initial build, triggering
// a spurious restart. In CI the code never changes, so auto-restart is both
// unnecessary and harmful — it creates an ECONNREFUSED window exactly when
// Playwright tests begin connecting to the backend.
module.exports = {
  mode: 'development',
  target: 'node',
  devtool: 'inline-source-map',
  entry: {
    main: [process.env.ENTRYPOINT],
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[path][name].[ext]',
        },
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          sourceMaps: true,
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
              decorators: true,
              dynamicImport: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
            target: 'es2017',
            loose: true,
            externalHelpers: false,
            keepClassNames: true,
          },
          module: {
            type: 'commonjs',
            strict: false,
            strictMode: true,
            lazy: false,
            noInterop: false,
          },
        },
      },
    ],
  },
  externals: [
    nodeExternals({
      allowlist: ['webpack/hot/poll?1000'],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.node'],
    tsConfig: {
      configFile: resolve('tsconfig.json'),
    },
    alias: {
      '@noco-local-integrations': resolve(__dirname, '../noco-integrations/packages'),
    },
  },
  optimization: {
    minimize: false,
    nodeEnv: false,
  },
  plugins: [
    new rspack.EnvironmentPlugin({
      EE: true,
      NODE_ENV: 'development',
    }),
    new RunScriptWebpackPlugin({
      name: 'main.js',
      autoRestart: false,
    }),
    new rspack.CopyRspackPlugin({
      patterns: [{ from: 'src/public', to: 'public' }],
    }),
  ],
  output: {
    devtoolModuleFilenameTemplate: (info) => {
      return resolve(info.absoluteResourcePath);
    },
    path: join(__dirname, 'dist'),
    filename: 'main.js',
    library: {
      type: 'commonjs2',
    },
    clean: true,
  },
  watch: true,
  watchOptions: {
    ignored: /node_modules/,
    poll: 100,
  },
};
