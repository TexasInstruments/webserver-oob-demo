import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, waitForNextAnimationFrame } from '../../gc-core-assets/test/SeleniumDriver';
import { expect } from 'chai';

describe('gc-widget-grid-data-column', () => {
    let grid: WebElement;
    let dataColumn: WebElement;

    before(async () => {
        await goto('gc-widget-grid/demo/dataColumn');

        // Need to wait for demo to be ready, so wait for data binding to set heading to 'Data Column'.
        const heading = await driver.findElement(By.id('heading'));
        await driver.wait(async () => await getElementProperty(heading, 'value') === 'Data Column');

        grid = await getShadowRoot(await driver.findElement(By.id('grid')));
        dataColumn = await getShadowRoot(await driver.findElement(By.id('datum')));
    });

    beforeEach(async () => {
        setElementProperty('heading', 'value', 'Data Column');
        setElementProperty('format', 'selectedLabel', 'hex');
        setElementProperty('precision', 'value', 4);
        setElementProperty('options', 'value', '');
        setElementProperty('readonly', 'checked', false);
        setElementProperty('hideMinimizeAction', 'checked', false);
        setElementProperty('minimized', 'checked', false);
        setElementProperty('hidden', 'checked', false);
        setElementProperty('align', 'selectedLabel', 'end');
        setElementProperty('headingAlign', 'selectedLabel', 'end');
        await setElementProperty('columnWidth', 'value', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('heading', async () => {
            const dataCell = await grid.findElement(By.id('0,0'));
            const startWidth = await getElementProperty(dataCell, 'clientWidth') as number;
            await setElementProperty('heading', 'value', 'New Datum Heading');

            const header = await dataColumn.findElement(By.css('.header-container label'));
            expect(await header.getText()).to.equal('New Datum Heading');
            const width = await getElementProperty(dataCell, 'clientWidth') as number;
            expect(width).to.be.gt(startWidth);
        });

        it('align', async () => {
            const dataCell = await grid.findElement(By.id('0,0'));
            const editor = await grid.findElement(By.css('[id="0,0"] input'));
            expect(await dataCell.getCssValue('justify-content')).to.equal('flex-end');
            expect(await editor.getCssValue('text-align')).to.equal('end');

            const align = await driver.findElement(By.id('align'));
            await setElementProperty(align, 'selectedLabel', 'center');

            expect(await dataCell.getCssValue('justify-content')).to.equal('center');
            expect(await editor.getCssValue('text-align')).to.equal('center');

            await setElementProperty(align, 'selectedLabel', 'start');

            const justify = await dataCell.getCssValue('justify-content');
            expect(justify).to.not.equal('center');
            expect(justify).to.not.equal('flex-end');
            const textAlign = await editor.getCssValue('text-align');
            expect(textAlign).to.not.equal('center');
            expect(textAlign).to.not.equal('end');
        });

        it('format+precision', async () => {
            const expectedValue = ['0x0000A', '10', '00001010', '0.625', '1.00e+1'];
            const formatSetting = ['hex', 'dec', 'binary', 'q', 'exp'];
            const precisionSetting = [5, 0, 8, 4, 2];
            const format = await driver.findElement(By.id('format'));
            const precision = await driver.findElement(By.id('precision'));
            const editor = await grid.findElement(By.css('[id="10,0"] input'));

            for (let i = 0; i < expectedValue.length; i++) {
                setElementProperty(format, 'selectedLabel', formatSetting[i]);
                await setElementProperty(precision, 'value', precisionSetting[i]);
                expect(await getElementProperty(editor, 'value')).to.equal(expectedValue[i]);
            }
        });

        it('options', async () => {
            await setElementProperty('options', 'value', '1,2,3,4,5,6');

            await (await grid.findElement(By.id('4,0'))).click();
            await waitForNextAnimationFrame();

            const editor = await grid.findElement(By.css('[id="4,0"] gc-widget-select'));
            await driver.wait(async () => await getElementProperty(editor, 'selectedIndex') !== null);
            expect(await getElementProperty(editor, 'labels')).to.equal('0x0001|0x0002|0x0003|0x0004|0x0005|0x0006|');
            expect(await getElementProperty(editor, 'values')).to.equal('1,2,3,4,5,6');
            expect(await getElementProperty(editor, 'selectedIndex'), 'selectedIndex is wrong').to.equal(3);
            expect(await getElementProperty(editor, 'selectedValue'), 'selectedValue is wrong').to.equal(4);
            expect(await getElementProperty(editor, 'selectedLabel'), 'selectedLabel is wrong').to.equal('0x0004');
        });

        it('readonly', async () => {
            const editor = await grid.findElement(By.css('[id="10,0"] *'));
            expect(await editor.getTagName()).to.equal('input');

            await setElementProperty('readonly', 'checked', true);

            const span = await grid.findElement(By.css('[id="10,0"] *'));
            expect(await span.getTagName()).to.equal('span');
        });

        it('hideMinimizeAction', async () => {
            expect(await dataColumn.findElements(By.id('minIcon'))).to.not.be.empty;
            await setElementProperty('hideMinimizeAction', 'checked', true);
            expect(await dataColumn.findElements(By.id('minIcon'))).to.be.empty;
        });

        it('minimized', async () => {
            const header = await dataColumn.findElement(By.className('header-container'));
            expect(await getElementProperty(header, 'clientWidth')).to.be.gt(50);

            await setElementProperty('minimized', 'checked', true);
            const width = await getElementProperty(header, 'clientWidth');

            expect(width, 'width too small').to.be.gt(0);
            expect(width, 'width too bit').to.be.lt(50);
        });

        it('hidden', async () => {
            const header = await dataColumn.findElement(By.className('header-container'));
            expect(await getElementProperty(header, 'clientWidth')).to.be.gt(50);

            await setElementProperty('hidden', 'checked', true);
            const width = await getElementProperty(header, 'clientWidth');

            expect(width, 'width too bit').to.equal(0);
        });
    });
});