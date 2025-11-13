/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By, Key } from 'selenium-webdriver';
import { expect } from 'chai';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, querySelectorAll, waitForElementEvent } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-spinner', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tiInput: WebElement;
    let htmlInput: WebElement;

    before(async () => {
        await goto('gc-widget-spinner/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        const innerShadowRoot = await getShadowRoot(await querySelector(shadowRoot, 'gc-widget-input'));
        tiInput = await querySelector(innerShadowRoot, 'ti-input');
        htmlInput = await querySelector((await getShadowRoot(tiInput)), 'input');
    });

    beforeEach(async () => {
        let input = (await driver.findElement(By.id('value')));
        await setElementProperty(input, 'value', 42);

        input = (await driver.findElement(By.id('format')));
        await setElementProperty(input, 'selectedLabel', 'dec');

        input = (await driver.findElement(By.id('increment')));
        await setElementProperty(input, 'value', 1);

        input = (await driver.findElement(By.id('precision')));
        await setElementProperty(input, 'value', 0);

        input = (await driver.findElement(By.id('min_value')));
        await setElementProperty(input, 'value', -100);

        input = (await driver.findElement(By.id('max_value')));
        await setElementProperty(input, 'value', 100);

        input = (await driver.findElement(By.id('intermediate_changes')));
        await setElementProperty(input, 'checked', false);

        input = (await driver.findElement(By.id('disabled')));
        await setElementProperty(input, 'checked', false);

        input = (await driver.findElement(By.id('readonly')));
        await setElementProperty(input, 'checked', false);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('value', async () => {
            const input = (await driver.findElement(By.id('value')));
            await setElementProperty(input, 'value', 42);

            await driver.wait(async () => await getElementProperty(el, 'value') === 42);
        });

        it('format', async () => {
            const input = (await driver.findElement(By.id('format')));

            /* binary */
            await setElementProperty(input, 'selectedLabel', 'binary');
            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === '101010');

            /* dec */
            await setElementProperty(input, 'selectedLabel', 'dec');
            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === '42');

            /* exp */
            await setElementProperty(input, 'selectedLabel', 'exp');
            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === '4e+1');

            /* hex */
            await setElementProperty(input, 'selectedLabel', 'hex');
            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === '0x2A');

            /* Q-value */
            await setElementProperty(input, 'selectedLabel', 'q');
            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === '42');
        });

        it('increment', async () => {
            const input = (await driver.findElement(By.id('increment')));
            await setElementProperty(input, 'value', '3');

            const [up] = await querySelectorAll(shadowRoot, 'div[id="arrow-icon-wrapper"] > gc-widget-icon');
            await up.click();
            await driver.wait(async () => await getElementProperty(el, 'value') === 45);
        });

        it('precision', async () => {
            const input = (await driver.findElement(By.id('precision')));
            await setElementProperty(input, 'value', '2');
            await setElementProperty(el, 'value', 42.1234);

            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === '42.12');
        });

        it('min', async () => {
            const input = (await driver.findElement(By.id('min_value')));
            await setElementProperty(input, 'value', '-42');
            await setElementProperty(el, 'value', -43);

            await driver.wait(async () => await getElementProperty(el, 'value') === -42);
        });

        it('max', async () => {
            const input = (await driver.findElement(By.id('max_value')));
            await setElementProperty(input, 'value', '42');
            await setElementProperty(el, 'value', 43);

            await driver.wait(async () => await getElementProperty(el, 'value') === 42);
        });

        it('intermediate-changes', async () => {
            try {
                const input = (await driver.findElement(By.id('intermediate_changes')));
                await setElementProperty(input, 'checked', true);

                const valueInput = (await driver.findElement(By.id('value')));
                await setElementProperty(valueInput, 'value', 0);

                await el.click();
                await htmlInput.sendKeys('24');

                await driver.wait(async () => await getElementProperty(valueInput, 'value') === 24);
            } finally {
                await htmlInput.sendKeys(Key.RETURN);
            }
        });

        it('disabled', async () => {
            const input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            const [up] = await querySelectorAll(shadowRoot, 'div[id="arrow-icon-wrapper"] > gc-widget-icon');
            await up.click();

            const value = await getElementProperty(el, 'value');
            expect(value).eq(42);
        });

        it('readonly', async () => {
            const input = (await driver.findElement(By.id('readonly')));
            await setElementProperty(input, 'checked', true);

            const [up] = await querySelectorAll(shadowRoot, 'div[id="arrow-icon-wrapper"] > gc-widget-icon');
            try {
                await up.click();
                expect.fail('Click should throw an exception.');
            } catch (e) {
                // passed
            }
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('disabled', async () => {
            const input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            const widgetInput = await querySelector(shadowRoot, 'gc-widget-input');
            const background = await widgetInput.getCssValue('background');
            expect(background).contain('rgb(229, 229, 229)');

            await driver.wait(async () => await widgetInput.getCssValue('cursor') === 'not-allowed');
        });

        it('--gc-text-align', async () => {
            const input = (await driver.findElement(By.id('text_align')));
            await setElementProperty(input, 'selectedLabel', 'center');

            const htmlInput = await querySelector(await getShadowRoot(tiInput), 'input');

            await driver.wait(async () => (await htmlInput.getCssValue('text-align')) === 'center');
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
        it('value-changed', done  => {
            (async () => {
                await waitForElementEvent<{value: number}>(el, 'value-changed', detail => {
                    let error = undefined;
                    try { expect(detail.value).eq(24); }
                    catch (e) { error = e; };
                    done(error);
                });

                await setElementProperty(el, 'value', 24);
            })();
        });
    });
});