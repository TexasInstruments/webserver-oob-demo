/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-checkbox', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tiCheckbox: WebElement;

    before(async () => {
        await goto('gc-widget-checkbox/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        tiCheckbox = await querySelector(shadowRoot, 'ti-checkbox');
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

            await driver.wait(async () => await getElementProperty(tiCheckbox, 'checked') === true);
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

            await expect(tiCheckbox.click()).to.be.rejectedWith();
            await driver.wait(async () => await getElementProperty(el, 'checked') === false);
        });

        it('readonly', async () => {
            const input = (await driver.findElement(By.id('readonly')));
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () => (await getElementProperty(el, 'readonly') === true));

            await expect(tiCheckbox.click()).to.be.rejectedWith();
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

            const widgetCheckbox = await querySelector(shadowRoot, 'ti-checkbox');

            driver.wait(async () => (await widgetCheckbox.getCssValue('opacity')) === '0.5');
            driver.wait(async () => (await widgetCheckbox.getCssValue('cursor')) === 'not-allowed');
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

                await tiCheckbox.click();
            })();
        });
    });
});