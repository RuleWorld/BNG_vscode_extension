const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

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
				console.error(`    ${location.file}:${location.line}:${location.column}`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const sharedOptions = {
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	};

	const ctx = await esbuild.context({
		...sharedOptions,
		entryPoints: ['src/extension.ts'],
		outfile: 'dist/extension.js',
		external: ['vscode'],
	});

	const serverCtx = await esbuild.context({
		...sharedOptions,
		entryPoints: ['src/server/server.ts'],
		outfile: 'dist/server.js',
	});

	if (watch) {
		await Promise.all([ctx.watch(), serverCtx.watch()]);
	} else {
		await Promise.all([ctx.rebuild(), serverCtx.rebuild()]);
		await Promise.all([ctx.dispose(), serverCtx.dispose()]);
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
