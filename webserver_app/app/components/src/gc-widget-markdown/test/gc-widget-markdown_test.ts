import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, setElementProperty, getShadowRoot } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-markdown', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let markedHTML: WebElement;

    before(async () => {
        await goto('gc-widget-markdown/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        markedHTML = shadowRoot.findElement(By.id('markdown'));
    });

    beforeEach(async () => {
        const input = await driver.findElement(By.id('file'));
        await setElementProperty(input, 'selectedLabel', 'demo.md');

    });
    /**
     * Properties
     */
    describe('properties', () => {
        it('file', async () => {

            await driver.wait(async () => (await markedHTML.getText()).includes('The following is done in Markdown.'));

            const input = await driver.findElement(By.id('file'));
            await setElementProperty(input, 'selectedLabel', 'usage.md');

            await driver.wait(async () => (await markedHTML.getText()).includes('<gc-widget-markdown file="readme.md"></gc-widget-markdown>'));
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