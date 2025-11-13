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
        })
    ],
    outputTargets: [
        {
            type: 'stats',
            file: 'stencil-stats.json'
        },
        {
            type: 'dist',
            esmLoaderPath: '../loader',
            copy: [{
                src: 'global/*.scss'
            }],
        },
        {
            type: 'docs-readme'
        },
        {
            type: 'www',
            serviceWorker: null // disable service workers
        }
    ],
    preamble: '© Copyright 2015-2020 Texas Instruments Incorporated. All rights reserved.',
};
