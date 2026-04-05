const esbuild = require('esbuild');
const { copy } = require('esbuild-plugin-copy');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  return require('esbuild')
    .context({
      entryPoints: {
        client: './src/client/extension.ts',
        server: './src/server/index.ts',
      },
      sourcemap: true,
      bundle: true,
      metafile: process.argv.includes('--metafile'),
      outdir: './out',
      external: ['vscode'],
      format: 'cjs',
      platform: 'node',
      tsconfig: './tsconfig.json',
      define: { 'process.env.NODE_ENV': '"production"' },
      minify: process.argv.includes('--minify'),
      plugins: [
        {
          name: 'umd2esm',
          setup(build) {
            build.onResolve(
              { filter: /^(vscode-.*-languageservice|jsonc-parser)/ },
              (args) => {
                const pathUmdMay = require.resolve(args.path, {
                  paths: [args.resolveDir],
                });
                // Call twice the replace is to solve the problem of the path in Windows
                const pathEsm = pathUmdMay
                  .replace('/umd/', '/esm/')
                  .replace('\\umd\\', '\\esm\\');
                return { path: pathEsm };
              },
            );
          },
        },
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
    })
    .then(async (ctx) => {
      console.log('building...');
      if (process.argv.includes('--watch')) {
        await ctx.watch();
        console.log('watching...');
      } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.log('finished.');
      }
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
