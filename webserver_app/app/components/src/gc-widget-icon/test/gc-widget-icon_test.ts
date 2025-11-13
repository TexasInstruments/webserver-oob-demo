import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getShadowRoot, querySelector, setElementProperty, getElementProperty, invokeElementMethod } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-icon', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tiSVGIcon: WebElement;

    before(async () => {
        await goto('gc-widget-icon/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        tiSVGIcon = await querySelector(shadowRoot, 'ti-svg-icon');
    });

    beforeEach(async () => {
        let input = (await driver.findElement(By.id('icon')));
        await setElementProperty(input, 'selectedLabel', 'outlined:action:face');

        input = (await driver.findElement(By.id('path')));
        await setElementProperty(input, 'value', '');

        input = (await driver.findElement(By.id('size')));
        await setElementProperty(input, 'selectedLabel', 'xl');

        input = (await driver.findElement(By.id('circle')));
        await setElementProperty(input, 'checked', false);

        input = (await driver.findElement(By.id('appearance')));
        await setElementProperty(input, 'selectedLabel', 'primary');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('icon', async () => {
            const input = (await driver.findElement(By.id('icon')));
            await setElementProperty(input, 'selectedLabel', 'outlined:action:face');

            await driver.wait(async () =>
                await getElementProperty(tiSVGIcon, 'iconName') === 'face' &&
                await getElementProperty(tiSVGIcon, 'iconSet') === 'action'
            );
        });

        it('path', async () => {
            const input = (await driver.findElement(By.id('path')));
            await setElementProperty(input, 'value', '../../assets/icons/round/');

            const tiSvgShadowRoot = await getShadowRoot(tiSVGIcon);
            const use = await querySelector(tiSvgShadowRoot, 'use');
            await driver.wait(async () => await use.getAttribute('href') === '../../assets/icons/round/action.svg#face');
        });

        it('size', async () => {
            const input = (await driver.findElement(By.id('size')));
            await setElementProperty(input, 'selectedLabel', 'xxs');

            await driver.wait(async () =>
                await tiSVGIcon.getCssValue('width') === '11px' &&
                await tiSVGIcon.getCssValue('width') === '11px'
            );
        });

        it('circle', async () => {
            const input = (await driver.findElement(By.id('circle')));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => await tiSVGIcon.getCssValue('border-radius') === '100%');
        });

        it('appearance', async () => {
            const input = (await driver.findElement(By.id('appearance')));
            await setElementProperty(input, 'selectedLabel', 'secondary');

            await driver.wait(async () => (await tiSVGIcon.getCssValue('fill')).includes('17, 85, 102'));
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-color', async () => {
            const input = (await driver.findElement(By.id('appearance')));
            await setElementProperty(input, 'selectedLabel', 'custom');
            await invokeElementMethod(el, 'setCSSProperty', '--gc-color', 'cornflowerblue');

            await driver.wait(async () => (await tiSVGIcon.getCssValue('fill')).includes('100, 149, 237'));
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
    });
});