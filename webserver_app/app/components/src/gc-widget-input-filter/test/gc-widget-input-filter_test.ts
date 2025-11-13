/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-input-filter', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tiInput: WebElement;
    let htmlInput: WebElement;

    before(async () => {
        await goto('gc-widget-input-filter/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        tiInput = await querySelector(await getShadowRoot(await querySelector(shadowRoot, 'gc-widget-input')), 'ti-input');

        const root = await getShadowRoot(tiInput);
        htmlInput = await querySelector(root, 'input');
    });

    beforeEach(async () => {
        let input = (await driver.findElement(By.id('value')));
        await setElementProperty(input, 'value', '');

        input = (await driver.findElement(By.id('placeholder')));
        await setElementProperty(input, 'value', 'Enter filter text here');

        input = (await driver.findElement(By.id('select_on_focus')));
        await setElementProperty(input, 'checked', true);

        input = (await driver.findElement(By.id('has_clear_icon')));
        await setElementProperty(input, 'checked', true);

        input = (await driver.findElement(By.id('has_search_icon')));
        await setElementProperty(input, 'checked', true);

        input = (await driver.findElement(By.id('intermediate_changes')));
        await setElementProperty(input, 'checked', true);

        input = (await driver.findElement(By.id('disabled')));
        await setElementProperty(input, 'checked', false);

        input = (await driver.findElement(By.id('readonly')));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('text_align'));
        await setElementProperty(input, 'selectedValue', '');

        input = await driver.findElement(By.id('pattern'));
        await setElementProperty(input, 'value', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('value', async () => {
            const input = (await driver.findElement(By.id('value')));
            await setElementProperty(input, 'value', 'th');

            await driver.wait(async () => await getElementProperty(el, 'value') === 'th');
            await driver.wait(async () => (await driver.findElements(By.css('#content > div:not([hidden])')))?.length === 3);
        });

        it('placeholder', async () => {
            let input = (await driver.findElement(By.id('value')));
            await setElementProperty(input, 'value', '');

            input = (await driver.findElement(By.id('placeholder')));
            await setElementProperty(input, 'value', 'Nothing here');

            input = await querySelector(await getShadowRoot(tiInput), 'input');
            await driver.wait(async () => await getElementProperty(input, 'placeholder') === 'Nothing here');
        });

        it('has-clear-icon', async () => {
            const input = (await driver.findElement(By.id('has_clear_icon')));
            await setElementProperty(input, 'checked', true);

            const icon = shadowRoot.findElement(By.id('clear'));
            expect(await getElementProperty(icon, 'icon')).eq('content:delete_sweep');

            await setElementProperty(input, 'checked', false);
            expect(shadowRoot.findElements(By.css('gc-widget-icon'))).to.be.empty;
        });

        it('has-search-icon', async () => {
            const input = (await driver.findElement(By.id('has_search_icon')));
            await setElementProperty(input, 'checked', true);

            const icon = shadowRoot.findElement(By.id('search'));
            expect(await getElementProperty(icon, 'icon')).eq('action:search');

            await setElementProperty(input, 'checked', false);
            expect(shadowRoot.findElements(By.css('gc-widget-icon'))).to.be.empty;
        });

        it('pattern', async () => {
            const input = await driver.findElement(By.id('pattern'));
            await setElementProperty(input, 'value', '[0-9]*');

            const valueInput = await driver.findElement(By.id('value'));
            await setElementProperty(valueInput, 'value', '');

            await el.click();
            await htmlInput.sendKeys('hello world');
            // nothing
            await driver.wait(async () =>
                (await getElementProperty(valueInput, 'value')) === ''
            );
        });

        it('intermediate-changes', async () => {
            const input = (await driver.findElement(By.id('intermediate_changes')));
            await setElementProperty(input, 'checked', true);

            const valueInput = (await driver.findElement(By.id('value')));
            const htmlInput = await querySelector(await getShadowRoot(tiInput), 'input');

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

            const htmlInput = await querySelector(await getShadowRoot(tiInput), 'input');

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
        it('value-changed', done  => {
            (async () => {
                await waitForElementEvent<{value: boolean}>(el, 'value-changed', detail => {
                    let error = undefined;
                    try { expect(detail.value).eq('foobar'); }
                    catch (e) { error = e; }
                    done(error);
                });
                await setElementProperty(el, 'value', 'foobar');
            })();
        });

        it('clear-icon-clicked', done  => {
            (async () => {
                await waitForElementEvent<{value: boolean}>(el, 'clear-icon-clicked', () => done());
                (await shadowRoot.findElement(By.id('clear'))).click();
            })();
        });
    });
});