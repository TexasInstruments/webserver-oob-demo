import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, waitForNextAnimationFrame, findVisibleElements } from '../../gc-core-assets/test/SeleniumDriver';
import { expect } from 'chai';

async function verifyTreeState(grid: WebElement, progressCount: number, closed: number, open: number, infos: number) {
    const progress = await grid.findElements(By.className('progress'));
    expect(progress.length, 'number of progress divs').to.equal(progressCount);
    if (progressCount > 0) {
        // wait for progress to complete.
        await driver.wait( async () => (await grid.findElements(By.className('progress'))).length === 0);
    }

    const closedBranches = await grid.findElements(By.css('label[part="closed branch"]'));
    expect(closedBranches.length, 'number of closed branches').to.equal(closed);
    const openBranches = await grid.findElements(By.css('label[part="open branch"]'));
    expect(openBranches.length, 'number of open branches').to.equal(open);
    const infoIcons  = await findVisibleElements(grid, By.css('.icon.info'));
    expect(infoIcons.length, 'number of info icons').to.equal(infos);
}

describe('gc-widget-grid-tree-column', () => {
    let grid: WebElement;
    let treeColumn: WebElement;

    before(async () => {
        await goto('gc-widget-grid/demo/treeColumn');

        // Need to wait for demo to be ready, so wait for data binding to set heading to 'Data Column'.
        const heading = await driver.findElement(By.id('heading'));
        await driver.wait(async () => await getElementProperty(heading, 'value') === 'Tree Column');

        grid = await getShadowRoot(await driver.findElement(By.id('grid')));
        treeColumn = await getShadowRoot(await driver.findElement(By.id('tree')));
    });

    beforeEach(async () => {
        setElementProperty('heading', 'value', 'Tree Column');
        setElementProperty('showInfoIcon', 'checked', false);
        setElementProperty('hideMinimizeAction', 'checked', false);
        setElementProperty('minimized', 'checked', false);
        setElementProperty('hidden', 'checked', false);
        setElementProperty('headingAlign', 'selectedLabel', 'center');
        await setElementProperty('columnWidth', 'value', '260px');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('heading', async () => {
            const dataCell = await grid.findElement(By.id('0,0'));
            const startWidth = await getElementProperty(dataCell, 'clientWidth') as number;
            const  newHeading = 'This is a new title that is very long so as to cause an ellipsis to appear';
            await setElementProperty('heading', 'value', newHeading);

            const header = await treeColumn.findElement(By.css('.header-container label'));
            expect(await header.getText()).to.equal(newHeading);
            const width = await getElementProperty(dataCell, 'clientWidth') as number;
            expect(width).to.equal(startWidth);  // fixed size header shouldn't grow when title is longer than the width.
        });

        it('showInfoIcon', async () => {
            await verifyTreeState(grid, 0, 12, 0, 0);

            const playArrow = await grid.findElement(By.css('.grid-column[id="1,0"] .icon'));
            await playArrow.click();
            await waitForNextAnimationFrame();
            await verifyTreeState(grid, 1, 19, 1, 0);

            const label = await grid.findElement(By.css('.grid-column[id="4,0"] label.flex'));
            const topicIcon = await grid.findElement(By.css('.grid-column[id="3,0"] .icon.tree'));
            await driver.actions().doubleClick(label).doubleClick(topicIcon).perform();
            await waitForNextAnimationFrame();
            await verifyTreeState(grid, 2, 17, 3, 0);

            await setElementProperty('showInfoIcon', 'checked', true);
            await verifyTreeState(grid, 0, 17, 3, 8);

            await playArrow.click();
            await waitForNextAnimationFrame();
            await verifyTreeState(grid, 0, 12, 0, 0);

            await playArrow.click();
            await waitForNextAnimationFrame();
            await verifyTreeState(grid, 0, 17, 3, 8);

            await setElementProperty('showInfoIcon', 'checked', false);
            await verifyTreeState(grid, 0, 17, 3, 0);

            await playArrow.click();
            await waitForNextAnimationFrame();
            await verifyTreeState(grid, 0, 12, 0, 0);
        });

        it('hideMinimizeAction', async () => {
            expect(await treeColumn.findElements(By.id('minIcon'))).to.not.be.empty;
            await setElementProperty('hideMinimizeAction', 'checked', true);
            expect(await treeColumn.findElements(By.id('minIcon'))).to.be.empty;
        });

        it('minimized', async () => {
            const header = await treeColumn.findElement(By.className('header-container'));
            expect(await getElementProperty(header, 'clientWidth')).to.be.gt(50);

            await setElementProperty('minimized', 'checked', true);
            const width = await getElementProperty(header, 'clientWidth');

            expect(width, 'width too small').to.be.gt(0);
            expect(width, 'width too bit').to.be.lt(50);
        });

        it('hidden', async () => {
            const header = await treeColumn.findElement(By.className('header-container'));
            expect(await getElementProperty(header, 'clientWidth')).to.be.gt(50);

            await setElementProperty('hidden', 'checked', true);
            const width = await getElementProperty(header, 'clientWidth');

            expect(width, 'width too bit').to.equal(0);
        });
    });
});