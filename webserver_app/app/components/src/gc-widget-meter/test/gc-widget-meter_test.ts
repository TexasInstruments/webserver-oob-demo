/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, querySelectorAll, invokeElementMethod } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-meter', () => {
    let el: WebElement;
    let shadowRoot: WebElement;

    before(async () => {
        await goto('gc-widget-meter/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('value'));
        await setElementProperty(input, 'value', 42);

        input = await driver.findElement(By.id('min_value'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('max_value'));
        await setElementProperty(input, 'value', 100);

        input = await driver.findElement(By.id('precision'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('main_title'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('sub_title'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);

        await invokeElementMethod(el, 'setCSSProperty', '--gc-font-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-thickness', 'normal');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-background-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-low-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-mid-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-high-color', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('value', async () => {
            const input = await driver.findElement(By.id('value'));
            await setElementProperty(input, 'value', 24);
            await driver.wait(async () => await getElementProperty(el, 'value') === 24);
            const arc = await querySelector(shadowRoot, '#face-layer #arc');
            await driver.wait(async () => (await arc.getAttribute('d')).match(/M 0 50 A 50 50 0 0 1 13.\d+ 15.\d+ L 24.\d+ 26.\d+ A 35 35 0 0 0 15 50 Z/));
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

        it('precision', async () => {
            const input = await driver.findElement(By.id('precision'));
            await setElementProperty(input, 'value', 1);
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #value')).getText() === '42.0');
        });

        it('main-title', async () => {
            const input = await driver.findElement(By.id('main_title'));
            await setElementProperty(input, 'value', 'Speedometer');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #main-title')).getText() === 'Speedometer' );
        });

        it('sub-title', async () => {
            const input = await driver.findElement(By.id('sub_title'));
            await setElementProperty(input, 'value', 'km');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #sub-title')).getText() === 'km' );
        });

        it('disabled', async () => {
            const input = await driver.findElement(By.id('disabled'));
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () =>
                await (await querySelector(shadowRoot, '#face-layer #arc-background')).getCssValue('fill') === 'rgb(229, 229, 229)' &&
                await (await querySelector(shadowRoot, '#face-layer #arc')).getCssValue('fill') === 'rgb(204, 204, 204)'
            );
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-font-color', async () => {
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #value')).getCssValue('fill') === 'rgb(85, 85, 85)');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #min-value')).getCssValue('fill') === 'rgb(85, 85, 85)');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #max-value')).getCssValue('fill') === 'rgb(85, 85, 85)');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #main-title')).getCssValue('fill') === 'rgb(85, 85, 85)');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #sub-title')).getCssValue('fill') === 'rgb(85, 85, 85)');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-font-color', 'red');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #value')).getCssValue('fill') === 'rgb(255, 0, 0)');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #min-value')).getCssValue('fill') === 'rgb(255, 0, 0)');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #max-value')).getCssValue('fill') === 'rgb(255, 0, 0)');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #main-title')).getCssValue('fill') === 'rgb(255, 0, 0)');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #sub-title')).getCssValue('fill') === 'rgb(255, 0, 0)');
        });

        it('--gc-arc-thickness', async () => {
            const arc = await querySelector(shadowRoot, '#face-layer #arc');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-thickness', 'normal');
            await driver.wait(async () => (await arc.getAttribute('d')).match(/M 0 50 A 50 50 0 0 1 37.\d+ 1.\d+ L 41.\d+ 16.\d+ A 35 35 0 0 0 15 50 Z/));

            await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-thickness', 'thick');
            await driver.wait(async () => (await arc.getAttribute('d')).match(/M 0 50 A 50 50 0 0 1 37.\d+ 1.\d+ L 42.\d+ 20.\d+ A 30 30 0 0 0 20 50 Z/));

            await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-thickness', 'thin');
            await driver.wait(async () => (await arc.getAttribute('d')).match(/M 0 50 A 50 50 0 0 1 37.\d+ 1.\d+ L 40.\d+ 11.\d+ A 40 40 0 0 0 10 50 Z/));
        });

        it('--gc-arc-background-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-background-color', 'red');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#face-layer #arc-background')).getCssValue('fill') === 'rgb(255, 0, 0)');
        });

        it('--gc-arc-low-color', async () => {
            await setElementProperty(el, 'value', 0);
            await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-low-color', 'red');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#face-layer #arc')).getCssValue('fill') === 'rgb(255, 0, 0)');
        });

        it('--gc-arc-mid-color', async () => {
            await setElementProperty(el, 'value', 50);
            await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-mid-color', 'green');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#face-layer #arc')).getCssValue('fill') === 'rgb(0, 128, 0)');
        });

        it('--gc-arc-high-color', async () => {
            await setElementProperty(el, 'value', 100);
            await invokeElementMethod(el, 'setCSSProperty', '--gc-arc-high-color', 'blue');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#face-layer #arc')).getCssValue('fill') === 'rgb(0, 0, 255)');
        });
    });
});