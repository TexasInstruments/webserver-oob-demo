import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent, invokeElementMethod } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);
const WAIT_TIMEOUT = 500;

describe('gc-widget-slider', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tiSlider: WebElement;

    before(async () => {
        await goto('gc-widget-slider/demo');
        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        tiSlider = await querySelector(shadowRoot, 'ti-range-slider');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('range_slider'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('step'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('min_value'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('max_value'));
        await setElementProperty(input, 'value', 100);

        input = await driver.findElement(By.id('value'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('lvalue'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('no_ticks'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('labels'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('intermediate_changes'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('readonly'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('range-slider', async () => {
            await driver.wait(async () => await getElementProperty(tiSlider, 'minIsFixed') === true);
            const input = (await driver.findElement(By.id('range_slider')));
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () => await getElementProperty(tiSlider, 'minIsFixed') === false);

            const tiSliderRoot = await getShadowRoot(tiSlider);
            const lowerHandler = await querySelector(tiSliderRoot, 'div.noUi-handle-lower');
            expect(lowerHandler).is.not.null;

            const upperHandler = await querySelector(tiSliderRoot, 'div.noUi-handle-upper');
            expect(upperHandler).is.not.null;
        });

        it('step', async () => {
            const stepInput = await driver.findElement(By.id('step'));
            const valueInput = await driver.findElement(By.id('value'));

            await setElementProperty(stepInput, 'value', 20);

            // auto lower value
            await setElementProperty(valueInput, 'value', 21);
            await driver.wait(async () => await getElementProperty(el, 'value') === 20, WAIT_TIMEOUT, 'failed to set 21');

            // auto raise value
            await setElementProperty(valueInput, 'value', 39);
            await driver.wait(async () => await getElementProperty(el, 'value') === 40, WAIT_TIMEOUT, 'failed to set 40');
        });

        it('value', async () => {
            const input = await driver.findElement(By.id('value'));

            await setElementProperty(input, 'value', 42);
            await driver.wait(async () => await getElementProperty(el, 'value') === 42, WAIT_TIMEOUT, 'failed to set 42');

            await setElementProperty(input, 'value', -1);
            await driver.wait(async () => await getElementProperty(el, 'value') === 0, WAIT_TIMEOUT, 'failed to set -1');

            await setElementProperty(input, 'value', 101);
            await driver.wait(async () => await getElementProperty(el, 'value') === 100, WAIT_TIMEOUT, 'failed to set 101');
        });

        it('lvalue', async () => {
            const rangeInput = await driver.findElement(By.id('range_slider'));
            await setElementProperty(rangeInput, 'checked', true);

            const valueInput = await driver.findElement(By.id('value'));
            await setElementProperty(valueInput, 'value', 100);

            const lvalueInput = await driver.findElement(By.id('lvalue'));
            await setElementProperty(lvalueInput, 'value', 42);
            await driver.wait(async () => await getElementProperty(el, 'lvalue') === 42, WAIT_TIMEOUT, 'failed to set 42');

            await setElementProperty(lvalueInput, 'value', -1);
            await driver.wait(async () => await getElementProperty(el, 'lvalue') === 0, WAIT_TIMEOUT, 'failed to set -1');

            await setElementProperty(lvalueInput, 'value', 101);
            await driver.wait(async () => await getElementProperty(el, 'lvalue') === 100, WAIT_TIMEOUT, 'failed to set 101');
        });

        it('no-ticks', async () => {
            const input = await driver.findElement(By.id('no_ticks'));
            const tiSliderShadowRoot = await getShadowRoot(tiSlider);
            const tickContainer = await querySelector(tiSliderShadowRoot, 'div.ti-slider-tick-container');
            expect(tickContainer).is.not.null;

            await setElementProperty(input, 'checked', true);

            driver.wait(async () => {
                try {
                    await tiSliderShadowRoot.findElement(By.css('div.ti-slider-tick-container'));
                    return false;
                } catch {
                    return true;
                }
            });
        });

        it('labels', async () => {
            const input = await driver.findElement(By.id('labels'));
            await setElementProperty(input, 'value', 'one, two, three');

            const tiSliderShadowRoot = await getShadowRoot(tiSlider);
            const tickContainer = await querySelector(tiSliderShadowRoot, 'div.ti-slider-tick-container');
            const ticks = await tickContainer.findElements(By.css('div.tick'));
            expect(ticks.length).equals(3);

            const two = await (await ticks[1].findElement(By.css('span'))).getText();
            expect(two).equals('two');
        });

        it('min-value', async () => {
            const input = await driver.findElement(By.id('min_value'));
            await setElementProperty(input, 'value', -42);

            const tiSliderShadowRoot = await getShadowRoot(tiSlider);
            const tickContainer = await querySelector(tiSliderShadowRoot, 'div.ti-slider-tick-container');
            const ticks = await tickContainer.findElements(By.css('div.tick'));
            const label = await (await ticks[0].findElement(By.tagName('span'))).getText();
            expect(label).equals('-42');
        });

        it('max-value', async () => {
            const input = await driver.findElement(By.id('max_value'));
            await setElementProperty(input, 'value', 42);

            const tiSliderShadowRoot = await getShadowRoot(tiSlider);
            const tickContainer = await querySelector(tiSliderShadowRoot, 'div.ti-slider-tick-container');
            const ticks = await tickContainer.findElements(By.css('div.tick'));
            const label = await (await ticks[4].findElement(By.css('span'))).getText();
            expect(label).equals('42');
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-font-size', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-font-size', '10px');

            const tiSliderShadowRoot = await getShadowRoot(tiSlider);
            const span = await querySelector(tiSliderShadowRoot, 'div.tick span');
            await driver.wait(async () => await span.getCssValue('font-size') === '10px', WAIT_TIMEOUT);
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
    });
});