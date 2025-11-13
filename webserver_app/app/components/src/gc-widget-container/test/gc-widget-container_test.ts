import { WebElement, By } from 'selenium-webdriver';
import { expect } from 'chai';
import { goto, driver, setElementProperty, getShadowRoot, querySelector } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-container', () => {
    let el: WebElement;
    let shadowRoot: WebElement;

    before(async () => {
        await goto('gc-widget-container/demo');

        el = await (await driver).findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
    });

    beforeEach(async () => {

    });

    describe('properties', () => {
        it('heading', async () => {
            const input = (await driver.findElement(By.id('heading')));
            await setElementProperty(input, 'value', 'My Super Heading');

            const heading = await querySelector(shadowRoot, '#heading');
            expect(await heading.getText()).equals('My Super Heading');
        });

        it('elevation', async () => {
            const input = (await driver.findElement(By.id('elevation')));

            await setElementProperty(input, 'selectedLabel', 5);
            driver.wait(async () => await el.getCssValue('box-shadow') === 'rgba(0, 0, 0, 0.14) 0px 2px 2px 0px, rgba(0, 0, 0, 0.12) 0px 1px 5px 0px, rgba(0, 0, 0, 0.2) 0px 3px 1px -2px');

            await setElementProperty(input, 'selectedLabel', 4);
            driver.wait(async () => await el.getCssValue('box-shadow') === 'rgba(0, 0, 0, 0.14) 0px 8px 10px 1px, rgba(0, 0, 0, 0.12) 0px 3px 14px 2px, rgba(0, 0, 0, 0.4) 0px 5px 5px -3px');

            await setElementProperty(input, 'selectedLabel', 3);
            driver.wait(async () => await el.getCssValue('box-shadow') === 'rgba(0, 0, 0, 0.14) 0px 16px 24px 2px, rgba(0, 0, 0, 0.12) 0px 6px 30px 5px, rgba(0, 0, 0, 0.4) 0px 8px 10px -5px');

            await setElementProperty(input, 'selectedLabel', 2);
            driver.wait(async () => await el.getCssValue('box-shadow') === 'rgba(0, 0, 0, 0.14) 0px 4px 5px 0px, rgba(0, 0, 0, 0.12) 0px 1px 10px 0px, rgba(0, 0, 0, 0.4) 0px 2px 4px -1px');

            await setElementProperty(input, 'selectedLabel', 1);
            driver.wait(async () => await el.getCssValue('box-shadow') === 'rgba(0, 0, 0, 0.14) 0px 2px 2px 0px, rgba(0, 0, 0, 0.12) 0px 1px 5px 0px, rgba(0, 0, 0, 0.2) 0px 3px 1px -2px');

            await setElementProperty(input, 'selectedLabel', 0);
            driver.wait(async () => await el.getCssValue('box-shadow') === 'none');

            await setElementProperty(input, 'selectedLabel', -1);
            driver.wait(async () => await el.getCssValue('box-shadow') === 'none');

            await setElementProperty(input, 'selectedLabel', 6);
            driver.wait(async () => await el.getCssValue('box-shadow') === 'none');
        });
    });
});