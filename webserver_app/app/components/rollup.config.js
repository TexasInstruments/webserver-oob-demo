import typescript from '@rollup/plugin-typescript';
import multiInput from 'rollup-plugin-multi-input';
import fs from 'fs';
import path from 'path';

// **********************************************************************************************
// common code shared between rollup.config.js and stencil.config.ts
// **********************************************************************************************
const throwError = (id, importer) => { throw Error(`Invalid import path detected, importing "${id}" from "${importer}" is not allow.`); };
const getModuleName = importer => importer ? importer.replace(/\\/g, '/').split('/').find(e => e.indexOf('gc-') !== -1) : '';
const getModuleRank = moduleName => {
    let rank = -1; // everything else has the lowest rank (-1)
    if (moduleName.indexOf('gc-widget-') !== -1) {
        rank = 0;
    } else if (moduleName.indexOf('gc-transport-') !== -1 || moduleName.indexOf('gc-model-') !== -1 || moduleName.indexOf('gc-codec-') !== -1) {
        rank = 1;
    } else if (moduleName.indexOf('gc-target-') !== -1) {
        rank = 2;
    } else if (moduleName.indexOf('gc-service-') !== -1) {
        rank = 3;
    } else if (moduleName.indexOf('gc-core-') !== -1) {
        rank = 4;
    }
    return rank;
};
const isRestrictedModule = moduleName => {
    if (!moduleName) return false;
    return getModuleRank(moduleName) >= 0;
};
const validatePaths = (id, importer) => {
    // prevent importing /lib/internal/
    if (id.indexOf('/lib/internal/') !== -1 && importer) {
        throwError(id, importer);
    }

    // If the importer is one of (gc-transport-,gc-model-,gc-codec-)=>gc-target-=>gc-service-=>gc-core-,
    // then the import must also be one of these, and it must be the same level or farther to the left.
    // So gc-core-* importer can only have gc-core-* imports
    if (importer) {
        const importerModuleName = getModuleName(importer);
        const importModuleName = getModuleName(id);
        if (isRestrictedModule(importerModuleName) && isRestrictedModule(importModuleName)) {
            if (getModuleRank(importerModuleName) > getModuleRank(importModuleName)) {
                throwError(id, importer);
            }
        }
    }
};
// **********************************************************************************************
// end common code
// **********************************************************************************************

const findModules = () => {
    const modules = [];
    const dirs = fs.readdirSync(path.join(__dirname, 'src'));
    dirs.forEach(dir => {
        const libDir = path.join(__dirname, `src/${dir}/lib`);
        if (fs.existsSync(libDir)) {
            const libs = fs.readdirSync(libDir);
            if (dir === 'gc-core-assets') {
                const index = libs.indexOf('NodeJSEnv.ts');
                if (index !== -1) {
                    libs.splice(index, 1);
                }
            }

            libs.forEach(lib => {
                const libPath = `./src/${dir}/lib/${lib}`;
                if (!libPath.endsWith('tsx') && fs.statSync(path.join(__dirname, libPath)).isFile()) {
                    modules.push(libPath);
                }
            });
        }
    });
    return modules;
};

console.log('Rollup all libs into bundles...');
export default {
    treeshake: false,
    input: findModules(),
    output: {
        format: 'es',
        dir: './@ti',
        sourcemap: true
    },
    plugins: [
        /**
         * note: plugin order is important, do not change the order below unless you know what you are doing.
         */

        /* externalize modules outside of current module */
        {
            'name': 'external-modules',
            resolveId: (id, importer) => {
                validatePaths(id, importer);

                // Mark /lib/ as external
                if (importer && id.match(/lib/)) {
                    return { id: id.replace(/^\s*(\.\.\/){2,}/, '../../'), external: true };

                } else if (importer && importer.replace(/\\/g, '/').indexOf('/internal/') < 0 && id.lastIndexOf('/') === 1 && id.indexOf('./') === 0) {
                    return { id : id, external: true};
                }

                return null;
            }
        },

        /* compile typescript file */
        typescript({ tsconfig: './tsconfig.ts.json' }),

        /* keep output relative */
        multiInput({ relative: 'src' }),
    ]
};