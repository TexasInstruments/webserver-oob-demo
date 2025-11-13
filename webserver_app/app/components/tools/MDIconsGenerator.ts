/* eslint-disable no-prototype-builtins */
/* eslint-disable no-console */

import yargs from 'yargs';
import fs from 'fs';
import path from 'path';

const argv = yargs(process.argv)
    .demand('s')
    .alias('s', 'srcdir')
    .describe('s', 'Icons src directory')
    .demand('d')
    .alias('d', 'destdir')
    .describe('d', 'Icons dest directory')
    .argv;

const content = {};

const srcDir = argv.srcdir;
const destDir = argv.destdir;
const categories = fs.readdirSync(srcDir);

categories.forEach(category => {
    const iconNames = fs.readdirSync(path.join(srcDir, category));
    iconNames.forEach(iconName => {

        const iconThemes = fs.readdirSync(path.join(srcDir, category, iconName));
        iconThemes.forEach(iconTheme => {
            let theme: undefined|string = undefined;
            switch (iconTheme) {
                case 'materialicons':
                    theme = 'filled'; break;
                case 'materialiconsoutlined':
                    theme = 'outlined'; break;
                case 'materialiconsround':
                    theme = 'round'; break;
                case 'materialiconssharp':
                    theme = 'sharp'; break;
                case 'materialiconstwotone':
                    theme = 'two-tone'; break;
            }
            if (theme === undefined) {
                console.error('Theme is undefined!');
                process.exit(-1);
            }
            content[theme] = content[theme] || {};
            content[theme][category] = content[theme][category] || {};

            try {
                content[theme][category][iconName] = fs.readFileSync(path.join(srcDir, category, iconName, iconTheme, '24px.svg'), 'utf-8');
            } catch (error) {
                console.error(error);
            }
        });
    });
});

for (const theme in content) {
    if (content.hasOwnProperty(theme)) {
        const dir = path.join(destDir, theme);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        /* append ti icon set to each themes */
        content[theme]['ti'] = content[theme]['ti'] || {};
        content[theme]['ti']['connected']           = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" /></svg>';
        content[theme]['ti']['disconnected']        = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 3.9,12 C 3.9,10.29 5.29,8.9 7,8.9 l 4,0 L 11,7 7,7 c -2.76,0 -5,2.24 -5,5 0,2.76 2.24,5 5,5 l 4,0 0,-1.9 -4,0 C 5.29,15.1 3.9,13.71 3.9,12 Z m 3.2792511,-5.502857 1.0276213,1.5349583 2.0062066,2.8292167 -2.4132107,0.01973 0.071865,1.951252 3.6389702,-0.03749 3.794813,5.918862 1.704633,-1.179251 -3.546797,-4.86925 2.112192,-0.01776 -0.192219,-1.880226 -2.90982,0.02762 L 9.0101525,5.2547574 Z M 17,7 l -4,0 0,1.9 4,0 c 1.71,0 3.1,1.39 3.1,3.1 0,1.71 -1.39,3.1 -3.1,3.1 l -4,0 L 13.06314,17 17,17 c 2.76,0 5,-2.24 5,-5 0,-2.76 -2.24,-5 -5,-5 z" /></svg>';
        content[theme]['ti']['no_connection']       = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 1.9,12 C 1.9,10.29 3.290139,8.9218015 5,8.9 L 7.9515501,8.8368655 6.8706034,7 5,7 c -2.76,0 -5,2.24 -5,5 0,2.76 2.2400952,4.977079 5,5 L 8.375,17.04464 7.2832213,15.1 5,15.1 C 3.29,15.1 1.9,13.71 1.9,12 Z M 17,7 13.54786,7.0631345 14.691942,8.9 17,8.9 c 1.71,0 3.1,1.39 3.1,3.1 0,1.71 -1.39,3.1 -3.1,3.1 L 14.205357,15.189286 15.36027,17 17,17 c 2.76,0 5,-2.24 5,-5 0,-2.76 -2.24,-5 -5,-5 z" /></svg>';
        content[theme]['ti']['connection_pending']  = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 1.9,12 C 1.9,10.29 3.290139,8.9218015 5,8.9 L 7.9515501,8.8368655 6.8706034,7 5,7 c -2.76,0 -5,2.24 -5,5 0,2.76 2.2400952,4.977079 5,5 L 8.375,17.04464 7.2832213,15.1 5,15.1 C 3.29,15.1 1.9,13.71 1.9,12 Z M 17,7 13.54786,7.0631345 14.691942,8.9 17,8.9 c 1.71,0 3.1,1.39 3.1,3.1 0,1.71 -1.39,3.1 -3.1,3.1 L 14.205357,15.189286 15.36027,17 17,17 c 2.76,0 5,-2.24 5,-5 0,-2.76 -2.24,-5 -5,-5 z"/><circle r="1" cy="12" cx="7" style="fill-opacity:1;fill-rule:nonzero;stroke:none;"/><circle r="1" cy="12" cx="11" style="fill-opacity:1;fill-rule:nonzero;stroke:none;"/><circle r="1" cy="12" cx="15" style="fill-opacity:1;fill-rule:nonzero;stroke:none;" /></svg>';

        for (const category in content[theme]) {
            if (content[theme].hasOwnProperty(category)) {
                const outfile = path.join(destDir, theme, `${category}.svg`);

                let fileContent = '';
                for (const svg in content[theme][category]) {
                    if (content[theme][category].hasOwnProperty(svg)) {
                        let symbol = content[theme][category][svg];
                        symbol = symbol.replace(/<svg xmlns(.*?)>/g, '');
                        symbol = symbol.replace(/<\/svg>$/g, '');
                        fileContent += `<symbol id="${svg}" viewBox="0 0 24 24">${symbol}</symbol>\n`;
                    }
                }

                fileContent = `<svg xmlns="http://www.w3.org/2000/svg">\n${fileContent}</svg>`;
                fs.writeFileSync(outfile, fileContent, { encoding: 'utf8', flag: 'w' });
            }
        }
    }
}