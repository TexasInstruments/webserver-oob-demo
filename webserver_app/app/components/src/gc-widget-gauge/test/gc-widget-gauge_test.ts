/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, querySelectorAll, invokeElementMethod } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-gauge', () => {
    let el: WebElement;
    let shadowRoot: WebElement;

    before(async () => {
        await goto('gc-widget-gauge/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('value'));
        await setElementProperty(input, 'value', 42);

        input = await driver.findElement(By.id('has_detail_value'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('detail_value'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('min_value'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('max_value'));
        await setElementProperty(input, 'value', 100);

        input = await driver.findElement(By.id('num_ticks_per_unit'));
        await setElementProperty(input, 'value', 1);

        input = await driver.findElement(By.id('num_ticks_per_number_label'));
        await setElementProperty(input, 'value', 10);

        input = await driver.findElement(By.id('num_ticks_to_first_label'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('precision'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('main_title'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('sub_title'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);

        await invokeElementMethod(el, 'setCSSProperty', '--gc-tick-style', 'long');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-needle-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-ring-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-tick-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-major-tick-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-font-size', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-detail-value-font-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-detail-value-background-color', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('value', async () => {
            const input = await driver.findElement(By.id('value'));
            await setElementProperty(input, 'value', 24);
            await driver.wait(async () => await getElementProperty(el, 'value') === 24);
            const needle = await querySelector(shadowRoot, '#needle-layer path');
            await driver.wait(async () => (await needle.getCssValue('transform')) === 'matrix(0.207912, -0.978148, 0.978148, 0.207912, 0, 0)');
        });

        it('has-detail-value', async () => {
            const input = await driver.findElement(By.id('has_detail_value'));
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () =>
                (await querySelector(shadowRoot, '#label-layer #detail-value')) !== null &&
                (await querySelector(shadowRoot, '#label-layer #detail-value-background')) !== null
            );
        });

        it('detail-value', async () => {
            let input = await driver.findElement(By.id('has_detail_value'));
            await setElementProperty(input, 'checked', true);
            input = await driver.findElement(By.id('detail_value'));
            await setElementProperty(input, 'value', 'foobar');
            const detailValue = await querySelector(shadowRoot, '#label-layer #detail-value');
            await driver.wait(async () => await detailValue.getText() === 'foobar');
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

        it('num-ticks-per-unit', async () => {
            const input = await driver.findElement(By.id('num_ticks_per_unit'));
            await setElementProperty(input, 'value', 2);
            await driver.wait(async () => (await querySelectorAll(shadowRoot, '#scale-layer path')).length === 201);

            await setElementProperty(input, 'value', 0.5);
            await driver.wait(async () => (await querySelectorAll(shadowRoot, '#scale-layer path')).length === 51);
        });

        it('num-ticks-per-number-label', async () => {
            const input = await driver.findElement(By.id('num_ticks_per_number_label'));
            await setElementProperty(input, 'value', 20);

            await driver.wait(async () => {
                const labels = await querySelectorAll(shadowRoot, '#scale-layer text');
                if (labels.length !== 6) return false;
                return await labels[0].getText() === '0' && await labels[1].getText() === '20' && await labels[5].getText() === '100';
            });
        });

        it('num-ticks-to-first-label', async () => {
            const input = await driver.findElement(By.id('num_ticks_to_first_label'));
            await setElementProperty(input, 'value', 20);

            await driver.wait(async () => {
                const labels = await querySelectorAll(shadowRoot, '#scale-layer text');
                if (labels.length !== 9) return false;
                return await labels[0].getText() === '20' && await labels[1].getText() === '30' && await labels[8].getText() === '100';
            });
        });

        it('precision', async () => {
            const input = await driver.findElement(By.id('precision'));
            await setElementProperty(input, 'value', 1);

            await driver.wait(async () => {
                const labels = await querySelectorAll(shadowRoot, '#scale-layer text');
                if (labels.length !== 11) return false;
                return await labels[0].getText() === '0.0' && await labels[1].getText() === '10.0' && await labels[10].getText() === '100.0';
            });
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
                await (await querySelector(shadowRoot, '#face-layer #outer-circle')).getCssValue('fill') === 'rgb(204, 204, 204)' &&
                await (await querySelector(shadowRoot, '#face-layer #inner-circle')).getCssValue('fill') === 'rgb(229, 229, 229)' &&
                await (await querySelector(shadowRoot, '#needle-layer path')).getCssValue('fill') === 'rgb(204, 204, 204)'
            );
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-tick-style', async () => {
            await driver.wait(async () => await (await querySelector(shadowRoot, '#scale-layer path')).getAttribute('stroke-width') === '0.2' );
            await invokeElementMethod(el, 'setCSSProperty', '--gc-tick-style', 'bold');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#scale-layer path')).getAttribute('stroke-width') === '0.9' );
        });

        it('--gc-needle-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-needle-color', 'blue');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#needle-layer path')).getCssValue('fill') === 'rgb(0, 0, 255)');
        });

        it('--gc-ring-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-ring-color', 'blue');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#face-layer #outer-circle')).getCssValue('fill') === 'rgb(0, 0, 255)');
        });

        it('--gc-background-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color', 'blue');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#face-layer #inner-circle')).getCssValue('fill') === 'rgb(0, 0, 255)');
        });

        it('--gc-tick-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-tick-color', 'blue');
            await driver.wait(async () => await (await querySelectorAll(shadowRoot, '#scale-layer path'))[1].getCssValue('stroke') === 'rgb(0, 0, 255)');
        });

        it('--gc-major-tick-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-major-tick-color', 'red');
            await driver.wait(async () => await (await querySelectorAll(shadowRoot, '#scale-layer path'))[0].getCssValue('stroke') === 'rgb(255, 0, 0)');
        });

        it('--gc-font-size', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-font-size', '3px');
            await driver.wait(async () => await (await querySelectorAll(shadowRoot, '#scale-layer text'))[0].getCssValue('font-size') === '3px');
        });

        it('--gc-detail-value-font-color', async () => {
            let input = await driver.findElement(By.id('has_detail_value'));
            await setElementProperty(input, 'checked', true);
            input = await driver.findElement(By.id('detail_value'));
            await setElementProperty(input, 'value', 'foobar');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-detail-value-font-color', 'blue');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #detail-value')).getCssValue('fill') === 'rgb(0, 0, 255)');
        });

        it('--gc-detail-value-background-color', async () => {
            let input = await driver.findElement(By.id('has_detail_value'));
            await setElementProperty(input, 'checked', true);
            input = await driver.findElement(By.id('detail_value'));
            await setElementProperty(input, 'value', 'foobar');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-detail-value-background-color', 'green');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#label-layer #detail-value-background')).getCssValue('fill') === 'rgb(0, 128, 0)');
        });
    });
});