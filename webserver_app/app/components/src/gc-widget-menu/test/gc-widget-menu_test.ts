import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getActions, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent, invokeElementMethod } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

let elMenuBar: WebElement;
let elMenuItem: WebElement;
let elMenuAction: WebElement;
let elOutput: WebElement;

const doBefore = async () => {
    await goto('gc-widget-menu/demo');

    elMenuBar = await driver.findElement(By.id('demo_element_menubar'));
    elMenuItem = await driver.findElement(By.id('demo_element_menuitem'));
    elMenuAction = await driver.findElement(By.id('demo_element_menuaction'));
    elOutput = await driver.findElement(By.id('output'));
};

const doBeforeEach = async () => {
    let input = await driver.findElement(By.id('open_on_hover'));
    await setElementProperty(input, 'checked', true);

    input = await driver.findElement(By.id('product_name'));
    await setElementProperty(input, 'value', 'MenuBar');

    input = await driver.findElement(By.id('product_icon'));
    await setElementProperty(input, 'value', 'objects:chip');

    input = await driver.findElement(By.id('product_icon_folder_path'));
    await setElementProperty(input, 'value', '');

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

describe('gc-widget-menubar', () => {
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
        it('open-on-hover', async () => {
            const input = await driver.findElement(By.id('open_on_hover'));
            await getActions().move({ origin: elMenuItem }).perform();

            const subMenu = await querySelector(await getShadowRoot(elMenuItem), '#sub-menu');
            await driver.wait(async () => await subMenu.getCssValue('display') === 'flex');

            await (await driver.findElement(By.id('output'))).click();
            await setElementProperty(input, 'checked', false);
            await getActions().move({ origin: elMenuItem }).perform();
            await expect(driver.wait(async () => await subMenu.getCssValue('display') !== 'flex', 500)).to.be.fulfilled;
        });

        it('product-name', async () => {
            const input = await driver.findElement(By.id('product_name'));
            await setElementProperty(input, 'value', 'foobar');

            const shadowRoot = await getShadowRoot(elMenuBar);
            const productName = await querySelector(shadowRoot, '#product-name');
            await driver.wait(async () => await productName.getText() === 'foobar');
        });

        it('product-icon', async () => {
            const input = await driver.findElement(By.id('product_icon'));
            await setElementProperty(input, 'value', 'object:list');

            const shadowRoot = await getShadowRoot(elMenuBar);
            const productIcon = await querySelector(shadowRoot, '#product-icon');
            await driver.wait(async () => await getElementProperty(productIcon, 'icon') === 'object:list');
        });

        it('product-icon-folder-path', async () => {
            const input = await driver.findElement(By.id('product_icon_folder_path'));
            await setElementProperty(input, 'value', '../../assets/icons/');

            const shadowRoot = await getShadowRoot(elMenuBar);
            const productIcon = await querySelector(shadowRoot, '#product-icon');
            await driver.wait(async () => await getElementProperty(productIcon, 'path') === '../../assets/icons/');
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
        it('product-name-clicked', done  => {
            (async () => {
                await waitForElementEvent(elMenuBar, 'product-name-clicked', () => done());

                const productContainer = await querySelector(await getShadowRoot(elMenuBar), '#product-container');
                productContainer.click();
            })();
        });
    });
});

[
    { name: 'gc-widget-menuitem', demoElement: 'menuitem' },
    { name: 'gc-widget-menuaction', demoElement: 'menuaction' }
].forEach(({ name, demoElement }) => {
    describe(`${name}`, () => {
        let el: WebElement;

        before(async () => {
            await doBefore();
            el = await driver.findElement(By.id(`demo_element_${demoElement}`));
        });

        beforeEach(async () => {
            await doBeforeEach();
        });

        /**
         * Properties
         */
        describe('properties', () => {
            it('label', async () => {
                const input = await driver.findElement(By.id(`${demoElement}_label`));
                await setElementProperty(input, 'value', 'foobar');

                const label = await querySelector(await getShadowRoot(el), '#label');
                await driver.wait(async () => await label.getText() === 'foobar');
            });

            it('icon', async () => {
                const input = await driver.findElement(By.id(`${demoElement}_icon`));
                await setElementProperty(input, 'value', 'objects:list');

                const shadowRoot = await getShadowRoot(el);
                const icon = await querySelector(shadowRoot, 'gc-widget-icon');
                await driver.wait(async () => await getElementProperty(icon, 'icon') === 'objects:list');
            });

            it('icon-folder-path', async () => {
                let input = await driver.findElement(By.id(`${demoElement}_icon_folder_path`));
                await setElementProperty(input, 'value', '../../assets/icons/');

                input = await driver.findElement(By.id(`${demoElement}_icon`));
                await setElementProperty(input, 'value', 'objects:list');

                const shadowRoot = await getShadowRoot(el);
                const icon = await querySelector(shadowRoot, 'gc-widget-icon');
                await driver.wait(async () => await getElementProperty(icon, 'path') === '../../assets/icons/');
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

        if (name === 'gc-widget-menuaction') {
            describe('ActionRegistry', () => {
                before(async () => {
                    await doBefore();
                });

                beforeEach(async () => {
                    await doBeforeEach();
                });

                it('run', async ()  => {
                    await elMenuItem.click();
                    await elMenuAction.click();
                    await driver.wait(async () => (await elOutput.getText()).includes('cmd_exit'));
                });

                it('isChecked', async () => {
                    const settings = await driver.findElement(By.id('demo_element_settings'));
                    const editor = await driver.findElement(By.id('demo_element_editor'));
                    const autoSave = await driver.findElement(By.id('demo_element_auto_save'));

                    await settings.click();
                    await editor.click();
                    const icon = await querySelector(await getShadowRoot(autoSave), 'gc-widget-icon');
                    await driver.wait(async () => (await icon.getCssValue('background-color')).includes('35, 31, 32, 0.25'));

                    await settings.click();
                    await editor.click();
                    await autoSave.click();

                    await settings.click();
                    await editor.click();
                    await driver.wait(async () => (await icon.getCssValue('background-color')).includes('0, 0, 0, 0'));
                });

                it('isEnabled', async () => {
                    const print = await driver.findElement(By.id('demo_element_print'));
                    await expect(print.click()).to.be.rejectedWith();
                });

                it('isVisible', async () => {
                    const notVisible = await driver.findElement(By.id('demo_element_not_visible'));
                    expect(await notVisible.getCssValue('display')).eq('none');
                });
            });
        }
    });
});