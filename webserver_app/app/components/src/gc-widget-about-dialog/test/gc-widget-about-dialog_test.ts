import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, setElementProperty, getShadowRoot, querySelector, querySelectorAll } from '../../gc-core-assets/test/SeleniumDriver';

const TIMEOUT = 1000;

describe('gc-widget-about-dialog', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let openDialogButton: WebElement;

    before(async () => {
        await goto('gc-widget-about-dialog/demo');
        el = await driver.findElement(By.id('demo_element'));
        openDialogButton = await driver.findElement(By.id('open_btn'));
        shadowRoot = await getShadowRoot(el);
    });

    beforeEach(async () => {
        let input = (await driver.findElement(By.id('app_manifest_link')));
        await setElementProperty(input, 'value', '');

        input = (await driver.findElement(By.id('app_license_link')));
        await setElementProperty(input, 'value', '');

        input = (await driver.findElement(By.id('app_info_text')));
        await setElementProperty(input, 'value', '');

        input = (await driver.findElement(By.id('app_info_text_heading')));
        await setElementProperty(input, 'value', '');
    });

    afterEach(async () => {
        (await shadowRoot.findElement(By.css('gc-widget-button'))).click();
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('default', async () => {
            await driver.executeScript('arguments[0].click()', openDialogButton);

            let appGrid: WebElement[] = [];
            await driver.wait(async () => {
                appGrid = await querySelectorAll(shadowRoot, '#application-grid div:not([class*=label])');
                return appGrid.length === 3;
            }, TIMEOUT, 'Application info should have 3 pieces of information');

            await driver.wait(async () => await appGrid[0].getText() === 'Demo', TIMEOUT);
            await driver.wait(async () => await appGrid[1].getText() === '1.0.0', TIMEOUT);
            await driver.wait(async () => await appGrid[2].getText() === 'Not published yet', TIMEOUT);

            let softwareGrid: WebElement[] = [];
            await driver.wait(async () => {
                softwareGrid = await querySelectorAll(shadowRoot, '#software-grid div:not([class*=label])');
                return softwareGrid.length === 18;
            }, TIMEOUT, 'Software info should have 6 pieces of information');

            await driver.wait(async () => await softwareGrid[2].getText() === 'TSPA_Modified.pdf', TIMEOUT, 'license not found');
            await driver.wait(async () => await softwareGrid[5].getText() === 'GUI_Composer_manifest.html', TIMEOUT, 'manifest not found');
            await driver.wait(async () => await softwareGrid[8].getText() === 'https://dev.ti.com/gc/', TIMEOUT, 'GC lib not found');
            await driver.wait(async () => await softwareGrid[11].getText() === 'https://stenciljs.com/', TIMEOUT, 'Stencil not found');
            await driver.wait(async () => await softwareGrid[14].getText() === 'license.txt', TIMEOUT, 'custom license not found');
            await driver.wait(async () => await softwareGrid[17].getText() === 'manifest.txt', TIMEOUT, 'custom manifest not found');

            const detailText = await querySelector(shadowRoot, '#additional-info-detail');
            await driver.wait(async () => await detailText.getText() === 'Demo info...', TIMEOUT, 'Custom detail info not found');
        });

        it('custom', async () => {
            let input = (await driver.findElement(By.id('app_manifest_link')));
            await setElementProperty(input, 'value', 'custom_manifest.txt');

            input = (await driver.findElement(By.id('app_license_link')));
            await setElementProperty(input, 'value', 'custom_license.txt');

            input = (await driver.findElement(By.id('app_info_text')));
            await setElementProperty(input, 'value', 'custom_info_text');

            input = (await driver.findElement(By.id('app_info_text_heading')));
            await setElementProperty(input, 'value', 'custom_heading');

            await driver.executeScript('arguments[0].click()', openDialogButton);

            let softwareGrid: WebElement[] = [];
            await driver.wait(async () => {
                softwareGrid = await querySelectorAll(shadowRoot, '#software-grid div:not([class*=label])');
                return softwareGrid.length === 18;
            }, TIMEOUT, 'Software info should have 6 pieces of information');

            await driver.wait(async () => await softwareGrid[14].getText() === 'custom_license.txt', TIMEOUT, 'custom license not found');
            await driver.wait(async () => await softwareGrid[17].getText() === 'custom_manifest.txt', TIMEOUT, 'custom manifest not found');

            const detailText = await querySelector(shadowRoot, '#additional-info-detail');
            await driver.wait(async () => await detailText.getText() === 'custom_info_text', TIMEOUT, 'Custom detail info not found');

            const detailTextHeading = (await querySelectorAll(shadowRoot, 'h2'))[2];
            await driver.wait(async () => await detailTextHeading.getText() === 'custom_heading', TIMEOUT, 'Custom detail info heading not found');
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
});