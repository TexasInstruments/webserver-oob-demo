/* eslint-disable @typescript-eslint/ban-ts-comment */

import { WebElement, By } from 'selenium-webdriver';
import { default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, invokeElementMethod } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-progress-bar', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let shadowBackground: WebElement;

    before(async () => {
        await goto('gc-widget-progressbar/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        shadowBackground = await querySelector(shadowRoot, '#bar');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('value'));
        await setElementProperty(input, 'value', 42);

        input = await driver.findElement(By.id('min_value'));
        await setElementProperty(input, 'value', 5);

        input = await driver.findElement(By.id('max_value'));
        await setElementProperty(input, 'value', 100);

        input = await driver.findElement(By.id('indeterminate'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('message'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);

        /* reset styles */
        await invokeElementMethod(el, 'setCSSProperty', '--gc-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('value', async () => {
            const input = await driver.findElement(By.id('value'));
            await setElementProperty(input, 'value', 24);
            await driver.wait(async () => await getElementProperty(el, 'value') === 24);
        });

        it('min-value', async () => {
            const input = await driver.findElement(By.id('min_value'));
            await setElementProperty(input, 'value', 50);
            await driver.wait(async () =>
                (await getElementProperty(el, 'value')) === 42 && // value shouldn't change
                (await getElementProperty(el, 'minValue')) === 50
            );
        });

        it('max-value', async () => {
            const input = await driver.findElement(By.id('max_value'));
            await setElementProperty(input, 'value', 30);
            await driver.wait(async () =>
                (await getElementProperty(el, 'value')) === 42 && // value shouldn't change
                (await getElementProperty(el, 'maxValue')) === 30
            );
        });

        it('max-value < min-value', async () => {
            const input = await driver.findElement(By.id('max_value'));
            await setElementProperty(input, 'value', 1); // 1(max) < 5(min)
            await driver.wait(async () => (await getElementProperty(el, 'maxValue')) === 1);

            // back to 30(max) > 5(min)
            await setElementProperty(input, 'value', 30);
        });

        it('indeterminate', async () => {
            await driver.wait(async () => (await shadowBackground.getAttribute('class')).includes('determinate'));

            const input = await driver.findElement(By.id('indeterminate'));
            await setElementProperty(input, 'checked', true);

            const shadowBar = await querySelector(shadowRoot, '#bar');
            await driver.wait(async () => (await getElementProperty(el, 'indeterminate')) === true);
            await driver.wait(async () => (await shadowBar.getAttribute('class')).includes('indeterminate'));
        });

        it('message', async () => {
            const input = await driver.findElement(By.id('message'));
            await setElementProperty(input, 'value', 'Progress message...');

            const message = await querySelector(shadowRoot, '#message');
            await driver.wait(async () => (await message.getText()) === 'Progress message...');
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-background-color', async () => {

            await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color', 'rgb(167, 122, 27)');
            await driver.wait(async () => (await shadowBackground.getCssValue('background-color')).includes('167, 122, 27'));
        });

        it('--gc-color', async () => {
            const shadowBar = await querySelector(shadowRoot, '#progress-indicator');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-color', 'rgb(0, 255, 0)');
            await driver.wait(async () => (await shadowBar.getCssValue('background-color')).includes('0, 255, 0'));
        });
    });
});