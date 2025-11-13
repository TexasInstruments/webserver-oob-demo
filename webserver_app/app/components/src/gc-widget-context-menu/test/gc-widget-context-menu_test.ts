import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getActions, getElementProperty, setElementProperty, getShadowRoot, querySelector } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

let elContextMenu: WebElement;
let elContextMenuItem: WebElement;
let elMenuAction: WebElement;
let elOutput: WebElement;

const doBefore = async () => {
    await goto('gc-widget-context-menu/demo');

    elContextMenu = await driver.findElement(By.id('demo_element'));
    elContextMenuItem = await driver.findElement(By.id('demo_element_menuitem'));
    elMenuAction = await driver.findElement(By.id('demo_element_menuaction'));
    elOutput = await driver.findElement(By.id('output'));
};

const doBeforeEach = async () => {
    let input = await driver.findElement(By.id('anchor_id'));
    await setElementProperty(input, 'selectedLabel', 'top');

    input = await driver.findElement(By.id('menuitem_label'));
    await setElementProperty(input, 'value', 'File');

    input = await driver.findElement(By.id('menuitem_icon'));
    await setElementProperty(input, 'value', '');

    input = await driver.findElement(By.id('menuitem_icon_folder_path'));
    await setElementProperty(input, 'value', '');

    input = await driver.findElement(By.id('menuaction_label'));
    await setElementProperty(input, 'value', 'Exit');

    input = await driver.findElement(By.id('menuaction_icon'));
    await setElementProperty(input, 'value', '');

    input = await driver.findElement(By.id('menuaction_icon_folder_path'));
    await setElementProperty(input, 'value', '');
};

describe('gc-widget-context-menu', () => {

    before(async () => {
        await doBefore();
    });

    beforeEach(async () => {
        await doBeforeEach();
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('anchor-id', async () => {
            const input = await driver.findElement(By.id('anchor_id'));
            const bottomDiv = await driver.findElement(By.id('bottom'));
            const topDiv = await driver.findElement(By.id('top'));

            await setElementProperty(input, 'selectedValue', 'bottom');
            await getActions().contextClick(bottomDiv).perform();
            await driver.wait(async () => await getElementProperty(elContextMenu, 'anchorId') === 'bottom');
            await driver.wait(async () => (await elContextMenu.getCssValue('display')).includes('flex'));

            await getActions().click(topDiv).perform();
            await getActions().contextClick(topDiv).perform();
            await driver.wait(async () => (await elContextMenu.getCssValue('display')).includes('none'));

            // unset to parent element (viewport)
            await setElementProperty(input, 'selectedValue', '');
            await getActions().contextClick(bottomDiv).perform();
            await driver.wait(async () => await getElementProperty(elContextMenu, 'anchorId') === '');
            await driver.wait(async () => (await elContextMenu.getCssValue('display')).includes('flex'));


            await getActions().contextClick(topDiv).perform();
            await driver.wait(async () => (await elContextMenu.getCssValue('display')).includes('flex'));
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