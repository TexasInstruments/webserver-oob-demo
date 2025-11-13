/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-toggle-switch', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let htmlInput: WebElement;

    before(async () => {
        await goto('gc-widget-toggle-switch/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        htmlInput = await querySelector(shadowRoot, 'input');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('checked'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('label'));
        await setElementProperty(input, 'value', 'test off');

        input = await driver.findElement(By.id('label_when_checked'));
        await setElementProperty(input, 'value', 'test on');

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('readonly'));
        await setElementProperty(input, 'checked', false);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('value', async () => {
            const input = (await driver.findElement(By.id('checked')));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => await getElementProperty(htmlInput, 'checked') === true);
        });

        it('label', async () => {
            const input = (await driver.findElement(By.id('label')));
            await setElementProperty(input, 'value', 'test label');

            const labelDiv = shadowRoot.findElement(By.css('div[class="label"]'));
            await driver.wait(async () => await labelDiv.getText() === 'test label');
        });

        it('labelWhenChecked', async () => {
            const input = (await driver.findElement(By.id('label_when_checked')));
            await setElementProperty(input, 'value', 'test label when checked');

            const checkbox = (await driver.findElement(By.id('checked')));
            await setElementProperty(checkbox, 'checked', true);

            const labelDiv = shadowRoot.findElement(By.css('div[class="labelWhenChecked"]'));
            await driver.wait(async () => await labelDiv.getText() === 'test label when checked');
        });

        it('disabled', async () => {
            const input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () => (await getElementProperty(el, 'disabled') === true));

            await expect(htmlInput.click()).to.be.rejectedWith();
            await driver.wait(async () => await getElementProperty(el, 'checked') === false);
        });

        it('readonly', async () => {
            const input = (await driver.findElement(By.id('readonly')));
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () => (await getElementProperty(el, 'readonly') === true));

            await expect(htmlInput.click()).to.be.rejectedWith();
            await driver.wait(async () => await getElementProperty(el, 'checked') === false);
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('disabled', async () => {
            const input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            const slider = await querySelector(shadowRoot, '.slider');

            await driver.wait(async () => (await slider.getCssValue('background-color')).includes('85, 85, 85'));
            await driver.wait(async () => (await slider.getCssValue('cursor')) === 'not-allowed');
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
        it('checked-changed', done  => {
            (async () => {
                await waitForElementEvent<{value: boolean}>(el, 'checked-changed', detail => {
                    let error = undefined;
                    try { expect(detail.value).is.true; }
                    catch (e) { error = e; };
                    done(error);
                });

                await el.click();
            })();
        });
    });
});