const esbuild = require('esbuild');
const { copy } = require('esbuild-plugin-copy');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const serverCtx = await esbuild.context({
    entryPoints: ['./src/server/volar-server.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/server.js',
    logLevel: 'warning',
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./node_modules/tree-sitter-twig/tree-sitter-twig.wasm'],
          to: ['out'],
        },
      }),
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./node_modules/web-tree-sitter/tree-sitter.wasm'],
          to: ['out'],
        },
      }),
    ],
  });

  const extensionCtx = await esbuild.context({
    entryPoints: ['./src/client/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/extension.js',
    external: ['vscode'],
    logLevel: 'warning',
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  });

  if (watch) {
    await Promise.all([serverCtx.watch(), extensionCtx.watch()]);
    console.log('Watching for changes...');
  } else {
    await Promise.all([serverCtx.rebuild(), extensionCtx.rebuild()]);
    await serverCtx.dispose();
    await extensionCtx.dispose();
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) return;
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`,
        );
      });
      console.log('[watch] build finished');
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
