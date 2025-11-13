/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, invokeElementMethod, waitForNextAnimationFrame } from '../../gc-core-assets/test/SeleniumDriver';
import { expect } from 'chai';

describe('gc-widget-grid', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let gridContent: WebElement;
    let gridScrollBar: WebElement;

    before(async () => {
        await goto('gc-widget-grid/demo');

        el = await driver.findElement(By.id('grid'));

        // Need to wait for demo to be ready, so wait for databinding to set virtual checkbox to true.
        const virtual = (await driver.findElement(By.id('virtual')));
        await driver.wait(async () => await getElementProperty(virtual, 'checked') === true);

        shadowRoot = await getShadowRoot(el);
        gridContent = await shadowRoot.findElement(By.className('grid-content'));
        gridScrollBar = await shadowRoot.findElement(By.className('grid-scrollbar'));
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('virtual'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('smoothScrolling'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('selectedRow'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('filterText'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('sortByColumn'));
        await setElementProperty(input, 'selectedLabel', '');

        input = await driver.findElement(By.id('sortDescending'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('rowHeight'));
        await setElementProperty(input, 'value', '24px');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('virtual', async () => {
            const virtual = (await driver.findElement(By.id('virtual')));
            await setElementProperty(virtual, 'checked', true);
            expect(await getElementProperty(gridContent, 'children.length') as number, 'rows < 50').to.be.lt(50);

            await setElementProperty(virtual, 'checked', false);
            expect(await getElementProperty(gridContent, 'children.length') as number, 'rows === 100').to.equal(100);
        });

        it('smoothScrolling', async () => {
            const gridPadding = await shadowRoot.findElement(By.className('grid-padding'));
            const grid = await shadowRoot.findElement(By.className('grid'));

            const smoothScrolling = (await driver.findElement(By.id('smoothScrolling')));
            await setElementProperty(smoothScrolling, 'checked', true);
            await invokeElementMethod(gridScrollBar, 'scrollBy', 0, 53);
            await waitForNextAnimationFrame();
            expect(Math.round(await getElementProperty(grid, 'scrollTop') as number), 'scrollTop === 53').to.equal(53);
            expect(await getElementProperty(gridPadding, 'style.height'), 'padding = 0px').to.equal('0px');

            await setElementProperty(smoothScrolling, 'checked', false);
            await invokeElementMethod(gridScrollBar, 'scrollBy', 0, -100);
            await waitForNextAnimationFrame();
            expect(await getElementProperty(grid, 'scrollTop'), 'scrollTop === 0').to.equal(0);
            await invokeElementMethod(gridScrollBar, 'scrollBy', 0, 53);
            await waitForNextAnimationFrame();
            expect(await getElementProperty(grid, 'scrollTop'), 'scrollTop === 48').to.equal(48);
            expect(await getElementProperty(gridPadding, 'style.height'), 'padding = 24px').to.equal('24px');
        });

        it('selectedRow', async () => {
            await invokeElementMethod(gridScrollBar, 'scrollBy', 0, -2400);  // make sure scrolled to top.
            await (await shadowRoot.findElement(By.id('2,1'))).click();
            await waitForNextAnimationFrame();
            expect(await getElementProperty(el, 'selectedRow'), 'selectedRow === 2').to.equal(2);
            expect(await getElementProperty(el, 'selectedPath')).to.equal('This is folder #2');

            const selectedPath = (await driver.findElement(By.id('selectedPath')));
            await setElementProperty(selectedPath, 'value', 'This is folder #8/This is child folder #0');
            expect(await getElementProperty(el, 'selectedRow'), 'selectedRow === -1').to.equal(-1);
        });

        it('selectedPath', async () => {
            const selectedRow = (await driver.findElement(By.id('selectedRow')));
            await setElementProperty(selectedRow, 'value', 6);
            expect(await getElementProperty(el, 'selectedRow'), 'selectedRow === 6').to.equal(6);
            expect(await getElementProperty(el, 'selectedPath')).to.equal('This is folder #6');
        });

        it('filterText', async () => {
            await driver.actions().doubleClick(await shadowRoot.findElement(By.id('2,1'))).perform();

            const filterText = (await driver.findElement(By.id('filterText')));
            await setElementProperty(filterText, 'value', 'folder #2');

            expect(await getElementProperty(gridContent, 'children.length'), 'rows = 12').to.equal(12);
            await invokeElementMethod(el, 'toggleOpen', 0);
            await waitForNextAnimationFrame();
            expect(await getElementProperty(gridContent, 'children.length'), 'rows = 11').to.equal(11);
        });

        it('sortByColumn', async () => {
            const sortByColumn = (await driver.findElement(By.id('sortByColumn')));
            await setElementProperty(sortByColumn, 'selectedLabel', 'Description');
            const firstRow = await shadowRoot.findElement(By.css('[id="0,2"] span'));
            expect((await firstRow.getText()).trim(), 'row #2,2 description').to.equal('This is the eighteenth row.');
            expect(await getElementProperty(gridContent, 'children.length'), 'rows === 100').to.equal(100);
        });

        it('sortDescending', async () => {
            const sortDescending = (await driver.findElement(By.id('sortDescending')));
            await setElementProperty(sortDescending, 'checked', true);
            const sortByColumn = (await driver.findElement(By.id('sortByColumn')));
            await setElementProperty(sortByColumn, 'selectedLabel', 'Description');
            const lastRow = await shadowRoot.findElement(By.css('[id="99,2"] span'));
            expect((await lastRow.getText()).trim(), 'row #99,2 description').to.equal('This is the eighteenth row.');
            expect(await getElementProperty(gridContent, 'children.length'), 'rows === 100').to.equal(100);
        });
    });
});