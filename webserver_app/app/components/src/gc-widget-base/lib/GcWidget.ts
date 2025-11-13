/**
 *  Copyright (c) 2020, 2021 Texas Instruments Incorporated
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
 *
 */

/**
 * `GcWidget` utility functions to query select element(s) and wait for the custom
 * element to be defined. Use these helpers to query GUI Composer element(s) only.
 * Use the browser's native querySelector functions to query other element(s).
 *
 * @example
 * ```typescript
 * import { GcWidget } from '<path-to>/gc-widget-base/lib/GcWidget';
 *
 * const domReady = async () => {
 *     const menubar = await GcWidget.querySelector('gc-widget-menubar');
 *     const button = await GcWidget.querySelector('#my-button-id');
 * };
 * document.readyState === 'complete' ?
 *   domReady() : document.addEventListener('DOMContentLoaded', domReady);
 * ```
 *
 * @packageDocumentation
 */
export class GcWidget {
    /**
     * * Returns the first element that matches the selectors in the document.
     *
     * @param selectors the CSS selector string
     */
    public static async querySelector<E extends Element = Element>(selectors: string): Promise<E | null> {
        const element = document.querySelector(selectors);
        if (element) {
            await customElements.whenDefined(element.tagName.toLowerCase());
            return element as E;
        } else {
            return null;
        }
    }

    /**
     * Returns all element that match the selectors in the document.
     *
     * @param selectors the CSS selector string
     */
    public static async querySelectorAll<E extends Element = Element>(selectors: string): Promise<NodeListOf<E>> {
        const elements = document.querySelectorAll(selectors);
        const definedPromises: Array<Promise<void>> = [];
        elements.forEach(element => definedPromises.push(customElements.whenDefined(element.tagName.toLowerCase())));
        await Promise.all(definedPromises);
        return elements as NodeListOf<E>;
    }
}