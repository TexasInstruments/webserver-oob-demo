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
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS'
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
import { processArgs } from './TestArgs';
import { Builder, WebElement, By } from 'selenium-webdriver';
import { GcConsole } from '../lib/GcConsole';
import os from 'os';
import path from 'path';

const browser = processArgs.browser || 'chrome';
const chromeDrv = processArgs.chromedrv || 'chrome_95.0.4638.69';
const baseurl = processArgs.baseurl || 'http://127.0.0.1:9002/v3/components/@ti/';
const console = new GcConsole('SeleniumDriver');

switch (browser) {
    case 'chrome': {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const chrome = require('selenium-webdriver/chrome');
        let driverPath = undefined;
        switch (os.platform()) {
            case 'linux':
                driverPath = path.join(__dirname, `../../../selenium_drivers/${chromeDrv}/chromedriver_linux64`);
                break;
            case 'darwin':
                driverPath = path.join(__dirname, `../../../selenium_drivers/${chromeDrv}/chromedriver_mac64`);
                break;
            default:
                driverPath = path.join(__dirname, `../../../selenium_drivers/${chromeDrv}/chromedriver.exe`);
        }
        const service = new chrome.ServiceBuilder(driverPath).build();
        chrome.setDefaultService(service);
        break;
    }
    default:
        console.error('Unsupported browser type.');
        process.exit(-1);
}

export const driver = new Builder().forBrowser(browser as string).build();
export const getActions = () => {
    return driver.actions({ bridge: true });
};

export const goto = async (path: string) => {
    return driver.get(`${baseurl}${path}`);
};

export const querySelector = async (element: WebElement|ShadowRoot, selector: string): Promise<WebElement> => {
    return await driver.wait(() => {
        return new Promise(resolve => {
            const handle = setInterval(async () => {
                const el = await driver.executeScript(`return arguments[0].querySelector('${selector}')`, element);
                if (el) {
                    clearInterval(handle);
                    resolve(el);
                }
            });
        });
    }) as WebElement;
};

export const querySelectorAll = async (element: WebElement|WebElement, selector: string): Promise<Array<WebElement>> => {
    return await driver.wait(() => {
        return new Promise(resolve => {
            const handle = setInterval(async () => {
                const els = await driver.executeScript(`return arguments[0].querySelectorAll('${selector}')`, element);
                if (els) {
                    clearInterval(handle);
                    resolve(els);
                }
            });
        });
    }) as Array<WebElement>;
};

export const documentQuerySelectorAll = async (selector: string): Promise<Array<WebElement>> => {
    return await driver.wait(() => {
        return new Promise(resolve => {
            const handle = setInterval(async () => {
                const els = await driver.executeScript(`return document.querySelectorAll('${selector}')`);
                if (els) {
                    clearInterval(handle);
                    resolve(els);
                }
            });
        });
    }) as Array<WebElement>;
};


export const getShadowRoot = async (element: WebElement): Promise<WebElement> => {
    return await driver.wait(() => {
        return new Promise(resolve => {
            const handle = setInterval(async () => {
                const root = await driver.executeScript('return arguments[0].shadowRoot', element);
                if (root) {
                    clearInterval(handle);
                    resolve(root);
                }
            }, 5);
        });
    }) as WebElement;
};

export const getElementProperty = async <T>(element: WebElement, property: string) => {
    return driver.executeScript<T>(`return arguments[0].${property}`, element);
};

export const setElementProperty = async (element: WebElement | string, property: string, value: string|number|boolean) => {
    let _value = value;
    if (typeof value === 'string') {
        _value = `"${value}"`;
    }
    if (typeof element === 'string') {
        element = await driver.findElement(By.id(element));
    }
    return driver.executeScript(`arguments[0].${property}=${_value}; return new Promise(r => requestAnimationFrame(() => r()));`, element);
};

/**
 * Wait for one or more successive animation frames as a way to delay until a stencil component has finished rendering.
 * If you are waiting for a guarantee that a nested component has property rendered, you should set count to the
 * depth of the nested component you are waiting on.
 *
 * Example:
 * ```
 *     button.click();
 *     await waitForNextAnimationFrame();
 * ```
 *
 * @param times the number of successive animation frames to wait for.  The default is 1.
 */
export const waitForNextAnimationFrame = async (times = 1) => {
    for (let i = 0; i < times; i++) {
        await driver.executeScript('return new Promise(r => requestAnimationFrame(() => r()));');
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const invokeElementMethod = async (element: WebElement, method: string, ...args: any): Promise<unknown> => {
    const _args = [];
    for (let i = 1; i <= args.length; ++i) {
        _args.push(`arguments[${i}]`);
    }
    return driver.executeScript(`return arguments[0].${method}(${_args.join(',')})`, element, ...args);
};

/**
 * Wait for the element to fire an event. This function creates a div in the browser as a way to communicate between the
 * browser process and the selenium node process. The div will store the event detail using JSON string and the Selenium
 * process will wait until the div is not empty. The event detail will be pass to the callback function.
 *
 * Example:
 * ```
 *     const button = driver.findElement(By.id('my-button'));
 *     await waitForElementEvent(button, 'click', detail => {
 *         done();
 *     });
 *     button.click();
 * ```
 *
 * @param element the element
 * @param eventName the name of the event
 * @param callback the callback function, argument contains the event detail object
 */
export const waitForElementEvent = async<T> (element: WebElement, eventName: string, callback: (detail: T) => void) => {
    const id = `${(+new Date).toString(36)}`;

    return driver.executeAsyncScript(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const [ id, element, eventName, cb ] = arguments;
        const div = document.createElement('div');
        div.setAttribute('id', id);
        div.setAttribute('hidden', '');
        document.body.appendChild(div);

        element.addEventListener(eventName, function handler(event: CustomEvent) {
            element.removeEventListener(eventName, handler);
            div.innerText = JSON.stringify(event.detail, null, 4);
        });

        cb();
    }, id, element, eventName).then(async () => {
        driver.wait(async () => {
            try {
                const text = await getElementProperty(await driver.findElement(By.id(id)), 'textContent') as string;
                if (text.length > 0) {
                    callback(JSON.parse(text));
                    return true;
                }
            } catch (e) {
                // do nothing
            }
            return false;
        });
    });
};

/**
 * Creates and add an element to the document body.
 *
 * Example:
 * ```
 *      createElement('gc-widget-select', 'labels=one,two,three', 'selected-label=two')
 * ```
 *
 * @param tagname the element tagname
 * @param attributes the attributes key=value pair
 * @returns the newly created element
 */
export const createElement = async (tagname: string, ...attributes: string[]) => {
    let script = `const el = document.createElement("${tagname}");\n`;
    attributes.forEach(attr => {
        const [name, value] = attr.split('=');
        script += `el.setAttribute("${name}", "${value}");\n`;
    });
    script += 'document.body.appendChild(el);\n';
    script += 'return el;';

    return await driver.executeScript<WebElement>(script).then(async el => {
        await driver.sleep(100); // TODO: give the component some time to be instantiated and initialized, is there a better way???
        return el;
    });
};

/**
 * Creates and add a script to the document body.
 *
 * @param text the script text
 */
export const createScript = async (text: string) => {
    const script = `
        const el = document.createElement("script");
        el.text='${text}';
        document.body.appendChild(el);
        return el;
    `;
    return await driver.executeScript(script);
};

/**
 * Helper method to find all elements, then filter by only those visible.
 *
 * Example:
 * ```
 *      expect(await findVisibleElements(By.className('myclass'))).to.not.be.empty;
 * ```
 *
 * @param element the parent element to search for nested children matching the locator
 * @param locator the mechanism for locating elements
 * @returns array of visible elements that were found, or an empty array if no elements match the locator.
 */
export async function findVisibleElements(element: WebElement, locator: By): Promise<Array<WebElement>> {
    const results = await element.findElements(locator);
    const isVisible = await Promise.all(results.map( element => element.isDisplayed() ));
    return results.filter( (_, i) => isVisible[i] );
}
