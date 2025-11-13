import { WebElement, By, Key } from 'selenium-webdriver';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, waitForNextAnimationFrame } from '../../gc-core-assets/test/SeleniumDriver';
import { expect } from 'chai';

describe('gc-widget-register-grid', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let grid: WebElement;
    let gridShadow: WebElement;

    before(async () => {
        await goto('gc-widget-register-grid/demo');

        el = await driver.findElement(By.id('demo_element'));

        // Need to wait for demo to be ready, so set a property and wait for databinding to reflect in properties
        await setElementProperty(el, 'selectedRegister', 'ALERT_HI_LIMIT');
        const selectedRegister = await driver.findElement(By.id('selectedRegister'));
        await driver.wait(async () => await getElementProperty(selectedRegister, 'value') === 'ALERT_HI_LIMIT');

        shadowRoot = await getShadowRoot(el);
        grid = shadowRoot.findElement(By.id('grid'));
        gridShadow = await getShadowRoot(grid);
    });

    beforeEach(async () => {
        setElementProperty('registerModelId', 'selectedLabel', 'TMP117');
        setElementProperty('addressBits', 'value', 0);
        setElementProperty('dataBits', 'value', 0);
        setElementProperty('selectedRegister', 'value', '');
        setElementProperty('selectedField', 'value', '');
        setElementProperty('filterText', 'value', '');
        setElementProperty('sortBy', 'selectedLabel', '');
        setElementProperty('sortDescending', 'checked', false);
        setElementProperty('hideAddressColumn', 'checked', false);
        await setElementProperty('hideBitsColumn', 'checked', false);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('registerModelId', async () => {
            const registerModelId = await driver.findElement(By.id('registerModelId'));
            const id = await getElementProperty(registerModelId, 'selectedLabel') as string;
            expect(id).to.equal('TMP117');

            // verify grid data
            let rows = await gridShadow.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(17);
            const idReg = await gridShadow.findElement(By.css('.grid-column[id="16,1"] > span'));
            expect(await idReg.getText()).to.equal('0xF');
            let bits = await gridShadow.findElements(By.css('.grid-column[id="5,3"] span'));
            expect(bits.length).to.equal(16);
            expect(await bits[0].getText()).to.equal('0');
            expect(await bits[1].getText()).to.equal('1');
            expect(await bits[2].getText()).to.equal('1');
            expect(await bits[3].getText()).to.equal('0');

            bits = await gridShadow.findElements(By.css('.grid-column[id="3,3"] span'));
            expect(bits.length).to.equal(16);
            expect(await bits[15].getText()).to.equal('-');

            // collapse two register blocks - to test if state is stored between switching models
            let collapseIcon = await gridShadow.findElement(By.css('.grid-column[id="7,0"] svg'));
            await collapseIcon.click();
            collapseIcon = await gridShadow.findElement(By.css('.grid-column[id="4,0"] svg'));
            await collapseIcon.click();
            await waitForNextAnimationFrame();
            rows = await gridShadow.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(14);

            await setElementProperty(registerModelId, 'selectedLabel', 'test');

            // verify grid data
            rows = await gridShadow.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(3);
            const controlReg = await gridShadow.findElement(By.css('.grid-column[id="1,2"] > input'));
            expect(await getElementProperty(controlReg, 'value')).to.equal('0xFFFFFFFF');
            bits = await gridShadow.findElements(By.css('.grid-column[id="1,3"] span'));
            expect(bits.length).to.equal(32);
            expect(await bits[31].getText()).to.equal('1');
            expect(await bits[0].getText()).to.equal('1');

            // verify collapsed state is preserved when switching between models
            await setElementProperty(registerModelId, 'selectedLabel', 'TMP117');
            rows = await gridShadow.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(14);

            // expand to restore state for later tests
            collapseIcon = await gridShadow.findElement(By.css('.grid-column[id="4,0"] svg'));
            await collapseIcon.click();
            await waitForNextAnimationFrame();
            collapseIcon = await gridShadow.findElement(By.css('.grid-column[id="7,0"] svg'));
            await collapseIcon.click();
        });

        it('addressBits', async () => {
            const addressBits = await driver.findElement(By.id('addressBits'));
            expect(await getElementProperty(addressBits, 'value')).to.equal(0);
            const addressCell = await gridShadow.findElement(By.css('.grid-column[id="5,1"] > span'));
            expect(await addressCell.getText()).to.equal('0x2');

            await setElementProperty(addressBits, 'value', 7);
            expect(await addressCell.getText()).to.equal('0x02');

            await setElementProperty(addressBits, 'value', 20);
            expect(await addressCell.getText()).to.equal('0x00002');
        });

        it('dataBits', async () => {
            const dataBits = await driver.findElement(By.id('dataBits'));
            expect(await getElementProperty(dataBits, 'value')).to.equal(0);
            const valueCell = await gridShadow.findElement(By.css('.grid-column[id="5,2"] > input'));
            expect(await getElementProperty(valueCell, 'value')).to.equal('0x6000');
            let bits = await gridShadow.findElements(By.css('.grid-column[id="5,3"] span'));
            expect(bits.length).to.equal(16);

            await setElementProperty(dataBits, 'value', 31);
            expect(await getElementProperty(valueCell, 'value')).to.equal('0x00006000');
            bits = await gridShadow.findElements(By.css('.grid-column[id="5,3"] span'));
            expect(bits.length).to.equal(31);

            await setElementProperty(dataBits, 'value', 9);
            expect(await getElementProperty(valueCell, 'value')).to.equal('0x000');
            bits = await gridShadow.findElements(By.css('.grid-column[id="5,3"] span'));
            expect(bits.length).to.equal(9);
        });

        it('selectedRegister', async () => {
            const selectedRegister = await driver.findElement(By.id('selectedRegister'));
            const bitCell = await gridShadow.findElement(By.id('5:3'));
            await bitCell.click();
            await waitForNextAnimationFrame();
            expect(await getElementProperty(selectedRegister, 'value')).to.equal('ALERT_HI_LIMIT');

            let focusedCell = await gridShadow.findElement(By.css(':focus'));
            await focusedCell.sendKeys(Key.ARROW_DOWN);
            await waitForNextAnimationFrame();
            expect(await getElementProperty(selectedRegister, 'value')).to.equal('ALERT_LO_LIMIT');

            focusedCell = await gridShadow.findElement(By.css(':focus'));
            await focusedCell.sendKeys(Key.ARROW_DOWN);
            await waitForNextAnimationFrame();
            expect(await getElementProperty(selectedRegister, 'value')).to.be.empty;

            await setElementProperty(selectedRegister, 'value', 'TEMP_RESULT');
            expect(await getElementProperty(grid, 'selectedPath')).to.equal('TEMPERATURE/TEMP_RESULT');
            expect(await getElementProperty(grid, 'selectedRow')).to.equal(1);

            await setElementProperty(selectedRegister, 'value', '');
            expect(await getElementProperty(grid, 'selectedPath')).to.be.empty;
            expect(await getElementProperty(grid, 'selectedRow')).to.equal(-1);
        });

        it('selectedField', async () => {
            const selectedField = await driver.findElement(By.id('selectedField'));
            expect(await getElementProperty(selectedField, 'value')).to.be.empty;

            await setElementProperty(selectedField, 'value', 'CONV_CYCLE');
            const bits = await gridShadow.findElements(By.css('.grid-column[id="3,3"] span'));
            expect(bits.length).to.equal(16);
            const transparentBackgroundColor = await bits[15-9].getCssValue('background-color');

            await setElementProperty('selectedRegister', 'value', 'CONFIG_REG');
            expect(await bits[15-10].getCssValue('background-color')).to.equal(transparentBackgroundColor);
            const highlightedBackgroundColor = await bits[15-9].getCssValue('background-color');
            expect(highlightedBackgroundColor).to.not.equal(transparentBackgroundColor);
            expect(await bits[15-8].getCssValue('background-color')).to.equal(highlightedBackgroundColor);
            expect(await bits[15-7].getCssValue('background-color')).to.equal(highlightedBackgroundColor);
            expect(await bits[15-6].getCssValue('background-color')).to.equal(transparentBackgroundColor);

            const readonlyBackgroundColor = await bits[15-0].getCssValue('background-color');
            expect(readonlyBackgroundColor).to.not.equal(highlightedBackgroundColor);
            expect(readonlyBackgroundColor).to.not.equal(transparentBackgroundColor);

            await setElementProperty(selectedField, 'value', 'ALERT_HIGH');
            expect(await bits[15-9].getCssValue('background-color')).to.equal(transparentBackgroundColor);
            expect(await bits[15-15].getCssValue('background-color')).to.equal(highlightedBackgroundColor);
            expect(await bits[15-14].getCssValue('background-color')).to.equal(transparentBackgroundColor);
        });

        it('filterText', async () => {
            const filterText = await driver.findElement(By.id('filterText'));
            let rows = await gridShadow.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(17);

            await setElementProperty(filterText, 'value', 'TEMP');
            rows = await gridShadow.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(4);

            const labels = ['TEMPERATURE', 'TEMP_RESULT', 'TEMPERATURE CORRECTION', 'OFFSET_TEMP' ];
            for (let i = 0; i < labels.length; i++) {
                const nameCell = await gridShadow.findElement(By.css(`.grid-column[id="${i},0"] label`));
                expect(await nameCell.getText()).to.equal(labels[i]);
            }
        });

        it('sortBy and sortDescending', async () => {
            const sortBy = await driver.findElement(By.id('sortBy'));
            const sortDescending = await driver.findElement(By.id('sortDescending'));

            const data = [{
                by: 'name', descending: false, labels: [ 'ALERT LIMITS', 'ALERT_HI_LIMIT', 'ALERT_LO_LIMIT', 'CONFIGURATION' ]
            }, {
                by: 'name', descending: true, labels: [ 'TEMPERATURE CORRECTION', 'OFFSET_TEMP', 'TEMPERATURE', 'TEMP_RESULT' ]
            }, {
                by: 'address', descending: true, labels: [ 'ID', 'ID_REG', 'TEMPERATURE CORRECTION', 'OFFSET_TEMP' ]
            }, {
                by: '', descending: true, labels: [ 'TEMPERATURE', 'TEMP_RESULT', 'CONFIGURATION', 'CONFIG_REG' ]
            }, {
                by: 'address', descending: false, labels: [ 'TEMPERATURE', 'TEMP_RESULT', 'CONFIGURATION', 'CONFIG_REG' ]
            }];

            for (let test = 0; test < data.length; test++) {
                const datum = data[test];
                setElementProperty(sortBy, 'selectedLabel', datum.by);
                await setElementProperty(sortDescending, 'checked', datum.descending);

                for (let i = 0; i < datum.labels.length; i++) {
                    const nameCell = await gridShadow.findElement(By.css(`.grid-column[id="${i},0"] label`));
                    expect(await nameCell.getText(), `sortBy=${datum.by}, descending=${datum.descending}`).to.equal(datum.labels[i]);
                }
            }
        });

        it('hideAddressColumn', async () => {
            const hideAddressColumn = await driver.findElement(By.id('hideAddressColumn'));
            expect(await getElementProperty(hideAddressColumn, 'checked')).to.be.false;

            let dataColumns = await shadowRoot.findElements(By.tagName('gc-widget-grid-data-column'));
            expect(dataColumns.length).to.equal(2);
            expect(await getElementProperty(dataColumns[0], 'heading')).to.equal('Address');
            expect(await getElementProperty(dataColumns[1], 'heading')).to.equal('Value');

            await setElementProperty(hideAddressColumn, 'checked', true);

            dataColumns = await shadowRoot.findElements(By.tagName('gc-widget-grid-data-column'));
            expect(dataColumns.length).to.equal(1);
            expect(await getElementProperty(dataColumns[0], 'heading')).to.equal('Value');
        });

        it('hideBitsColumn', async () => {
            const hideBitsColumn = await driver.findElement(By.id('hideBitsColumn'));
            expect(await getElementProperty(hideBitsColumn, 'checked')).to.be.false;

            let bitsColumns = await shadowRoot.findElements(By.tagName('gc-widget-register-bits-column'));
            expect(bitsColumns.length).to.equal(1);
            expect(await getElementProperty(bitsColumns[0], 'heading')).to.equal('Bits');

            await setElementProperty(hideBitsColumn, 'checked', true);

            bitsColumns = await shadowRoot.findElements(By.tagName('gc-widget-register-bits-column'));
            expect(bitsColumns.length).to.equal(0);
        });
    });
});