/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-input', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tiInput: WebElement;
    let htmlInput: WebElement;

    before(async () => {
        await goto('gc-widget-input/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        tiInput = await querySelector(shadowRoot, 'ti-input');
        htmlInput = await querySelector((await getShadowRoot(tiInput)), 'input');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('value'));
        await setElementProperty(input, 'value', 'default');

        input = await driver.findElement(By.id('placeholder'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('precision'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('format'));
        await setElementProperty(input, 'selectedLabel', 'text');

        input = await driver.findElement(By.id('intermediate_changes'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('select_on_focus'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('pattern'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('readonly'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('text_align'));
        await setElementProperty(input, 'selectedValue', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('format', async () => {
            let input = (await driver.findElement(By.id('format')));
            await setElementProperty(input, 'selectedLabel', 'hex');

            input = (await driver.findElement(By.id('value')));
            await setElementProperty(input, 'value', '42');

            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === '0x2A');
        });

        it('value', async () => {
            const input = (await driver.findElement(By.id('value')));
            await setElementProperty(input, 'value', 'foobar');

            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === 'foobar');
        });

        it('placeholder', async () => {
            let input = (await driver.findElement(By.id('value')));
            await setElementProperty(input, 'value', '');

            input = (await driver.findElement(By.id('placeholder')));
            await setElementProperty(input, 'value', 'Nothing here');

            input = await querySelector(await getShadowRoot(tiInput), 'input');
            await driver.wait(async () => await getElementProperty(tiInput, 'placeholder') === 'Nothing here');
        });

        it('precision', async () => {
            let input = (await driver.findElement(By.id('format')));
            await setElementProperty(input, 'selectedLabel', 'dec');

            input = (await driver.findElement(By.id('precision')));
            await setElementProperty(input, 'value', '2');

            input = (await driver.findElement(By.id('value')));
            await setElementProperty(input, 'value', '3.1415');

            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === '3.14');
        });

        it('pattern', async () => {
            const input = (await driver.findElement(By.id('pattern')));
            await setElementProperty(input, 'value', '[0-9]*');

            const valueInput = (await driver.findElement(By.id('value')));
            await setElementProperty(valueInput, 'value', '');

            await el.click();
            await htmlInput.sendKeys('hello world');
            // nothing
            await driver.wait(async () => await getElementProperty(valueInput, 'value') === '');
        });

        it('intermediate-changes', async () => {
            const input = (await driver.findElement(By.id('intermediate_changes')));
            await setElementProperty(input, 'checked', true);

            const valueInput = (await driver.findElement(By.id('value')));
            await setElementProperty(valueInput, 'value', '');

            await el.click();
            await htmlInput.sendKeys('hello world');

            await driver.wait(async () => await getElementProperty(valueInput, 'value') === 'hello world');
        });

        it('disabled', async () => {
            const input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => await tiInput.getCssValue('cursor') === 'not-allowed');
        });

        it('readonly', async () => {
            const input = (await driver.findElement(By.id('readonly')));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => await tiInput.getCssValue('pointer-events') === 'none');
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('disabled', async () => {
            const input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => (await htmlInput.getCssValue('background-color')).includes('229, 229, 229'));
            await driver.wait(async () => (await htmlInput.getCssValue('cursor')) === 'not-allowed');
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
        it('value-changed', done => {
            (async () => {
                await waitForElementEvent<{ value: boolean }>(el, 'value-changed', detail => {
                    let error = undefined;
                    try { expect(detail.value).eq('foobar'); }
                    catch (e) { error = e; };
                    done(error);
                });

                await setElementProperty(el, 'value', 'foobar');
            })();
        });
    });
});