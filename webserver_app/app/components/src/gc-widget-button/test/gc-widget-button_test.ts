import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent, invokeElementMethod, getActions } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-button', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tiButton: WebElement;
    let shadowButton: WebElement;

    before(async () => {
        await goto('gc-widget-button/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        tiButton = await querySelector(shadowRoot, 'ti-button');
        shadowButton = await querySelector(await getShadowRoot(tiButton), 'button');
    });

    beforeEach(async () => {
        let input = (await driver.findElement(By.id('button_type')));
        await setElementProperty(input, 'selectedLabel', 'primary');

        input = (await driver.findElement(By.id('label')));
        await setElementProperty(input, 'value', 'Test Label!');

        input = (await driver.findElement(By.id('icon')));
        await setElementProperty(input, 'value', '');

        input = (await driver.findElement(By.id('disabled')));
        await setElementProperty(input, 'checked', false);

        /* reset styles */
        await invokeElementMethod(el, 'setCSSProperty', '--gc-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-color-disabled', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-color-hover', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color-disabled', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color-hover', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-border-color', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-border-color-disabled', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-border-color-hover', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-text-decoration', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-text-decoration-hover', '');
        await invokeElementMethod(el, 'setCSSProperty', '--gc-text-transform', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('buttonType', async () => {
            const input = (await driver.findElement(By.id('button_type')));

            await setElementProperty(input, 'selectedLabel', 'primary');
            await driver.wait(async () => {
                const color = await shadowButton.getCssValue('color');
                const fillColor = await shadowButton.getCssValue('fill');
                const bgColor = await shadowButton.getCssValue('background-color');
                return color.includes('255, 255, 255') &&
                    fillColor.includes('255, 255, 255') &&
                    bgColor.includes('204, 0, 0');
            });

            await setElementProperty(input, 'selectedLabel', 'secondary');
            await driver.wait(async () => {
                const color = await shadowButton.getCssValue('color');
                const fillColor = await shadowButton.getCssValue('fill');
                const bgColor = await shadowButton.getCssValue('background-color');
                return color.includes('204, 0, 0') &&
                    fillColor.includes('204, 0, 0') &&
                    bgColor.includes('255, 255, 255');
            });

            await setElementProperty(input, 'selectedLabel', 'link');
            await driver.wait(async () => {
                const color = await shadowButton.getCssValue('color');
                const fillColor = await shadowButton.getCssValue('fill');
                const bgColor = await shadowButton.getCssValue('background-color');
                return color.includes('0, 124, 140') &&
                    fillColor.includes('0, 124, 140') &&
                    bgColor.includes('0, 0, 0');
            });

            await setElementProperty(input, 'selectedLabel', 'link');
            await driver.wait(async () => {
                const color = await shadowButton.getCssValue('color');
                const fillColor = await shadowButton.getCssValue('fill');
                const bgColor = await shadowButton.getCssValue('background-color');
                return color.includes('0, 124, 140') &&
                    fillColor.includes('0, 124, 140') &&
                    bgColor.includes('0, 0, 0');
            });

            await setElementProperty(input, 'selectedLabel', 'custom');
            await driver.wait(async () => {
                const color = await shadowButton.getCssValue('color');
                const fillColor = await shadowButton.getCssValue('fill');
                const bgColor = await shadowButton.getCssValue('background-color');
                return color.includes('255, 255, 255') &&
                    fillColor.includes('255, 255, 255') &&
                    bgColor.includes('244, 184, 33');
            });

        });

        it('label', async () => {
            const input = (await driver.findElement(By.id('label')));

            await setElementProperty(input, 'value', 'custom');
            await driver.wait(async () => await (await querySelector(shadowRoot, 'span')).getText() === 'custom');
        });

        it('icon', async () => {
            const input = (await driver.findElement(By.id('icon')));

            await setElementProperty(input, 'value', 'icons:android');
            await driver.wait(async () => await getElementProperty(
                await querySelector(shadowRoot, 'gc-widget-icon'), 'icon') === 'icons:android'
            );
        });

        it('disabled', async () => {
            const input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            await getActions().move({ x: 0, y: 0 }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('background-color')).includes('204, 204, 204'));
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-color', async () => {
            const input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-color', 'rgb(250, 0, 0)');
            await getActions().move({ x: 0, y: 0 }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('color')).includes('250, 0, 0'));
        });

        it('--gc-color-disabled', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            await invokeElementMethod(el, 'setCSSProperty', '--gc-color-disabled', 'rgb(255, 0, 0)');
            await getActions().move({ x: 0, y: 0 }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('color')).includes('255, 0, 0'));
        });

        it('--gc-color-hover', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-color-hover', 'rgb(255, 0, 0)');
            await getActions().move({ origin: shadowButton }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('color')).includes('255, 0, 0'));
        });

        it('--gc-background-color', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color', 'rgb(255, 0, 0)');
            await getActions().move({ x: 0, y: 0 }).perform(); // Move the mouse so that background is updated. Not sure why.
            await driver.wait(async () => (await shadowButton.getCssValue('background-color')).includes('255, 0, 0'));
        });

        it('--gc-background-color-disabled', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color-disabled', 'rgb(255, 0, 0)');
            await getActions().move({ x: 0, y: 0 }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('background-color')).includes('255, 0, 0'));
        });

        it('--gc-background-color-hover', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-background-color-hover', 'rgb(255, 0, 0)');
            await getActions().move({ origin: shadowButton }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('background-color')).includes('255, 0, 0'));
        });

        it('--gc-border-color', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-border-color', 'rgb(255, 0, 0)');
            await getActions().move({ x: 0, y: 0 }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('border-color')).includes('255, 0, 0'));
        });

        it('--gc-border-color-disabled', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            await invokeElementMethod(el, 'setCSSProperty', '--gc-border-color-disabled', 'rgb(255, 0, 0)');
            await getActions().move({ x: 0, y: 0 }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('border-color')).includes('255, 0, 0'));
        });

        it('--gc-border-color-hover', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-border-color-hover', 'rgb(255, 0, 0)');
            await getActions().move({ origin: shadowButton }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('border-color')).includes('255, 0, 0'));
        });

        it('--gc-text-decoration', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-text-decoration', 'underline');
            await getActions().move({ x: 0, y: 0 }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('text-decoration')).includes('underline'));
        });

        it('--gc-text-decoration-hover', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-text-decoration-hover', 'underline');
            await getActions().move({ origin: shadowButton }).perform();
            await driver.wait(async () => (await shadowButton.getCssValue('text-decoration')).includes('underline'));
        });

        it('--gc-text-transform', async () => {
            let input = (await driver.findElement(By.id('button_type')));
            await setElementProperty(input, 'selectedLabel', 'custom');

            await invokeElementMethod(el, 'setCSSProperty', '--gc-text-transform', 'uppercase');
            await getActions().move({ origin: shadowButton }).perform();
            const span = await querySelector(tiButton, 'span');
            await driver.wait(async () => (await span.getCssValue('text-transform')).includes('uppercase'));
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
        it('click', done  => {
            (async () => {
                await waitForElementEvent(el, 'click', () => done());
                el.click();
            })();
        });
    });
});