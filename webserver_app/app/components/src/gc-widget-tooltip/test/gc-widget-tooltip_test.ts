import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getElementProperty, setElementProperty, getActions, getShadowRoot, querySelector } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-tooltip', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let shadowTooltip: WebElement;
    let leftDiv: WebElement;
    let topDiv: WebElement;
    let rightDiv: WebElement;
    let bottomDiv: WebElement;
    let demoDiv: WebElement;

    before(async () => {
        await goto('gc-widget-tooltip/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        shadowTooltip = await driver.findElement(By.tagName('gc-widget-tooltip-shared'));

        demoDiv = await driver.findElement(By.id('demo_container'));
        leftDiv = await querySelector(demoDiv, '#left');
        topDiv = await querySelector(demoDiv, '#top');
        rightDiv = await querySelector(demoDiv, '#right');
        bottomDiv = await querySelector(demoDiv, '#bottom');

    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('position'));
        await setElementProperty(input, 'selectedLabel', 'right');

        input = await driver.findElement(By.id('text'));
        await setElementProperty(input, 'value', 'anchored tooltip!');

        input = await driver.findElement(By.id('anchor_id'));
        await setElementProperty(input, 'selectedLabel', 'left');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('text', async () => {
            const input = await driver.findElement(By.id('text'));
            await setElementProperty(input, 'value', 'hello there!');
            await driver.wait(async () => await getElementProperty(el, 'text') === 'hello there!');
        });

        it('position', async () => {

            let input = await driver.findElement(By.id('position'));
            await setElementProperty(input, 'selectedLabel', 'left');

            // left with left position, should show right
            await getActions().move({ origin: leftDiv }).perform();

            await driver.wait(async () => await getElementProperty(el, 'position') === 'left');
            await (await driver.wait(async () => await shadowTooltip.getAttribute('class'))).includes('right');

            // top with top position, should show bottom
            input = await driver.findElement(By.id('anchor_id'));
            await setElementProperty(input, 'selectedLabel', 'top');
            input = await driver.findElement(By.id('position'));
            await setElementProperty(input, 'selectedLabel', 'top');

            await getActions().move({ origin: topDiv }).perform();

            await driver.wait(async () => await getElementProperty(el, 'position') === 'top');
            await (await driver.wait(async () => await shadowTooltip.getAttribute('class'))).includes('bottom');

            // bottom with bottom position, should show top
            input = await driver.findElement(By.id('anchor_id'));
            await setElementProperty(input, 'selectedLabel', 'bottom');
            input = await driver.findElement(By.id('position'));
            await setElementProperty(input, 'selectedLabel', 'bottom');

            await getActions().move({ origin: bottomDiv }).perform();

            await driver.wait(async () => await getElementProperty(el, 'position') === 'bottom');
            await (await driver.wait(async () => await shadowTooltip.getAttribute('class'))).includes('top');

            // right with right position, should show left
            input = await driver.findElement(By.id('anchor_id'));
            await setElementProperty(input, 'selectedLabel', 'right');
            input = await driver.findElement(By.id('position'));
            await setElementProperty(input, 'selectedLabel', 'right');

            await getActions().move({ origin: rightDiv }).perform();

            await driver.wait(async () => await getElementProperty(el, 'position') === 'right');
            await (await driver.wait(async () => await shadowTooltip.getAttribute('class'))).includes('left');
        });

        it('anchor-id', async () => {
            const input = await driver.findElement(By.id('anchor_id'));
            await setElementProperty(input, 'selectedLabel', 'top');
            topDiv = await driver.findElement(By.id('top'));
            await getActions().move({ origin: topDiv }).perform();

            await driver.wait(async () => await getElementProperty(el, 'anchorId') === 'top');
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