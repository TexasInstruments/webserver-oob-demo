import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, waitForElementEvent, querySelector, querySelectorAll } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

describe('gc-widget-tab-container-navbar', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tabContainer: WebElement;

    before(async () => {
        await goto('gc-widget-tab/demo/navbar.html');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);

        tabContainer = await driver.findElement(By.id('demo_tab_container'));
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('tab_container_id'));
        await setElementProperty(input, 'selectedLabel', '');

        input = await driver.findElement(By.id('excluded_tab_panel_ids'));
        await setElementProperty(input, 'selectedLabel', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('tab-container-id', async () => {
            const input = await driver.findElement(By.id('tab_container_id'));
            await driver.wait(async () => (await querySelectorAll(shadowRoot, '.button')).length === 3);

            await setElementProperty(input, 'selectedLabel', 'not_a_tab_container');
            await driver.wait(async () => (await querySelectorAll(shadowRoot, '.button')).length === 0);

            await setElementProperty(input, 'selectedLabel', 'demo_tab_container');
            await driver.wait(async () => (await querySelectorAll(shadowRoot, '.button')).length === 3);

            await setElementProperty(input, 'selectedLabel', 'not_a_tab_container');
            await driver.wait(async () => (await querySelectorAll(shadowRoot, '.button')).length === 0);

            await setElementProperty(input, 'selectedLabel', '');
            await driver.wait(async () => (await querySelectorAll(shadowRoot, '.button')).length === 3);
        });

        it('excluded-tab-panel-ids', async () => {
            const getVisibleButtons = async () => {
                const buttons = await querySelectorAll(shadowRoot, '.button');
                let count = 0;
                for (let i = 0; i < buttons.length; ++i) {
                    const isHidden = await buttons[i].getAttribute('hidden');
                    count = !isHidden ? count+1 : count;
                }
                return count;
            };

            const input = await driver.findElement(By.id('excluded_tab_panel_ids'));
            await driver.wait(async () => await getVisibleButtons() === 3);

            await setElementProperty(input, 'selectedLabel', 'intro');
            await driver.wait(async () => await getVisibleButtons() === 2);

            await setElementProperty(input, 'selectedLabel', 'intro,search');
            await driver.wait(async () => await getVisibleButtons() === 1);
        });
    });

    /**
     * Events
     */
    describe('events', () => {
        it('click', async () => {
            const buttons = await querySelectorAll(shadowRoot, '.button');
            await buttons[1].click();

            await driver.wait(async () => await getElementProperty(tabContainer, 'index') === 1);
        });
    });
});