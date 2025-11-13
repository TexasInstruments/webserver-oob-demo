const { series, src, dest } = require('gulp');  // series = ability to run tasks one after another, parallel = ability to run in parallel
const del = require('del');
const fs = require('fs');
const path = require('path');
const cmd = require('node-cmd');
const argv = require('yargs').argv;

const production = argv.prod;

// src is the directory that the TI source code is in (saved to git)
const srcDir = 'src'

// prebuild is the directory that stencil compiles from (not saved to git)
const prebuildDir = 'prebuild';
const prebuildFolder = `./${prebuildDir}/`;

// the dist folder is the output folder for the stencil build process for distribution
const outputDir = 'dist';
const docFolder = 'docs';
const outputFolder = `./${outputDir}/`;
const outputCompsDir = `${outputDir}/collection`;
const outputCompsFolder = outputFolder + 'collection/';
const outputGc3CompsDir = `${outputDir}/gc-components`;

// the @ti folder is the output folder for TI web components and associated files
const tiDir = '@ti';
const tiBuildDir = `${tiDir}/build`;
const tiFolder = `./${tiDir}/`;
const tiBuildFolder = tiFolder + 'build/';
const ticomuiDir = 'ticom-ui-components';
const ticomuiFolder = `./${ticomuiDir}/`;

function defaultTask(done) {
    console.log('Available tasks:\n');
    let proc = cmd.run('gulp -T');
    proc.stdout.on('data', function (data) {
        process.stdout.write(data);
    });
    proc.stderr.on('data', function (data) {
        process.stderr.write(data);
    });
    proc.addListener('close', (exitCode) => {
        done(exitCode);
    });
    proc.addListener('exit', (exitCode) => {
        done(exitCode);
    });
}

async function clean(done) {
    try {
        await del([tiFolder]);
        await del([prebuildFolder]);
        await del([outputFolder]);
        await del([docFolder]);
    } catch (ex) {
        console.error(`clean folder error: ${ex}`);
        console.error('Please make sure no files are open in that directory.')
    }
    done();
}

function sourcemaps_ti(done) {
    cmd.get(
        `node node_modules/sourcemap-tool/sourcemap-tool -t ${srcDir} -s ${outputCompsDir} -d ${tiDir} `,
        function (err, data, stderr) {
            if (!err) {
                console.log('sourcemaps_ti started:\n\n', data);
                done();
            } else {
                console.log('sourcemaps_ti error', err);
                done(err)
            }
        }
    )
}

function sourcemaps_build(done) {
    cmd.get(
        `node node_modules/sourcemap-tool/sourcemap-tool -t ${srcDir} -s ${outputGc3CompsDir} -d ${tiBuildDir} -f`,
        function (err, data, stderr) {
            if (!err) {
                console.log('sourcemaps_build started:\n\n', data);
                done();
            } else {
                console.log('sourcemap_build error', err);
                done(err)
            }
        }
    )
}

function waitForDir(dirPath, done) {
    if (!fs.existsSync(dirPath)) {
        setTimeout(waitForDir.bind(this, dirPath, done), 1000);
    } else {
        done();
    }
}

function waitForBuildDir(done) {
    waitForDir(tiBuildFolder, done);
}

function sourcemapsWatch(done) {
    let proc = cmd.run(`node node_modules/sourcemap-tool/sourcemap-tool -t ${srcDir} -c ${tiDir} -s ${outputGc3CompsDir} -d ${tiBuildDir} -f -w`);
    proc.stdout.on('data', function (data) {
        process.stdout.write(data);
    });
    proc.stderr.on('data', function (data) {
        process.stderr.write(data);
    });
    proc.addListener('close', (exitCode) => {
        console.log(`sourcemapsWatch.close: ${exitCode}`);
        done(exitCode);
    });
    proc.addListener('exit', (exitCode) => {
        console.log(`sourcemapsWatch.exit: ${exitCode}`);
        done(exitCode);
    });
}

function sourcemapsTiWatch(done) {
    let proc = cmd.run(`node node_modules/sourcemap-tool/sourcemap-tool -t ${srcDir} -s ${outputCompsDir} -d ${tiDir} -r -w`);
    proc.stdout.on('data', function (data) {
        process.stdout.write(data);
    });
    proc.stderr.on('data', function (data) {
        process.stderr.write(data);
    });
    proc.addListener('close', (exitCode) => {
        console.log(`sourcemapsWatch.close: ${exitCode}`);
        done(exitCode);
    });
    proc.addListener('exit', (exitCode) => {
        console.log(`sourcemapsTiWatch.exit: ${exitCode}`);
        done(exitCode);
    });
}

// mixall makes all changes in-place in the srcCompsDir.
function mixall(done) {
    cmd.get(
        `node node_modules/mixin-tool/mixin-tool -s ${srcDir} -t ${tiDir}`,
        function (err, data, stderr) {
            if (!err) {
                console.log('mixin started (inplace):\n\n', data);
                done();
            } else {
                console.log('mixin error', err);
                done(err)
            }
        }
    )
}

// mixWatch does NOT work in place - it copies from src to src1
function mixWatch(done) {
    let proc = cmd.run(`node node_modules/mixin-tool/mixin-tool -w -s ${srcDir} -d ${prebuildDir}`);
    proc.stdout.on('data', function (data) {
        process.stdout.write(data);
    });
    proc.stderr.on('data', function (data) {
        process.stderr.write(data);
    });
    proc.addListener('close', (exitCode) => {
        done(exitCode);
    });
    proc.addListener('exit', (exitCode) => {
        done(exitCode);
    });
}

function stencilBuild(done) {
    try {
        let proc = cmd.run(`npx stencil build ${production ? '--prod' : '--dev'} --docs-json ./${tiFolder}/stencil-docs.json`);
        proc.stdout.on('data', function (data) {
            process.stdout.write(data);
        });
        proc.stderr.on('data', function (data) {
            process.stderr.write(data);
        });
        proc.addListener('close', (exitCode) => {
            done(exitCode);
        });
        proc.addListener('exit', (exitCode) => {
            done(exitCode);
        });
    } catch (ex) {
        console.log('stencilBuild: exception ex=' + ex);
        done();
    }
}

function stencilBuildWatch(done) {
    try {
        let tsBuildRan = false;
        let proc = cmd.run(`npx stencil build --dev --watch --max-workers 4 --docs-json ./${tiFolder}/stencil-docs.json`);
        proc.stdout.on('data', function (data) {
            process.stdout.write(data);

            /* wait for stencil to finished building and start all watch tasks */
            if (!tsBuildRan && data.indexOf('build finished') !== -1) {
                tsBuildRan = true;
                genMetadata(() => {});
                buildTsWatch(() => {});
                sourcemapsTiWatch(() => {});
                sourcemapsWatch(() => {});
                mixWatch(() => {});
            }
        });
        proc.stderr.on('data', function (data) {
            process.stderr.write(data);
        });
        proc.addListener('close', (exitCode) => {
            done(exitCode);
        });
        proc.addListener('exit', (exitCode) => {
            done(exitCode);
        });
    } catch (ex) {
        console.log('stencilBuildWatch: exception ex=' + ex);
        done();
    }
}

function createTiDir(done) {
    try {
        if (!fs.existsSync('@ti')) {
            fs.mkdirSync('@ti', 0o777);
        }
    } catch (ex) {
        console.log(`Exception creating @ti dir: ${ex}`)
    }
    done();
}

function copyDirTask(srcDir, destDir) {
    return new Promise((resolve, reject) => {
        src([`${srcDir}/**/*.*`], { base: `${srcDir}` }).pipe(dest(`./${destDir}/`)).on('finish', resolve).on('error', reject);
    });
}

function copyAssets(done) {
    try {
        if (!fs.existsSync(prebuildFolder)) {
            fs.mkdirSync(prebuildFolder, 0o777);
        }
        const assetsPath = path.join(prebuildFolder, 'assets');
        copyDirTask('assets', assetsPath).finally(() => {
            if (!fs.existsSync(assetsPath)) {
                fs.mkdirSync(assetsPath, 0o777);
            }
            fs.copyFileSync('index.html', prebuildFolder + 'index.html');
            fs.copyFileSync('index.ts', prebuildFolder + 'index.ts');
            done();
        });


    } catch (ex) {
        console.error('CopyAssets exception: ex=' + ex);
        done();
    }
    //stencil.config.ts will take care of copying the assets folder from here
}

async function doBuildTs(done, watch) {
    try {
         let proc = argv.prod ?
            cmd.run(`npx rollup -c rollup.config.js`) :
            cmd.run(`npx tsc -p tsconfig.ts.json ${watch ? '-w' : ''}`);

        proc.stdout.on('data', function (data) {
            process.stdout.write(data);
        });
        proc.stderr.on('data', function (data) {
            process.stderr.write(data);
        });
        proc.addListener('close', (exitCode) => {
            done(exitCode);
        });
        proc.addListener('exit', (exitCode) => {
            done(exitCode);
        });
    } catch (ex) {
        console.log('buildTs: exception ex=' + ex);
        done();
    }
}

/**
 * buildTs is used to generate sourcemaps for the lib/*.ts and test/*.ts files as the
 * stencil compiler does not do this
 */
function buildTs(done) {
   doBuildTs(done);
}

/**
 * buildTsWatch is a watch-mode version of buildTs.
 * It is used to generate sourcemaps for the lib/*.ts and test/*.ts files as the
 * stencil compiler does not do this
 */
function buildTsWatch(done) {
    doBuildTs(done, true);
}

function buildTicom(done) {
    try {
        let proc = cmd.run(`cd ${ticomuiFolder} && npx stencil build --docs --prod`);
        proc.stdout.on('data', function (data) {
            process.stdout.write(data);
        });
        proc.stderr.on('data', function (data) {
            process.stderr.write(data);
        });
        proc.addListener('close', (exitCode) => {
            done(exitCode);
        });
        proc.addListener('exit', (exitCode) => {
            done(exitCode);
        });
    } catch (ex) {
        console.log(`buildTicomui: exception ex=${ex}`);
        done();
    }
}

function publishUsageFiles(done) {
    // copy usage.md to @ti
    src([`${prebuildFolder}/**/usage.md`], { base: `${prebuildFolder}` }).pipe(dest(`./${tiFolder}/`));
    done();
}

function genMetadata(done) {
    try {
        copyDirTask(outputCompsFolder, tiFolder).finally(() => {

            let proc = cmd.run('npx ts-node --script-mode tools/Analyzer.ts');
            proc.stdout.on('data', function (data) {
                process.stdout.write(data);
            });
            proc.stderr.on('data', function (data) {
                process.stderr.write(data);
            });
            proc.addListener('close', (exitCode) => {
                done(exitCode);
            });
            proc.addListener('exit', (exitCode) => {
                done(exitCode);
            });
        })
    } catch (ex) {
        console.log('genMetadata: exception ex=' + ex);
        done();
    }

}

function createPackageLock(done) {
    cmd.get(
        'npm i --package-lock-only',
        function (err, data, stderr) {
            done(err);
        }
    )
}

function removePackageLock(done) {
    del(['package-lock.json']);
    done();
}

function uninstallMixinTool(done) {
    if (fs.existsSync('node_modules/mixin-tool')) {
        cmd.get(
            'npm remove mixin-tool --save-dev',
            function (err, data, stderr) {
                done(err);
            }
        )
    } else {
        done();
    }
}

function uninstallSourcemapTool(done) {
    if (fs.existsSync('node_modules/sourcemap-tool')) {
        cmd.get(
            'npm remove sourcemap-tool --save-dev',
            function (err, data, stderr) {
                done(err);
            }
        )
    } else {
        done();
    }
}

function installMixinTool(done) {
    cmd.get(
        `npm install --save-dev "git+ssh://git@bitbucket.itg.ti.com/gc/mixin-tool.git#dev"`,
        function (err, data, stderr) {
            let errCode = undefined;
            if (err) {
                console.error("\n\nnpm requires a git client to be installed in order to install from a git repo.  Try again using the git bash shell.\n\n!!!!!!!!!!!!!!!")
                errCode = -1;
            }
            done(errCode)
        }
    )
}

function installSourcemapTool(done) {
    cmd.get(
        `npm install --save-dev "git+ssh://git@bitbucket.itg.ti.com/gc/sourcemap-tool.git#dev"`,
        function (err, data, stderr) {
            let errCode = undefined;
            if (err) {
                console.error("\n\nnpm requires a git client to be installed in order to install from a git repo.  Try again using the git bash shell.\n\n!!!!!!!!!!!!!!!")
                errCode = -1;
            }
            done(errCode)
        }
    )
}

exports.updateTools = series(
    removePackageLock,
    uninstallMixinTool,
    uninstallSourcemapTool,
    installSourcemapTool,
    installMixinTool,
    createPackageLock
);

exports.build = series(
    createTiDir,
    copyAssets,
    mixall,
    stencilBuild,
    publishUsageFiles,
    sourcemaps_ti,
    genMetadata,
    sourcemaps_build,
    buildTs
);

exports.buildWatch = series(
    createTiDir,
    copyAssets,
    mixall,
    stencilBuildWatch,
);

exports.genMetadata = genMetadata;
exports.clean = clean;
exports.buildTicom = buildTicom;
exports.default = defaultTask;
