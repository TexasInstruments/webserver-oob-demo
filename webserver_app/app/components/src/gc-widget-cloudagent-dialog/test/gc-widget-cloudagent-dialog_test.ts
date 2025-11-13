import { WebElement, By } from 'selenium-webdriver';
import { default as chai, expect } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, querySelectorAll, invokeElementMethod } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-cloudagent-dialog', () => {
    let el: WebElement;
    let shadowDialog: WebElement;
    let shadowDialogRoot: WebElement;
    let option: WebElement;

    before(async () => {
        await goto('gc-widget-cloudagent-dialog/demo');

        option = await driver.findElement(By.id('options'));
        el = await driver.findElement(By.id('demo_element'));
        shadowDialogRoot = await getShadowRoot(el);
        shadowDialog = await querySelector(shadowDialogRoot, 'gc-widget-dialog');
        shadowDialogRoot = await getShadowRoot(shadowDialog);
    });

    beforeEach(async () => {
        await setElementProperty(option, 'selectedLabel', '');
        await invokeElementMethod(shadowDialog, 'close');
    });

    /**
     * CloudAgent error options
     */
    describe('CloudAgent error options', () => {
        it('heading', async () => {
            await setElementProperty(option, 'selectedLabel', 'Agent Not Started');
            await driver.wait(async () => await (await querySelector(shadowDialogRoot, 'h1[id="heading"]')).getText() === 'TI Cloud Agent Setup');
        });

        it('description', async () => {
            await setElementProperty(option, 'selectedLabel', 'Agent Not Started');
            await driver.wait(async () => (await (await querySelector(shadowDialog, 'div[id="description-container"]')).getText()).includes('AGENT_NOT_STARTED'));
        });

        it('helplink', async () => {
            await setElementProperty(option, 'selectedLabel', 'Agent Not Started');
            const helpLink = await querySelector(shadowDialog, 'div[id="helplink-container"] gc-widget-button');
            expect(await getElementProperty(helpLink, 'label')).contains('Help.');
        });

        it('Agent Not Started', async () => {
            await setElementProperty(option, 'selectedLabel', 'Agent Not Started');

            const steps = await querySelectorAll(shadowDialog, 'div[id="steps-container"] div[class="step"]');
            expect(steps.length).eq(1);
            const downloadLink = await querySelector(steps[0], 'gc-widget-button');
            expect(await getElementProperty(downloadLink, 'label')).eq('Download');
        });

        it('Invalid Agent Version', async () => {
            await setElementProperty(option, 'selectedLabel', 'Invalid Agent Version');

            const steps = await querySelectorAll(shadowDialog, 'div[id="steps-container"] div[class="step"]');
            expect(steps.length).eq(1);
            const downloadLink = await querySelector(steps[0], 'gc-widget-button');
            expect(await getElementProperty(downloadLink, 'label')).eq('Download');
        });

        it('Invalid Extension Version', async () => {
            await setElementProperty(option, 'selectedLabel', 'Invalid Extension Version');

            const steps = await querySelectorAll(shadowDialog, 'div[id="steps-container"] div[class="step"]');
            expect(steps.length).eq(1);
            const installLink = await querySelector(steps[0], 'gc-widget-button');
            expect(await getElementProperty(installLink, 'label')).eq('Install');
        });

        it('Missing Extension', async () => {
            await setElementProperty(option, 'selectedLabel', 'Missing Extension');

            const steps = await querySelectorAll(shadowDialog, 'div[id="steps-container"] div[class="step"]');
            expect(steps.length).eq(2);
            const installLink = await querySelector(steps[0], 'gc-widget-button');
            expect(await getElementProperty(installLink, 'label')).eq('Install');
            const downloadLink = await querySelector(steps[1], 'gc-widget-button');
            expect(await getElementProperty(downloadLink, 'label')).eq('Download');
        });
    });
});