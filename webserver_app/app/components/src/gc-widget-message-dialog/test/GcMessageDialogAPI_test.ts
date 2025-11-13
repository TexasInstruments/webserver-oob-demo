import { By, WebElement } from 'selenium-webdriver';
import { goto, driver, getShadowRoot, querySelector, setElementProperty, getElementProperty, invokeElementMethod, querySelectorAll, documentQuerySelectorAll } from '../../gc-core-assets/test/SeleniumDriver';

const waitForDialogToOpen = async (heading: string): Promise<undefined | {
    dialog: WebElement; shadowRoot: ShadowRoot; shadowDialog: WebElement; shadowDialogRoot: ShadowRoot; shadowDiv: WebElement
}> => {
    let result = undefined;
    await driver.wait(async () => {
        const dialogs = await documentQuerySelectorAll('gc-widget-message-dialog');

        for (const dialog of dialogs) {
            const shadowRoot = await getShadowRoot(dialog);
            const shadowDialog = await querySelector(shadowRoot, 'gc-widget-dialog');
            const shadowDialogRoot = await getShadowRoot(shadowDialog);
            const dialogDiv = (await querySelector(shadowDialogRoot, '#dialog-div'));
            if (dialogDiv.isDisplayed()) {
                const text = await (await querySelector(shadowDialogRoot, '#heading')).getText();
                if (text === heading) {
                    result = {
                        dialog: dialog,
                        shadowRoot: shadowRoot,
                        shadowDialog: shadowDialog,
                        shadowDialogRoot: shadowDialogRoot,
                        dialogDiv: dialogDiv
                    };
                    return true;
                }
            }
        }
        return false;
    });
    return result;
};

const closeDialog = async (dialog: WebElement) => {
    await invokeElementMethod(dialog, 'close', 'dismiss');
};

describe('GCMessageDialogAPI', () => {
    before(async () => {
        await goto('gc-widget-message-dialog/demo');
    });

    afterEach(async () => {
        const dialogs = await documentQuerySelectorAll('gc-widget-message-dialog');
        for (const dialog of dialogs) {
            await closeDialog(dialog);
        }
    });

    it('alert', async () => {
        const btn = await driver.findElement(By.id('demoAlertBtn'));
        await btn.click();
        const result = await waitForDialogToOpen('Alert');

        // @ts-ignore
        const content = await querySelector(result.shadowDialog, '#content-message');
        await driver.wait(async () => await content.getText() === 'Alert message...');

        await driver.wait(async () => {
            // @ts-ignore
            const shadowButtonList = await querySelectorAll(result.shadowDialog, 'gc-widget-button');
            return shadowButtonList.length === 1 && (await shadowButtonList[0].getAttribute('class')).includes('message-ok');
        });
    });

    it('info', async () => {
        const btn = await driver.findElement(By.id('demoInfoBtn'));
        await btn.click();
        const result = await waitForDialogToOpen('Info');

        // @ts-ignore
        const content = await querySelector(result.shadowDialog, '#content-message');
        await driver.wait(async () => await content.getText() === 'Info message...');

        await driver.wait(async () => {
            // @ts-ignore
            const shadowButtonList = await querySelectorAll(result.shadowDialog, 'gc-widget-button');
            return shadowButtonList.length === 1 && (await shadowButtonList[0].getAttribute('class')).includes('message-ok');
        });

        await driver.wait(async () => {
            // @ts-ignore
            const iconElement = await querySelector(result.shadowDialogRoot, 'gc-widget-icon');
            const iconName = await getElementProperty(iconElement, 'icon');
            return iconName === 'action:info';
        });
    });

    it('warning', async () => {
        const btn = await driver.findElement(By.id('demoWarningBtn'));
        await btn.click();
        const result = await waitForDialogToOpen('Warning');

        // @ts-ignore
        const content = await querySelector(result.shadowDialog, '#content-message');
        await driver.wait(async () => await content.getText() === 'Warning message...');

        await driver.wait(async () => {
            // @ts-ignore
            const shadowButtonList = await querySelectorAll(result.shadowDialog, 'gc-widget-button');
            return shadowButtonList.length === 1 && (await shadowButtonList[0].getAttribute('class')).includes('message-ok');
        });

        await driver.wait(async () => {
            // @ts-ignore
            const iconElement = await querySelector(result.shadowDialogRoot, 'gc-widget-icon');
            const iconName = await getElementProperty(iconElement, 'icon');
            return iconName === 'alert:warning';
        });
    });

    it('error', async () => {
        const btn = await driver.findElement(By.id('demoErrorBtn'));
        await btn.click();
        const result = await waitForDialogToOpen('Error');

        // @ts-ignore
        const content = await querySelector(result.shadowDialog, '#content-message');
        await driver.wait(async () => await content.getText() === 'Error message...');

        await driver.wait(async () => {
            // @ts-ignore
            const shadowButtonList = await querySelectorAll(result.shadowDialog, 'gc-widget-button');
            return shadowButtonList.length === 1 && (await shadowButtonList[0].getAttribute('class')).includes('message-ok');
        });

        await driver.wait(async () => {
            // @ts-ignore
            const iconElement = await querySelector(result.shadowDialogRoot, 'gc-widget-icon');
            const iconName = await getElementProperty(iconElement, 'icon');
            return iconName === 'alert:error';
        });
    });

    it('prompt', async () => {
        const btn = await driver.findElement(By.id('demoPromptBtn'));
        await btn.click();
        const result = await waitForDialogToOpen('Prompt');

        // @ts-ignore
        const content = await querySelector(result.shadowDialog, '#content-message');
        await driver.wait(async () => await content.getText() === 'Prompt message...');

        await driver.wait(async () => {
            // @ts-ignore
            const shadowButtonList = await querySelectorAll(result.shadowDialog, 'gc-widget-button');
            return shadowButtonList.length === 2 &&
                (await shadowButtonList[0].getAttribute('class')).includes('message-cancel') &&
                (await shadowButtonList[1].getAttribute('class')).includes('message-ok');
        });

        await driver.wait(async () => {
            // @ts-ignore
            const iconElement = await querySelector(result.shadowDialogRoot, 'gc-widget-icon');
            const iconName = await getElementProperty(iconElement, 'icon');
            return iconName === 'action:info';
        });
    });

    it('progress', async () => {
        const btn = await driver.findElement(By.id('demoProgressBtn'));
        await btn.click();
        const result = await waitForDialogToOpen('Flash Device');

        // @ts-ignore
        const content = await querySelector(result.shadowDialog, '#content-message');
        await driver.wait(async () => await content.getText() === 'Loading program on device...');

        await driver.wait(async () => {
            // @ts-ignore
            const shadowButtonList = await querySelectorAll(result.shadowDialog, 'gc-widget-button');
            return shadowButtonList.length === 2 &&
                (await shadowButtonList[0].getAttribute('class')).includes('message-cancel') &&
                (await shadowButtonList[1].getAttribute('class')).includes('message-ok');
        });

        await driver.wait(async () => {
            // @ts-ignore
            const progress = await querySelector(result.shadowDialog, 'gc-widget-progressbar');
            const value = await getElementProperty<number>(progress, 'value');
            const message = await getElementProperty<string>(progress, 'message');
            return value >= 100 && message === 'Done!';
        });
    });
});