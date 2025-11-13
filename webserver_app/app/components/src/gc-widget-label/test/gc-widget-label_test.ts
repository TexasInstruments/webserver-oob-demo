import { WebElement, By } from 'selenium-webdriver';
import { driver, getActions, goto, setElementProperty, invokeElementMethod, getShadowRoot, querySelector } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-label', () => {
    let el: WebElement;
    let shadowLabel: WebElement;

    before(async () => {
        await goto('gc-widget-label/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowLabel = await querySelector(await getShadowRoot(el), 'label');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('label'));
        await setElementProperty(input, 'value', 'demo_element');

        input = await driver.findElement(By.id('text_align'));
        await setElementProperty(input, 'selectedLabel', 'center');

        input = await driver.findElement(By.id('font_size'));
        await setElementProperty(input, 'value', '14px');

        input = await driver.findElement(By.id('font_style'));
        await setElementProperty(input, 'selectedLabel', '');

        input = await driver.findElement(By.id('font_weight'));
        await setElementProperty(input, 'selectedLabel', '');

        input = await driver.findElement(By.id('text_decoration'));
        await setElementProperty(input, 'selectedLabel', '');

        input = await driver.findElement(By.id('hover_text_decoration'));
        await setElementProperty(input, 'selectedLabel', '');

        input = await driver.findElement(By.id('hover_cursor'));
        await setElementProperty(input, 'selectedLabel', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('label', async () => {
            await setElementProperty(el, 'label', 'TestLabel');
            await driver.wait(async () => await shadowLabel.getText() === 'TestLabel');
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-color', 'rgb(250, 0, 0)');
            await driver.wait(async () => (await shadowLabel.getCssValue('color')).includes('250, 0, 0'));
        });

        it('--gc-hover-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-color-hover', 'rgb(0, 0, 255)');
            await getActions().move({ origin: shadowLabel }).perform();
            await driver.wait(async () => (await shadowLabel.getCssValue('color')).includes('0, 0, 255'));
        });

        it('--gc-text-align', async () => {
            const input = await driver.findElement(By.id('text_align'));
            await setElementProperty(input, 'selectedLabel', 'left');
            await driver.wait(async () => (await shadowLabel.getCssValue('text-align')).includes('left'));

            await setElementProperty(input, 'selectedLabel', 'center');
            await driver.wait(async () => (await shadowLabel.getCssValue('text-align')).includes('center'));

            await setElementProperty(input, 'selectedLabel', 'right');
            await driver.wait(async () => (await shadowLabel.getCssValue('text-align')).includes('right'));
        });

        it('--gc-font-size', async () => {
            const input = await driver.findElement(By.id('font_size'));
            await setElementProperty(input, 'value', '10px');
            await driver.wait(async () => await shadowLabel.getCssValue('font-size') === '10px');
        });

        it('--gc-font-style', async () => {
            const input = await driver.findElement(By.id('font_style'));
            await setElementProperty(input, 'selectedLabel', 'italic');
            await driver.wait(async () => await shadowLabel.getCssValue('font-style') === 'italic');
        });

        it('--gc-font-weight', async () => {
            const input = await driver.findElement(By.id('font_weight'));
            await setElementProperty(input, 'selectedLabel', '500');
            await driver.wait(async () => await shadowLabel.getCssValue('font-weight') === '500');
        });

        it('--gc-text-decoration', async () => {
            const input = await driver.findElement(By.id('text_decoration'));
            await setElementProperty(input, 'selectedLabel', 'underline');
            await driver.wait(async () => (await shadowLabel.getCssValue('text-decoration')).includes('underline'));
        });

        it('--gc-text-decoration', async () => {
            const input = await driver.findElement(By.id('hover_text_decoration'));
            await setElementProperty(input, 'selectedLabel', 'overline');
            await driver.wait(async () => (await shadowLabel.getCssValue('text-decoration')).includes('overline'));
        });

        it('--gc-cursor-hover', async () => {
            const input = (await driver.findElement(By.id('hover_cursor')));
            await setElementProperty(input, 'selectedLabel', 'pointer');

            await getActions().move({ origin: shadowLabel }).perform();
            await driver.wait(async () => (await shadowLabel.getCssValue('cursor')).includes('pointer'));
        });

    });

    /**
     * Events
     */
    describe('Events', () => {
    });
});