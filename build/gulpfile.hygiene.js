/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const filter = require('gulp-filter');
const es = require('event-stream');
const gulptslint = require('gulp-tslint');
const gulpeslint = require('gulp-eslint');
const tsfmt = require('typescript-formatter');
const tslint = require('tslint');
const VinylFile = require('vinyl');
const vfs = require('vinyl-fs');
const path = require('path');
const fs = require('fs');
const pall = require('p-all');
const task = require('./lib/task');

/**
 * Hygiene works by creating cascading subsets of all our files and
 * passing them through a sequence of checks. Here are the current subsets,
 * named according to the checks performed on them. Each subset contains
 * the following one, as described in mathematical notation:
 *
 * all ⊃ eol ⊇ indentation ⊃ copyright ⊃ typescript
 */

const all = [
	'*',
	'build/**/*',
	'extensions/**/*',
	'scripts/**/*',
	'src/**/*',
	'test/**/*',
	'!**/node_modules/**'
];

const indentationFilter = [
	'**',

	// except specific files
	'!ThirdPartyNotices.txt',
	'!LICENSE.{txt,rtf}',
	'!LICENSES.chromium.html',
	'!**/LICENSE',
	'!src/vs/nls.js',
	'!src/vs/nls.build.js',
	'!src/vs/css.js',
	'!src/vs/css.build.js',
	'!src/vs/loader.js',
	'!src/vs/base/common/insane/insane.js',
	'!src/vs/base/common/marked/marked.js',
	'!src/vs/base/node/terminateProcess.sh',
	'!src/vs/base/node/cpuUsage.sh',
	'!test/assert.js',

	// except specific folders
	'!test/automation/out/**',
	'!test/smoke/out/**',
	'!extensions/vscode-api-tests/testWorkspace/**',
	'!extensions/vscode-api-tests/testWorkspace2/**',
	'!build/monaco/**',
	'!build/win32/**',

	// except multiple specific files
	'!**/package.json',
	'!**/package-lock.json', // {{SQL CARBON EDIT}}
	'!**/yarn.lock',
	'!**/yarn-error.log',

	// except multiple specific folders
	'!**/octicons/**',
	'!**/codicon/**',
	'!**/fixtures/**',
	'!**/lib/**',
	'!extensions/**/out/**',
	'!extensions/**/snippets/**',
	'!extensions/**/syntaxes/**',
	'!extensions/**/themes/**',
	'!extensions/**/colorize-fixtures/**',

	// except specific file types
	'!src/vs/*/**/*.d.ts',
	'!src/typings/**/*.d.ts',
	'!extensions/**/*.d.ts',
	'!**/*.{svg,exe,png,bmp,scpt,bat,cmd,cur,ttf,woff,eot,md,ps1,template,yaml,yml,d.ts.recipe,ico,icns}',
	'!build/{lib,tslintRules,download}/**/*.js',
	'!build/**/*.sh',
	'!build/azure-pipelines/**/*.js',
	'!build/azure-pipelines/**/*.config',
	'!**/Dockerfile',
	'!**/Dockerfile.*',
	'!**/*.Dockerfile',
	'!**/*.dockerfile',
	'!extensions/markdown-language-features/media/*.js',
	// {{SQL CARBON EDIT}}
	'!**/*.{xlf,docx,sql,vsix,bacpac,ipynb}',
	'!extensions/mssql/sqltoolsservice/**',
	'!extensions/import/flatfileimportservice/**',
	'!extensions/admin-tool-ext-win/ssmsmin/**',
	'!extensions/resource-deployment/notebooks/**',
	'!extensions/mssql/notebooks/**',
	'!extensions/big-data-cluster/src/bigDataCluster/controller/apiGenerated.ts',
	'!extensions/big-data-cluster/src/bigDataCluster/controller/clusterApiGenerated2.ts'
];

const copyrightFilter = [
	'**',
	'!**/*.desktop',
	'!**/*.json',
	'!**/*.html',
	'!**/*.template',
	'!**/*.md',
	'!**/*.bat',
	'!**/*.cmd',
	'!**/*.ico',
	'!**/*.icns',
	'!**/*.xml',
	'!**/*.sh',
	'!**/*.txt',
	'!**/*.xpm',
	'!**/*.opts',
	'!**/*.disabled',
	'!**/*.code-workspace',
	'!**/promise-polyfill/polyfill.js',
	'!build/**/*.init',
	'!resources/linux/snap/snapcraft.yaml',
	'!resources/linux/snap/electron-launch',
	'!resources/win32/bin/code.js',
	'!resources/completions/**',
	'!extensions/markdown-language-features/media/highlight.css',
	'!extensions/html-language-features/server/src/modes/typescript/*',
	'!extensions/*/server/bin/*',
	'!src/vs/editor/test/node/classification/typescript-test.ts',
	// {{SQL CARBON EDIT}}
	'!extensions/notebook/src/intellisense/text.ts',
	'!extensions/mssql/src/hdfs/webhdfs.ts',
	'!src/sql/workbench/parts/notebook/browser/outputs/tableRenderers.ts',
	'!src/sql/workbench/parts/notebook/common/models/url.ts',
	'!src/sql/workbench/parts/notebook/browser/models/renderMimeInterfaces.ts',
	'!src/sql/workbench/parts/notebook/browser/models/outputProcessor.ts',
	'!src/sql/workbench/parts/notebook/browser/models/mimemodel.ts',
	'!src/sql/workbench/parts/notebook/browser/cellViews/media/*.css',
	'!src/sql/base/browser/ui/table/plugins/rowSelectionModel.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/rowDetailView.ts',
	'!src/sql/base/browser/ui/table/plugins/headerFilter.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/checkboxSelectColumn.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/cellSelectionModel.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/autoSizeColumns.plugin.ts',
	'!src/sql/workbench/parts/notebook/browser/outputs/sanitizer.ts',
	'!src/sql/workbench/parts/notebook/browser/outputs/renderers.ts',
	'!src/sql/workbench/parts/notebook/browser/outputs/registry.ts',
	'!src/sql/workbench/parts/notebook/browser/outputs/factories.ts',
	'!src/sql/workbench/parts/notebook/common/models/nbformat.ts',
	'!extensions/markdown-language-features/media/tomorrow.css',
	'!src/sql/workbench/browser/modelComponents/media/highlight.css',
	'!src/sql/workbench/parts/notebook/electron-browser/cellViews/media/highlight.css',
	'!extensions/mssql/sqltoolsservice/**',
	'!extensions/import/flatfileimportservice/**',
	'!extensions/notebook/src/prompts/**',
	'!extensions/mssql/src/prompts/**',
	'!extensions/notebook/resources/jupyter_config/**',
	'!extensions/query-history/images/**',
	'!**/*.gif',
	'!**/*.xlf',
	'!**/*.dacpac',
	'!**/*.bacpac'
];

const eslintFilter = [
	'src/**/*.js',
	'build/gulpfile.*.js',
	'!src/vs/loader.js',
	'!src/vs/css.js',
	'!src/vs/nls.js',
	'!src/vs/css.build.js',
	'!src/vs/nls.build.js',
	'!src/**/insane.js',
	'!src/**/marked.js',
	'!**/test/**'
];

const tslintBaseFilter = [
	'!**/fixtures/**',
	'!**/typings/**',
	'!**/node_modules/**',
	'!extensions/typescript-basics/test/colorize-fixtures/**',
	'!extensions/vscode-api-tests/testWorkspace/**',
	'!extensions/vscode-api-tests/testWorkspace2/**',
	'!extensions/**/*.test.ts',
	'!extensions/html-language-features/server/lib/jquery.d.ts',
	'!extensions/big-data-cluster/src/bigDataCluster/controller/apiGenerated.ts', // {{SQL CARBON EDIT}},
	'!extensions/big-data-cluster/src/bigDataCluster/controller/tokenApiGenerated.ts' // {{SQL CARBON EDIT}}
];

const sqlFilter = ['src/sql/**']; // {{SQL CARBON EDIT}}

const tslintCoreFilter = [
	'src/**/*.ts',
	'test/**/*.ts',
	'!extensions/**/*.ts',
	'!test/automation/**',
	'!test/smoke/**',
	...tslintBaseFilter
];

const tslintExtensionsFilter = [
	'extensions/**/*.ts',
	'!src/**/*.ts',
	'!test/**/*.ts',
	'test/automation/**/*.ts',
	...tslintBaseFilter
];

const tslintHygieneFilter = [
	'src/**/*.ts',
	'test/**/*.ts',
	'extensions/**/*.ts',
	...tslintBaseFilter
];

const copyrightHeaderLines = [
	'/*---------------------------------------------------------------------------------------------',
	' *  Copyright (c) Microsoft Corporation. All rights reserved.',
	' *  Licensed under the Source EULA. See License.txt in the project root for license information.',
	' *--------------------------------------------------------------------------------------------*/'
];

gulp.task('eslint', () => {
	return vfs.src(all, { base: '.', follow: true, allowEmpty: true })
		.pipe(filter(eslintFilter))
		.pipe(gulpeslint('src/.eslintrc'))
		.pipe(gulpeslint.formatEach('compact'))
		.pipe(gulpeslint.failAfterError());
});

gulp.task('tslint', () => {
	return es.merge([

		// Core: include type information (required by certain rules like no-nodejs-globals)
		vfs.src(all, { base: '.', follow: true, allowEmpty: true })
			.pipe(filter(tslintCoreFilter))
			.pipe(gulptslint.default({ rulesDirectory: 'build/lib/tslint', program: tslint.Linter.createProgram('src/tsconfig.json') }))
			.pipe(gulptslint.default.report({ emitError: true })),

		// Exenstions: do not include type information
		vfs.src(all, { base: '.', follow: true, allowEmpty: true })
			.pipe(filter(tslintExtensionsFilter))
			.pipe(gulptslint.default({ rulesDirectory: 'build/lib/tslint' }))
			.pipe(gulptslint.default.report({ emitError: true }))
	]).pipe(es.through());
});

function checkPackageJSON(actualPath) {
	const actual = require(path.join(__dirname, '..', actualPath));
	const rootPackageJSON = require('../package.json');

	for (let depName in actual.dependencies) {
		const depVersion = actual.dependencies[depName];
		const rootDepVersion = rootPackageJSON.dependencies[depName];
		if (!rootDepVersion) {
			// missing in root is allowed
			continue;
		}
		if (depVersion !== rootDepVersion) {
			this.emit('error', `The dependency ${depName} in '${actualPath}' (${depVersion}) is different than in the root package.json (${rootDepVersion})`);
		}
	}
}

const checkPackageJSONTask = task.define('check-package-json', () => {
	return gulp.src('package.json')
		.pipe(es.through(function() {
			checkPackageJSON.call(this, 'remote/package.json');
			checkPackageJSON.call(this, 'remote/web/package.json');
		}));
});
gulp.task(checkPackageJSONTask);


function hygiene(some) {
	let errorCount = 0;

	const productJson = es.through(function (file) {
		// const product = JSON.parse(file.contents.toString('utf8'));

		// if (product.extensionsGallery) { // {{SQL CARBON EDIT}} @todo we need to research on what the point of this is
		// 	console.error('product.json: Contains "extensionsGallery"');
		// 	errorCount++;
		// }

		this.emit('data', file);
	});

	const indentation = es.through(function (file) {
		const lines = file.contents.toString('utf8').split(/\r\n|\r|\n/);
		file.__lines = lines;

		lines
			.forEach((line, i) => {
				if (/^\s*$/.test(line)) {
					// empty or whitespace lines are OK
				} else if (/^[\t]*[^\s]/.test(line)) {
					// good indent
				} else if (/^[\t]* \*/.test(line)) {
					// block comment using an extra space
				} else {
					console.error(file.relative + '(' + (i + 1) + ',1): Bad whitespace indentation');
					errorCount++;
				}
			});

		this.emit('data', file);
	});

	const copyrights = es.through(function (file) {

		const lines = file.__lines;
		for (let i = 0; i < copyrightHeaderLines.length; i++) {
			if (lines[i] !== copyrightHeaderLines[i]) {
				console.error(file.relative + ': Missing or bad copyright statement');
				errorCount++;
				break;
			}
		}

		this.emit('data', file);
	});

	const formatting = es.map(function (file, cb) {
		tsfmt.processString(file.path, file.contents.toString('utf8'), {
			verify: false,
			tsfmt: true,
			// verbose: true,
			// keep checkJS happy
			editorconfig: undefined,
			replace: undefined,
			tsconfig: undefined,
			tsconfigFile: undefined,
			tslint: undefined,
			tslintFile: undefined,
			tsfmtFile: undefined,
			vscode: undefined,
			vscodeFile: undefined
		}).then(result => {
			let original = result.src.replace(/\r\n/gm, '\n');
			let formatted = result.dest.replace(/\r\n/gm, '\n');

			if (original !== formatted) {
				console.error("File not formatted. Run the 'Format Document' command to fix it:", file.relative);
				errorCount++;
			}
			cb(null, file);

		}, err => {
			cb(err);
		});
	});

	const tslintConfiguration = tslint.Configuration.findConfiguration('tslint.json', '.');
	const tslintOptions = { fix: false, formatter: 'json' };
	const tsLinter = new tslint.Linter(tslintOptions);

	const tsl = es.through(function (file) {
		const contents = file.contents.toString('utf8');
		tsLinter.lint(file.relative, contents, tslintConfiguration.results);
		this.emit('data', file);
	});

	let input;

	if (Array.isArray(some) || typeof some === 'string' || !some) {
		input = vfs.src(some || all, { base: '.', follow: true, allowEmpty: true });
	} else {
		input = some;
	}

	const tslintSqlConfiguration = tslint.Configuration.findConfiguration('tslint-sql.json', '.');
	const tslintSqlOptions = { fix: false, formatter: 'json' };
	const sqlTsLinter = new tslint.Linter(tslintSqlOptions);

	const sqlTsl = es.through(function (file) { //TODO restore
		const contents = file.contents.toString('utf8');
		sqlTsLinter.lint(file.relative, contents, tslintSqlConfiguration.results);
	});

	const productJsonFilter = filter('product.json', { restore: true });

	const result = input
		.pipe(filter(f => !f.stat.isDirectory()))
		.pipe(productJsonFilter)
		.pipe(process.env['BUILD_SOURCEVERSION'] ? es.through() : productJson)
		.pipe(productJsonFilter.restore)
		.pipe(filter(indentationFilter))
		.pipe(indentation)
		.pipe(filter(copyrightFilter))
		.pipe(copyrights);

	let typescript = result
		.pipe(filter(tslintHygieneFilter))
		.pipe(formatting);

	if (!process.argv.some(arg => arg === '--skip-tslint')) {
		typescript = typescript.pipe(tsl);
		typescript = typescript
			.pipe(filter(sqlFilter))
			.pipe(sqlTsl); // {{SQL CARBON EDIT}}
	}

	const javascript = result
		.pipe(filter(eslintFilter))
		.pipe(gulpeslint('src/.eslintrc'))
		.pipe(gulpeslint.formatEach('compact'))
		.pipe(gulpeslint.failAfterError());

	let count = 0;
	return es.merge(typescript, javascript)
		.pipe(es.through(function (data) {
			count++;
			if (process.env['TRAVIS'] && count % 10 === 0) {
				process.stdout.write('.');
			}
			this.emit('data', data);
		}, function () {
			process.stdout.write('\n');

			const tslintResult = tsLinter.getResult();
			if (tslintResult.failures.length > 0) {
				for (const failure of tslintResult.failures) {
					const name = failure.getFileName();
					const position = failure.getStartPosition();
					const line = position.getLineAndCharacter().line;
					const character = position.getLineAndCharacter().character;

					console.error(`${name}:${line + 1}:${character + 1}:${failure.getFailure()}`);
				}
				errorCount += tslintResult.failures.length;
			}

			const sqlTslintResult = sqlTsLinter.getResult();
			if (sqlTslintResult.failures.length > 0) {
				for (const failure of sqlTslintResult.failures) {
					const name = failure.getFileName();
					const position = failure.getStartPosition();
					const line = position.getLineAndCharacter().line;
					const character = position.getLineAndCharacter().character;

					console.error(`${name}:${line + 1}:${character + 1}:${failure.getFailure()}`);
				}
				errorCount += sqlTslintResult.failures.length;
			}

			if (errorCount > 0) {
				this.emit('error', 'Hygiene failed with ' + errorCount + ' errors. Check \'build/gulpfile.hygiene.js\'.');
			} else {
				this.emit('end');
			}
		}));
}

function createGitIndexVinyls(paths) {
	const cp = require('child_process');
	const repositoryPath = process.cwd();

	const fns = paths.map(relativePath => () => new Promise((c, e) => {
		const fullPath = path.join(repositoryPath, relativePath);

		fs.stat(fullPath, (err, stat) => {
			if (err && err.code === 'ENOENT') { // ignore deletions
				return c(null);
			} else if (err) {
				return e(err);
			}

			cp.exec(`git show ":${relativePath}"`, { maxBuffer: 2000 * 1024, encoding: 'buffer' }, (err, out) => {
				if (err) {
					return e(err);
				}

				c(new VinylFile({
					path: fullPath,
					base: repositoryPath,
					contents: out,
					stat
				}));
			});
		});
	}));

	return pall(fns, { concurrency: 4 })
		.then(r => r.filter(p => !!p));
}

gulp.task('hygiene', task.series(checkPackageJSONTask, () => hygiene()));

// this allows us to run hygiene as a git pre-commit hook
if (require.main === module) {
	const cp = require('child_process');

	process.on('unhandledRejection', (reason, p) => {
		console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
		process.exit(1);
	});

	if (process.argv.length > 2) {
		hygiene(process.argv.slice(2)).on('error', err => {
			console.error();
			console.error(err);
			process.exit(1);
		});
	} else {
		cp.exec('git diff --cached --name-only', { maxBuffer: 2000 * 1024 }, (err, out) => {
			if (err) {
				console.error();
				console.error(err);
				process.exit(1);
				return;
			}

			const some = out
				.split(/\r?\n/)
				.filter(l => !!l);

			if (some.length > 0) {
				console.log('Reading git index versions...');

				createGitIndexVinyls(some)
					.then(vinyls => new Promise((c, e) => hygiene(es.readArray(vinyls))
						.on('end', () => c())
						.on('error', e)))
					.catch(err => {
						console.error();
						console.error(err);
						process.exit(1);
					});
			}
		});
	}
}
