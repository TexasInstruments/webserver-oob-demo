import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getShadowRoot, querySelector, setElementProperty, getElementProperty, invokeElementMethod, getActions, waitForElementEvent } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-dialog', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let openBtn: WebElement;
    let closeBtn: WebElement;

    before(async () => {
        await goto('gc-widget-dialog/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        openBtn = await driver.findElement(By.id('demoBtn'));
        closeBtn = await driver.findElement(By.id('closeBtn'));
    });

    beforeEach(async () => {
        let input = (await driver.findElement(By.id('heading')));
        await setElementProperty(input, 'value', 'heading');

        input = (await driver.findElement(By.id('desc')));
        await setElementProperty(input, 'value', 'description');

        input = (await driver.findElement(By.id('icon')));
        await setElementProperty(input, 'value', 'two-tone:action:face');

        input = (await driver.findElement(By.id('modal')));
        await setElementProperty(input, 'checked', true);

        input = (await driver.findElement(By.id('resizable')));
        await setElementProperty(input, 'checked', true);

        input = (await driver.findElement(By.id('close_on_esc')));
        await setElementProperty(input, 'checked', true);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('heading', async () => {
            await getActions().click(openBtn).perform();

            await driver.wait(async () => await getElementProperty(el, 'heading') === 'heading');

            // empty should be gone
            const input = (await driver.findElement(By.id('heading')));
            await setElementProperty(input, 'value', '');
            await driver.wait(async () => await getElementProperty(el, 'heading') === '');
        });
        it('desc', async () => {
            await getActions().click(openBtn).perform();

            await driver.wait(async () => await (await querySelector(shadowRoot, '#desc')).getText() === 'description');

            // empty should be gone
            const input = (await driver.findElement(By.id('desc')));
            await setElementProperty(input, 'value', '');
            await driver.wait(async () => await (await querySelector(shadowRoot, '#heading')).getText() === 'heading');
            await driver.wait(async () => await getElementProperty(el, 'desc') === '');

        });
        it('icon', async () => {
            await getActions().click(openBtn).perform();

            const input = (await driver.findElement(By.id('icon')));
            await driver.wait(async () => await getElementProperty(
                await querySelector(shadowRoot, 'gc-widget-icon'), 'icon') === 'two-tone:action:face'
            );

            await setElementProperty(input, 'value', 'icons:android');
            await driver.wait(async () => await getElementProperty(
                await querySelector(shadowRoot, 'gc-widget-icon'), 'icon') === 'icons:android'
            );
        });
        it('modal', async () => {
            await getActions().click(openBtn).perform();
            let input = (await driver.findElement(By.id('modal')));
            await setElementProperty(input, 'checked', true);
            const modalDiv = await querySelector(shadowRoot, '.modal-background');
            await driver.wait(async () => await (
                modalDiv.getCssValue('opacity')
            ) === '0.3');

            input = (await driver.findElement(By.id('modal')));
            await setElementProperty(input, 'checked', false);
            await driver.wait(async () => await getElementProperty(el, 'modal') === false);
        });
        it('resizable', async () => {
            await getActions().click(openBtn).perform();

            const dialog = await querySelector(shadowRoot, '#dialog-div');
            await driver.wait(async () => await (
                dialog.getCssValue('resize')
            ) === 'both');

            const input = (await driver.findElement(By.id('resizable')));
            await setElementProperty(input, 'checked', false);
            await driver.wait(async () => await (
                dialog.getCssValue('resize')
            ) === 'none');
        });
        it('closeOnEsc', async () => {
            await getActions().click(openBtn).perform();

            await driver.wait(async () => await getElementProperty(el, 'closeOnEsc') === true);

            const input = (await driver.findElement(By.id('close_on_esc')));
            await setElementProperty(input, 'checked', false);
            await getActions().click(openBtn).perform();
            await driver.wait(async () => await getElementProperty(el, 'closeOnEsc') === false);

        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('--gc-modal-color', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-modal-color', 'rgb(250, 0, 0)');
            const input = (await driver.findElement(By.id('modal')));
            await setElementProperty(input, 'checked', true);
            await getActions().click(openBtn).perform();

            const modalDiv = await querySelector(shadowRoot, '.modal-background');
            (await driver.wait(async () => await modalDiv.getCssValue('background'))).includes('250, 0, 0');
        });
        it('--gc-modal-opacity', async () => {
            await invokeElementMethod(el, 'setCSSProperty', '--gc-modal-opacity', '1');
            const input = (await driver.findElement(By.id('modal')));
            await setElementProperty(input, 'checked', true);
            await getActions().click(openBtn).perform();

            const modalDiv = await querySelector(shadowRoot, '.modal-background');
            (await driver.wait(async () => await modalDiv.getCssValue('opacity'))).includes('1');
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
        it('dialog-close', done  => {
            (async () => {
                await waitForElementEvent(el, 'dialog-close', () => done());
                await getActions().click(openBtn).perform();
                await getActions().click(closeBtn).perform();
            })();
        });
        it('dialog-open', done  => {
            (async () => {
                await waitForElementEvent(el, 'dialog-open', () => done());
                await getActions().click(openBtn).perform();
            })();
        });
    });
});