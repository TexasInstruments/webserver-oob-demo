import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, waitForElementEvent } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-port-selection-dialog', () => {
    let el: WebElement;
    let elMenuItem: WebElement;
    let elMenuAction: WebElement;

    before(async () => {
        await goto('gc-widget-port-selection-dialog/demo');

        el = await driver.findElement(By.id('demo_element'));
        elMenuItem = await driver.findElement(By.id('demo_element_menuitem'));
        elMenuAction = await driver.findElement(By.id('demo_element_open_serial'));
    });

    beforeEach(async () => {
    });

    /**
     * Properties
     */
    describe('properties', () => {
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
        it('dialog-open', async () => {
            await elMenuItem.click();
            await elMenuAction.click();
            await waitForElementEvent(el, 'dialog-open', () => {});
        });
    });

});