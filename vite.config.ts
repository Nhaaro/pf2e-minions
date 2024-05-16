import esbuild from 'esbuild';
import fs from 'fs-extra';
import path, { resolve } from 'path';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tsconfigPaths from 'vite-tsconfig-paths';
import packageJSON from './package.json' assert { type: 'json' };
import { PACKAGE_ID } from './src/constants.ts';
import handlebarsHMR from './utils/vite/handlebars-hmr.ts';
import languagesHMR from './utils/vite/languages-hmr.ts';

const [outDir] = (() => {
    const configPath = resolve(process.cwd(), 'foundryconfig.json');
    const config = fs.readJSONSync(configPath, { throws: false });
    const outDir =
        config instanceof Object
            ? path.join(config.dataPath, 'modules', config.systemName ?? PACKAGE_ID)
            : path.join(__dirname, 'dist/');
    return [outDir] as const;
})();

const config = defineConfig(({ command, mode }) => {
    const buildMode = mode === 'production' ? 'production' : 'development';

    const plugins = [checker({ typescript: true }), tsconfigPaths(), handlebarsHMR(), languagesHMR()];

    // Handle minification after build to allow for tree-shaking and whitespace minification
    // "Note the build.minify option does not minify whitespaces when using the 'es' format in lib mode, as it removes
    // pure annotations and breaks tree-shaking."
    if (buildMode === 'production') {
        plugins.push(
            {
                name: 'minify',
                renderChunk: {
                    order: 'post',
                    async handler(code, chunk) {
                        return chunk.fileName.endsWith('.mjs')
                            ? esbuild.transform(code, {
                                  keepNames: true,
                                  minifyIdentifiers: false,
                                  minifySyntax: true,
                                  minifyWhitespace: true,
                              })
                            : code;
                    },
                },
            },
            ...viteStaticCopy({
                targets: [
                    { src: 'README.md', dest: '.' },
                    { src: 'CHANGELOG.md', dest: '.' },
                    { src: 'CONTRIBUTING.md', dest: '.' },
                    { src: 'UNLICENSE', dest: '.' },
                ],
            })
        );
    } else {
        plugins.push(
            // Foundry expects all esm files listed in system.json to exist: create empty vendor module when in dev mode
            {
                name: 'touch-vendor-mjs',
                apply: 'build',
                writeBundle: {
                    async handler() {
                        fs.closeSync(fs.openSync(path.resolve(outDir, 'vendor.mjs'), 'w'));
                    },
                },
            }
        );
    }

    // Create dummy files for vite dev server
    if (command === 'serve') {
        const message = 'This file is for a running vite dev server and is not copied to a build';
        fs.writeFileSync('./index.html', `<h1>${message}</h1>\n`);
        fs.writeFileSync(`./${PACKAGE_ID}.css`, `/** ${message} */\n\n@import "./src/styles/module.css"`);
        fs.writeFileSync(`./${PACKAGE_ID}.mjs`, `/** ${message} */\n\nimport "./src/index.ts";\n`);
        fs.writeFileSync('./vendor.mjs', `/** ${message} */\n`);
    }

    return {
        publicDir: 'static',
        base: command === 'build' ? './' : `/modules/${PACKAGE_ID}/`,
        define: {
            BUILD_MODE: JSON.stringify(buildMode),
        },
        server: {
            port: 30001,
            open: false,
            proxy: {
                [`^(?!/modules/${PACKAGE_ID})`]: 'http://localhost:30000/',
                '/socket.io': {
                    target: `ws://localhost:30000`,
                    ws: true,
                },
            },
        },
        esbuild: { keepNames: true },
        build: {
            outDir,
            emptyOutDir: true,
            sourcemap: buildMode === 'development',
            minify: buildMode === 'production',
            lib: {
                name: PACKAGE_ID,
                entry: 'src/index.ts',
                formats: ['es'],
                fileName: PACKAGE_ID,
            },
            rollupOptions: {
                output: {
                    // vite is wrong about this type, if we return undefined it cannot build
                    assetFileNames: ({ name }): string =>
                        // Forcibly rename style file so that it does not share Foundry's CSS file name
                        name === 'style.css' ? `${PACKAGE_ID}.css` : name!,
                    chunkFileNames: '[name].mjs',
                    entryFileNames: `${PACKAGE_ID}.mjs`,
                    manualChunks:
                        buildMode === 'production' && 'dependencies' in packageJSON
                            ? {
                                  vendor: Object.keys(packageJSON.dependencies as object),
                              }
                            : undefined,
                },
                watch: { buildDelay: 100 },
            },
        },
        clearScreen: false,
        plugins,
        css: {
            devSourcemap: buildMode === 'development',
        },
    };
});

export default config;
