import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, setElementProperty, getShadowRoot, querySelector, invokeElementMethod } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);


describe('gc-widget-led', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let ledGlow: WebElement;
    let ledLight: WebElement;
    let glowPath: WebElement;

    before(async () => {
        await goto('gc-widget-led/demo/index.html');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);

        ledGlow = await querySelector(shadowRoot, '#glow_path');
        ledLight = await querySelector(shadowRoot, '#led_path');
        glowPath = await querySelector(shadowRoot, '#glow-circle');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('on'));
        await setElementProperty(input, 'checked', true);

        input = await driver.findElement(By.id('glow'));
        await setElementProperty(input, 'checked', false);

    });
    /**
     * Properties
     */
    describe('properties', () => {
        it('on', async () => {
            await driver.wait(async () => {
                const x = (await ledLight.getCssValue('fill'));
                return x.includes('255, 0, 0');
            });

            const input = await driver.findElement(By.id('on'));
            await setElementProperty(input, 'checked', false);

            await driver.wait(async () => {
                const x = (await ledLight.getCssValue('fill'));
                return x.includes('99, 102, 106');
            });
        });

        it('glow', async () => {
            await driver.wait(async () => {
                const x = await glowPath.getCssValue('display');
                return x.includes('none');
            });

            const input = await driver.findElement(By.id('glow'));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => {
                const x = await glowPath.getCssValue('display');
                return x.includes('inline');
            });
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-on-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-on-color', 'cornflowerblue');

            await driver.wait(async () => (await ledGlow.getCssValue('fill')).includes('100, 149, 237'));
        });

        it('--gc-off-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-off-color', 'red');

            const input = await driver.findElement(By.id('on'));
            await setElementProperty(input, 'checked', false);

            await driver.wait(async () => (await ledLight.getCssValue('fill')).includes('255, 0, 0'));
        });
    });

    /**
     * Events
     */
    describe('Events', () => {

    });
});