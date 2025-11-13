import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';

const dev: boolean = process.argv && process.argv.indexOf('--dev') > -1;

// **********************************************************************************************
// common code shared between rollup.config.js and stencil.config.ts
// **********************************************************************************************
const throwError = (id, importer) => {
    throw Error(`Invalid import path detected, importing "${id}" from "${importer}" is not allow.`);
};
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

    if (id.indexOf('/lib/ActionRegistry') || id.indexOf('/lib/GcMessageDialog')) {
        return;  // make an exception for registering actions and message dialogs, so they can be called from any stencil component.
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

export const config: Config = {
    namespace: 'gc-components',
    srcDir: './prebuild/',
    excludeSrc: ['/test/', '**/.spec.'],
    plugins: [
        sass({
            injectGlobalPaths: [
                './ticom-ui-components/src/global/ticom-components.scss',
                './global/components.scss'
            ]
        }),
        {
            name: 'skipTiLibs',
            resolveId(id: string, importer?: string) {
                let pos = importer ? importer.indexOf('/prebuild/ti-') : -1;
                if (pos === -1) {
                    pos = importer ? importer.indexOf('/prebuild/gc-') : -1;
                }

                if (pos > 0) {
                    validatePaths(id, importer);

                    if ((id.indexOf('/lib/') > 0 || id.indexOf('/migration/') > 0)) {
                        if (id.indexOf('./lib/') === 0) {
                            pos = pos + '/prebuild/'.length;
                            const componentName = importer.substring(pos, importer.indexOf('/', pos));
                            id = id.substring('./'.length);
                            id = `../${componentName}/${id}`;
                        }
                        return { id: id, external: true };
                    }
                }

                return null;
            }
        }
    ],
    outputTargets: [
        {
            type: 'dist',
            esmLoaderPath: '../loader',
        },
        {
            type: 'www',
            dir: '@ti',
            serviceWorker: null, // disable service workers,
            copy: [
                { src: './**/*.md' },
                { src: './**/demo/**' },
                { src: './**/test/**' },
                { src: './assets/**' },
                { src: './**/migration/changelogs.md' }
            ]
        }
    ],
    bundles: [
        { // menu, toolbar, and statusbar
            components: [
                'gc-widget-menubar',
                'gc-widget-menuaction',
                'gc-widget-menuitem',
                'gc-widget-menuseparator',
                'gc-widget-context-menu',
                'gc-widget-statusbar',
                'gc-widget-statusitem-connections',
                'gc-widget-toolbar-action',
                'gc-widget-toolbar-separator',
                'gc-widget-toolbar'
            ]
        },
        { // image
            components: [
                'gc-widget-image',
                'gc-widget-multi-image'
            ]
        },
        { // instruments
            components: [
                'gc-widget-gauge',
                'gc-widget-meter'
            ]
        },
        { // input
            components: [
                'ti-input',

                'gc-widget-input',
                'gc-widget-input-filter',
                'gc-widget-listbox',
                'gc-widget-select',
                'gc-widget-slider',
                'gc-widget-spinner'
            ]
        },
        { // tab
            components: [
                'gc-widget-link-tab-panel',
                'gc-widget-tab-container',
                'gc-widget-tab-panel'
            ]
        },
        { // dialog
            components: [
                'gc-widget-dialog',
                'gc-widget-cloudagent-dialog',
                'gc-widget-message-dialog',
                'gc-widget-about-dialog',
                'gc-widget-port-selection-dialog'
            ]
        },
        { // common
            components: [
                'ti-button',
                'ti-checkbox',
                'ti-svg-icon',
                'ti-radio',
                'ti-radio-group',

                'gc-widget-button',
                'gc-widget-checkbox',
                'gc-widget-container',
                'gc-widget-icon',
                'gc-widget-label',
                'gc-widget-led',
                'gc-widget-markdown',
                'gc-widget-radio',
                'gc-widget-radio-group',
                'gc-widget-theme',
                'gc-widget-toggle-switch',
                'gc-widget-tooltip-shared',
                'gc-widget-tooltip',
            ]
        },
        { // grid
            components: [
                'gc-widget-grid',
                'gc-widget-grid-data-column',
                'gc-widget-grid-tree-column'
            ]
        },
        { // register view
            components: [
                'gc-widget-register-grid',
                'gc-widget-register-bits-column',
                'gc-widget-register-bitfield-viewer',
                'gc-widget-register-view'
            ]
        }
    ],
    hashFileNames: !dev,
    preamble: '© Copyright 2015-2021 Texas Instruments Incorporated. All rights reserved.',
};
