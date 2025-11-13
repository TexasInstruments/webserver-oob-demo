import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getShadowRoot, querySelector, setElementProperty, getElementProperty, invokeElementMethod, querySelectorAll } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-message-dialog', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let openDemoBtn: WebElement;
    let shadowDialog: WebElement;
    let shadowDialogRoot: WebElement;
    let cancelBtn: WebElement;

    before(async () => {
        await goto('gc-widget-message-dialog/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        openDemoBtn = await driver.findElement(By.id('demoBtn'));
        shadowDialog = await querySelector(shadowRoot, 'gc-widget-dialog');
        shadowDialogRoot = await getShadowRoot(shadowDialog);
        cancelBtn = await querySelector(shadowDialog, 'gc-widget-button.message-cancel');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('heading'));
        await setElementProperty(input, 'value', 'Heading Title');

        input = await driver.findElement(By.id('message'));
        await setElementProperty(input, 'value', 'content message');

        input = await driver.findElement(By.id('icon'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('hasProgress'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('minValue'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('maxValue'));
        await setElementProperty(input, 'value', 100);

        input = await driver.findElement(By.id('value'));
        await setElementProperty(input, 'checked', '42');

        input = await driver.findElement(By.id('hasCancel'));
        await setElementProperty(input, 'checked', true);

        input = await driver.findElement(By.id('hasOk'));
        await setElementProperty(input, 'checked', true);

    });

    afterEach(async () => {
        const dialogDiv = (await querySelector(shadowDialogRoot, '#dialog-div'));
        if (await dialogDiv.isDisplayed()) {
            await cancelBtn.click();
        }
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('heading', async () => {
            await openDemoBtn.click();
            await driver.wait(async () => {
                const heading = await (await querySelector(shadowDialogRoot, '#heading')).getText();
                return heading  === 'Heading Title';
            });
        });

        it('message', async () => {
            await openDemoBtn.click();
            await driver.wait(async () => {
                const text = await (await querySelector(shadowDialog, '#content-message')).getText();
                return text === 'content message';
            });
        });

        it('icon', async () => {
            const input = await driver.findElement(By.id('icon'));
            await setElementProperty(input, 'value', 'action:announcement');

            await openDemoBtn.click();
            await driver.wait(async () => {
                const iconElement = await querySelector(shadowDialogRoot, 'gc-widget-icon');
                const iconName = await getElementProperty(iconElement, 'icon');
                return iconName === 'action:announcement';
            });
        });

        it('progressbar', async () => {
            let input = await driver.findElement(By.id('hasProgress'));
            await setElementProperty(input, 'checked', true);
            input = await driver.findElement(By.id('minValue'));
            await setElementProperty(input, 'value', 10);
            input = await driver.findElement(By.id('maxValue'));
            await setElementProperty(input, 'value', 30);
            input = await driver.findElement(By.id('value'));
            await setElementProperty(input, 'value', 18);

            await openDemoBtn.click();
            await driver.wait(async () => {
                const bar = await querySelector(shadowRoot, 'gc-widget-progressbar');
                return bar !== undefined;
            });

            const shadowBar = await querySelector(shadowDialog, 'gc-widget-progressbar');
            await driver.wait(async () => await getElementProperty(shadowBar, 'minValue') === 10);
            await driver.wait(async () => await getElementProperty(shadowBar, 'maxValue') === 30);
            await driver.wait(async () => await getElementProperty(shadowBar, 'value') === 18);
        });

        it('hasCancel', async () => {
            const input = await driver.findElement(By.id('hasCancel'));
            await setElementProperty(input, 'checked', false);

            await openDemoBtn.click();
            try {
                await driver.wait(async () => {
                    const shadowButtonList = await querySelectorAll(shadowDialog, 'gc-widget-button');
                    return shadowButtonList.length === 1 &&
                        (await shadowButtonList[0].getAttribute('class')).includes('message-ok');
                });
            } finally {
                invokeElementMethod(el, 'close');
            }
        });

        it('hasOk', async () => {
            const input = await driver.findElement(By.id('hasOk'));
            await setElementProperty(input, 'checked', false);

            await openDemoBtn.click();
            try {
                await driver.wait(async () => {
                    const shadowButtonList = await querySelectorAll(shadowDialog, 'gc-widget-button');
                    return shadowButtonList.length === 1 &&
                        (await shadowButtonList[0].getAttribute('class')).includes('message-cancel');
                });
            } finally {
                invokeElementMethod(el, 'close');
            }
        });
    });
});