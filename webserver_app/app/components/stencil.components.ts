import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';
import * as fs from 'fs-extra';

export const config: Config = {
    namespace: 'gc-components',
    srcDir: './prebuild/',
    excludeSrc: ['/test/', '**/.spec.'],
    plugins: [
        sass({
            injectGlobalPaths: [
                'node_modules/@ticom/ui-components/dist/collection/global/ticom-components.scss',
            ]
        }),
        {
            name: 'skipTiLibs',
            resolveId(id: string, importer?: string) {
                const pos = importer ? importer.indexOf('/prebuild/ti-') : -1;
                if (id.indexOf('/lib/') > 0 && pos > 0) {
                    return { id: id, external: true };
                }
                return null;
            }
        }
    ],
    outputTargets: [
        {
            type: 'stats',
            file: 'stencil-stats.json'
        },
        {
            type: 'dist',
            esmLoaderPath: '../loader',
            copy: [
                { src: 'global/*.scss' },
                { src: './font-roboto/*.*' },
                { src: './**/readme.md' },
                { src: './**/demo/*.*' },
                { src: './**/test/*.*' },
                { src: './assets/**/*.*' }
            ],
        },
        {
            type: 'docs-readme'
        },
        {
            type: 'www',
            dir: '@ti',
            serviceWorker: null, // disable service workers,
            copy: [
                { src: './**/readme.md' },
                { src: './font-roboto/*.*' },
                { src: './**/demo/*.*' },
                { src: './**/test/*.*' },
                { src: './assets/**/*.*' }
            ]
        }
    ],
    preamble: '© Copyright 2015-2020 Texas Instruments Incorporated. All rights reserved.',
};
