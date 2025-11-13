/**
 *  Copyright (c) 2019, 2021 Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  *   Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *  *   Neither the name of Texas Instruments Incorporated nor the names of
 *  its contributors may be used to endorse or promote products derived
 *  from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import '../gc-core-assets/lib/GcFiles';
import '../gc-core-assets/lib/GcConsole';
import '../gc-core-assets/lib/GcLocalStorage';
import { getAssetPath } from '@stencil/core';

/* Load font roboto */
const fontPath = getAssetPath('../assets/fonts/font-roboto');
const fontStyle = document.createElement('style');
fontStyle.innerHTML = `
    @font-face {
        font-family: 'Roboto';
        font-style: normal;
        font-weight: 300;
        src: local('Roboto Light'), local('Roboto-Light'), url(${fontPath}/Roboto_300_normal.woff) format('woff');
    }
    @font-face {
        font-family: 'Roboto';
        font-style: normal;
        font-weight: 400;
        src: local('Roboto'), local('Roboto-Regular'), url(${fontPath}/Roboto_400_normal.woff) format('woff');
    }
    @font-face {
        font-family: 'Roboto';
        font-style: normal;
        font-weight: 500;
        src: local('Roboto Medium'), local('Roboto-Medium'), url(${fontPath}/Roboto_500_normal.woff) format('woff');
    }
    @font-face {
        font-family: 'Roboto';
        font-style: normal;
        font-weight: 700;
        src: local('Roboto Bold'), local('Roboto-Bold'), url(${fontPath}/Roboto_700_normal.woff) format('woff');
    }
    @font-face {
        font-family: 'Roboto';
        font-style: italic;
        font-weight: 300;
        src: local('Roboto Light Italic'), local('Roboto-LightItalic'), url(${fontPath}/Roboto_300_italic.woff) format('woff');
    }
    @font-face {
        font-family: 'Roboto';
        font-style: italic;
        font-weight: 400;
        src: local('Roboto Italic'), local('Roboto-Italic'), url(${fontPath}/Roboto_400_italic.woff) format('woff');
    }
    @font-face {
        font-family: 'Roboto';
        font-style: italic;
        font-weight: 500;
        src: local('Roboto Medium Italic'), local('Roboto-MediumItalic'), url(${fontPath}/Roboto_500_italic.woff) format('woff');
    }
    @font-face {
        font-family: 'Roboto';
        font-style: italic;
        font-weight: 700;
        src: local('Roboto Bold Italic'), local('Roboto-BoldItalic'), url(${fontPath}/Roboto_700_italic.woff) format('woff');
    }
`;
document.head.appendChild(fontStyle);

/* Add Powered By GUI Composer watermark */
if (!GcUtils.isInDesigner) {
    let statusbar = undefined;
    const poweredByStyle = document.createElement('style');
    const poweredBy = document.createElement('span');
    poweredBy.setAttribute('id', 'powered-by-gc');
    poweredByStyle.innerHTML = `
        #powered-by-gc {
            font-family: "Roboto", "Open Sans", "Segoe UI", Tahoma, sans-serif;
            font-style: italic;
            font-size: 10px;
            position: absolute;
            z-index: 9699;
            cursor: pointer;
            color: #a0a0a04f;
            padding: 2px 5px;
            border-radius: 5px;
        }
    `;
    document.head.appendChild(poweredByStyle);
    poweredBy.innerHTML = 'Powered By GUI Composer&trade;';
    document.body.appendChild(poweredBy);

    // @ts-ignore
    const nwShell = typeof nw !== 'undefined' && typeof nw.Shell !== 'undefined' ? nw.Shell : null;
    poweredBy.addEventListener('click', () => nwShell ? nwShell.openExternal('https://dev.ti.com/gc') : window.open('https://dev.ti.com/gc', '_default'));

    const box = document.querySelector<HTMLElement>('#viewport') || document.body;
    const updateStyles = () => {
        const scrollbarHeight = box.offsetHeight-box.clientHeight;
        const scrollbarWidth = box.offsetWidth-box.clientWidth;
        poweredBy.style.bottom = ((statusbar ? statusbar.clientHeight + scrollbarHeight : scrollbarHeight) + 2) + 'px';
        poweredBy.style.right = (scrollbarWidth + 2) + 'px';
    };
    window.addEventListener('gc-widget-statusbar-loaded', (e: CustomEvent) => {
        statusbar = e.detail;
        updateStyles();
    });
    new ResizeObserver(() => updateStyles()).observe(box);
}

/**
 * Shutdown the local webserver and quit nwjs process when the root window is closed.
 */
if (GcUtils.isNW) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const win = require('nw.gui').Window.get();
    win.on('close', async () => {
        if (!GcUtils.isInPreview && !!win.window.document.querySelector('meta[name="root-win"]')) {
            await fetch('/api/shutdown');
            window.nw.App.quit();
        } else {
            win.close(true);
        }
    });
}