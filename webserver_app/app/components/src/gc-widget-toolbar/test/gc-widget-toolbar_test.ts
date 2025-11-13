/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-toolbar', () => {
    let el: WebElement;
    let elOutput: WebElement;
    let shadowRoot: WebElement;

    before(async () => {
        await goto('gc-widget-toolbar/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        elOutput = await driver.findElement(By.id('output'));
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('icon'));
        await setElementProperty(input, 'value', 'icons:add-circle');

        input = await driver.findElement(By.id('tooltip'));
        await setElementProperty(input, 'value', 'Press Me!');

        input = await driver.findElement(By.id('enabled'));
        await setElementProperty(input, 'checked', true);

        input = await driver.findElement(By.id('visible'));
        await setElementProperty(input, 'checked', true);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('icon', async () => {
            const input = await driver.findElement(By.id('icon'));
            await setElementProperty(input, 'value', 'icons:account-circle');

            const icon = await querySelector(shadowRoot, 'gc-widget-icon');
            await driver.wait(async () => await getElementProperty(icon, 'icon') === 'icons:account-circle');
        });

        it('tooltip', async () => {
            const input = await driver.findElement(By.id('tooltip'));
            await setElementProperty(input, 'value', 'test label');

            const tooltip = await querySelector(shadowRoot, 'gc-widget-tooltip');
            await driver.wait(async () => await getElementProperty(tooltip, 'text') === 'test label');
        });

        it('isEnabled', async () => {
            const input = await driver.findElement(By.id('enabled'));
            await setElementProperty(input, 'checked', 'false');

            await driver.wait(async () => await el.getCssValue('filter') === 'opacity(0.5)');
        });

        it('isVisible', async () => {
            const input = await driver.findElement(By.id('visible'));
            await setElementProperty(input, 'checked', 'false');

            await driver.wait(async () => await el.getCssValue('display') === 'none');
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
    });

    /**
     * Events
     */
    describe('Events', () => {
    });

    /**
     * ActionRegistry
     */
    describe('ActionRegistry', () => {
        it('run', async ()  => {
            await el.click();
            await driver.wait(async () => (await elOutput.getText()).includes('cmd_press_me'));
        });

        it('isEnabled', async () => {
            let input = await driver.findElement(By.id('enabled'));
            await setElementProperty(input, 'checked', 'false');

            // TODO: we can remove this when tooltip is fixed to not use trigger item
            input = await driver.findElement(By.id('tooltip'));
            await setElementProperty(input, 'value', '');

            await driver.wait(async () => await el.getCssValue('cursor') === 'not-allowed');
        });

        it('isVisible', async () => {
            const input = await driver.findElement(By.id('visible'));
            await setElementProperty(input, 'checked', 'false');

            await expect(el.click()).to.be.rejectedWith();
        });
    });
});