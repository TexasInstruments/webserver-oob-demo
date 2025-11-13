import { WebElement, By, logging } from 'selenium-webdriver';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, waitForNextAnimationFrame, invokeElementMethod, querySelector } from '../../gc-core-assets/test/SeleniumDriver';
import { expect } from 'chai';

async function testDialog(heading: string, message: string, closeButton: string) {
    const messageDialog = await driver.findElements(By.tagName('gc-widget-message-dialog'));
    expect(messageDialog.length, `${heading} dialog with message ${message} did not open`).to.equal(1);
    const shadowDialog = await getShadowRoot(messageDialog[0]);
    const button = await querySelector(shadowDialog, `.${closeButton}`);

    try {
        expect(await getElementProperty(messageDialog[0], 'heading')).to.equal(heading);
        expect(await getElementProperty(messageDialog[0], 'message')).to.contain(message);
    } finally {
        await button.click();
        const nextDialogs = await driver.findElements(By.tagName('gc-widget-message-dialog'));
        for (let i = 0; i < nextDialogs.length; i++) {
            expect(await getElementProperty(nextDialogs[i], 'heading'), `${heading} dialog with message ${message} did not close when pressing ${closeButton} button`).to.not.equal(heading);
        }
    }
}

describe('gc-widget-register-view', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let grid: WebElement;
    let modelSelect: WebElement;
    let deferredModeSwitch: WebElement;
    let filterText: WebElement;
    let searchBitFieldsCheckbox: WebElement;

    before(async () => {
        await goto('gc-widget-register-view/demo');

        el = await driver.findElement(By.id('demo_element'));

        // Need to wait for demo to be ready, so wait for databinding to set virtual checkbox to true.
        const hideDeviceName = (await driver.findElement(By.id('hideDeviceName')));
        await driver.wait(async () => await getElementProperty(hideDeviceName, 'checked') === true);

        shadowRoot = await getShadowRoot(el);
        const registerGrid = await shadowRoot.findElement(By.id('registerGrid'));
        const registerGridShadow = await getShadowRoot(registerGrid);
        grid = await getShadowRoot(await registerGridShadow.findElement(By.id('grid')));
        modelSelect = await shadowRoot.findElement(By.id('modelSelect'));
        deferredModeSwitch = await shadowRoot.findElement(By.id('deferredModeSwitch'));
        filterText = await shadowRoot.findElement(By.tagName('gc-widget-input-filter'));
        searchBitFieldsCheckbox = await shadowRoot.findElement(By.id('searchBitFieldsCheckbox'));

        // make sure all the buttons are visible for tests to avoid element not interactable exceptions.
        const toolbarRow = await shadowRoot.findElement(By.css('div.root-container > div'));
        await invokeElementMethod(toolbarRow, 'classList.add', 'wrap');

        // clear logs before
        const logger = driver.manage().logs();
        await logger.get(logging.Type.BROWSER);
    });

    beforeEach(async () => {
        setElementProperty('hideDeviceName', 'checked', true);
        setElementProperty('autoReadSelectorLabels', 'value', '');
        setElementProperty('autoReadSelectorValues', 'value', '');
        setElementProperty(modelSelect, 'selectedIndex', 0);
        setElementProperty(filterText, 'value', '');
        setElementProperty(deferredModeSwitch, 'checked', false);
        await setElementProperty(searchBitFieldsCheckbox, 'checked', false);
        await invokeElementMethod(el, 'expandToLevel', 2);
        await waitForNextAnimationFrame();
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('hideDeviceName', async () => {
            const subHeading = await shadowRoot.findElement(By.className('sub-heading'));
            expect(await subHeading.getText()).to.be.empty;
            await setElementProperty(modelSelect, 'selectedIndex', 1);
            expect(await subHeading.getText()).to.be.empty;

            await setElementProperty('hideDeviceName', 'checked', false);
            expect(await subHeading.getText()).to.equal('test');
            await setElementProperty(modelSelect, 'selectedIndex', 0);
            expect(await subHeading.getText()).to.equal('TMP117');
        });

        it('autoReadSelectorLabels', async () => {
            const autoReadSelect = await shadowRoot.findElement(By.id('autoReadSelect'));
            const defaultLabels = await getElementProperty(autoReadSelect, 'labels') as string;
            const labels = defaultLabels.split('|');
            expect(labels[0]).to.equal('Off');
            expect(labels[1]).to.equal('As fast as possible');

            const newLabels = labels.map( (_, i) => labels[labels.length -1 - i]).join(';');
            await setElementProperty('autoReadSelectorLabels', 'value', newLabels);
            expect(await getElementProperty(autoReadSelect, 'labels')).to.equal(newLabels);

            await setElementProperty('autoReadSelectorLabels', 'value', '');
            expect(await getElementProperty(autoReadSelect, 'labels')).to.equal(defaultLabels);
        });

        it('autoReadSelectorValues', async () => {
            const autoReadSelect = await shadowRoot.findElement(By.id('autoReadSelect'));
            const defaultValues = await getElementProperty(autoReadSelect, 'values') as string;
            const values = defaultValues.split(',');
            expect(+values[0]).to.equal(-1);
            expect(+values[1]).to.equal(0);

            const newValues = values.map( (_, i) => values[values.length - 1 - i]).join(';');
            await setElementProperty('autoReadSelectorValues', 'value', newValues);
            expect(await getElementProperty(autoReadSelect, 'values')).to.equal(newValues);

            await setElementProperty('autoReadSelectorValues', 'value', '');
            expect(await getElementProperty(autoReadSelect, 'values')).to.equal(defaultValues);
        });

    });

    /**
     * User Interaction
     */
    describe('User Interaction', () => {
        it('filter registers', async () => {
            const temperatureBlock = await grid.findElement(By.css('.grid-column[id="0,0"] svg'));
            await temperatureBlock.click();
            await waitForNextAnimationFrame();

            await setElementProperty(filterText, 'value', 'te');

            let rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(3);
            await temperatureBlock.click();
            await waitForNextAnimationFrame();
            rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(4);
        });

        it('filter register fields', async () => {
            await setElementProperty(filterText, 'value', 'd');
            let rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(2);

            const alertLimitsBlock = await grid.findElement(By.css('.grid-column[id="0,0"] svg'));
            await alertLimitsBlock.click();
            await waitForNextAnimationFrame();
            rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(1);

            await setElementProperty(searchBitFieldsCheckbox, 'checked', true);
            rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(3); // Don't find the Reserved field (which includes a "d").

            // Don't find hidden fields.
            setElementProperty(filterText, 'value', 'Hidden');
            await setElementProperty(modelSelect, 'selectedIndex', 1);
            rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(0);
        });

        it('show details', async () => {
            await setElementProperty(filterText, 'value', 'reg');
            let rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(4);

            const detailsIcon = await grid.findElement(By.css('.grid-column[id="1,0"] .icon.info'));
            await detailsIcon.click();
            await waitForNextAnimationFrame();
            rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(2);

            const collapseIcon = await grid.findElement(By.css('.grid-column[id="0,0"] svg'));
            await collapseIcon.click();
            await waitForNextAnimationFrame();
            rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(1);

            const registerDetails = await shadowRoot.findElement(By.id('registerDetails'));
            expect(await registerDetails.isDisplayed()).to.be.true;

            const detailHeading = await shadowRoot.findElement(By.className('detail-heading'));
            expect(await detailHeading.getText()).to.equal('Configuration Register');

            const closeIcon = await registerDetails.findElement(By.css('gc-widget-icon.clickable'));
            await closeIcon.click();
            await waitForNextAnimationFrame();
            rows = await grid.findElements(By.className('grid-row'));
            expect(rows.length).to.equal(3);
        });

        it('read registers', async () => {
            const readButton = await shadowRoot.findElement(By.id('read'));
            const readAllButton = await shadowRoot.findElement(By.id('readAll'));
            expect(!(await readButton.getAttribute('disabled'))).to.be.false;
            expect(!(await readAllButton.getAttribute('disabled'))).to.be.false;

            await setElementProperty(modelSelect, 'selectedIndex', 1);
            expect(!(await readButton.getAttribute('disabled'))).to.be.false;
            expect(!(await readAllButton.getAttribute('disabled'))).to.be.true;

            const control = await grid.findElement(By.css('.grid-column[id="1,1"]'));
            await control.click();
            await waitForNextAnimationFrame();
            expect(!(await readButton.getAttribute('disabled'))).to.be.true;
            expect(!(await readAllButton.getAttribute('disabled'))).to.be.true;

            await readButton.click();
            await waitForNextAnimationFrame();
            await testDialog('Error', 'connected to target to read registers', 'message-ok');

            const all = await grid.findElement(By.css('.grid-column[id="0,0"]'));
            await all.click();
            await waitForNextAnimationFrame();
            expect(!(await readButton.getAttribute('disabled'))).to.be.false;
            expect(!(await readAllButton.getAttribute('disabled'))).to.be.true;

            await readAllButton.click();
            await waitForNextAnimationFrame();
            await testDialog('Error', 'connected to target to read registers', 'message-ok');
        });

        it('write registers', async () => {
            const writeButton = await shadowRoot.findElement(By.id('write'));
            const writeAllButton = await shadowRoot.findElement(By.id('writeAll'));
            expect(!(await writeButton.getAttribute('disabled'))).to.be.false;
            expect(!(await writeAllButton.getAttribute('disabled'))).to.be.false;

            await setElementProperty(deferredModeSwitch, 'checked', true);
            expect(!(await writeButton.getAttribute('disabled'))).to.be.false;
            expect(!(await writeAllButton.getAttribute('disabled'))).to.be.true;

            const tempResult = await grid.findElement(By.css('.grid-column[id="1,1"]'));
            await tempResult.click();
            await waitForNextAnimationFrame();
            expect(!(await writeButton.getAttribute('disabled'))).to.be.false;
            expect(!(await writeAllButton.getAttribute('disabled'))).to.be.true;

            const configRegBit = await grid.findElement(By.css('.grid-column[id="3,3"] span'));
            await configRegBit.click();
            await waitForNextAnimationFrame();
            expect(!(await writeButton.getAttribute('disabled'))).to.be.true;
            expect(!(await writeAllButton.getAttribute('disabled'))).to.be.true;

            await writeButton.click();
            await waitForNextAnimationFrame();
            await testDialog('Warning', 'Write to CONFIG_REG enqueued - not connected to target', 'message-ok');

            await driver.actions().doubleClick(configRegBit).doubleClick(await grid.findElement(By.css('.grid-column[id="5,3"] span'))).perform();

            await writeAllButton.click();
            await waitForNextAnimationFrame();
            await testDialog('Warning', 'Write to 2 register(s) enqueued - not connected to target', 'message-ok');

            const temperatureBlock = await grid.findElement(By.css('.grid-column[id="0,0"] label'));
            await temperatureBlock.click();
            await waitForNextAnimationFrame();
            expect(!(await writeButton.getAttribute('disabled'))).to.be.false;
            expect(!(await writeAllButton.getAttribute('disabled'))).to.be.true;

            expect((await driver.findElements(By.tagName('gc-widget-message-dialog'))).length).to.equal(0);
        });

        it('deferred mode', async () => {
            await setElementProperty(deferredModeSwitch, 'checked', true);

            const eepromValue = await grid.findElement(By.css('.grid-column[id="8,2"] input'));
            expect(await getElementProperty(eepromValue, 'value')).to.equal('0x0000');
            expect(await eepromValue.getCssValue('text-decoration')).to.not.include('underline');
            expect(await eepromValue.getCssValue('font-style')).to.equal('normal');

            const eepromBit = await grid.findElement(By.css('.grid-column[id="8,3"] span'));
            await driver.actions().doubleClick(eepromBit).perform();
            await waitForNextAnimationFrame();

            expect(await getElementProperty(eepromValue, 'value')).to.equal('0x8000');
            expect(await eepromValue.getCssValue('text-decoration')).to.include('underline');
            expect(await eepromValue.getCssValue('font-style')).to.equal('italic');

            await setElementProperty(deferredModeSwitch, 'checked', false);
            await testDialog('Register View', 'Commit Pending Writes', 'message-cancel');

            expect(await getElementProperty(deferredModeSwitch, 'checked')).to.be.true;
            expect(await getElementProperty(eepromValue, 'value')).to.equal('0x8000');
            expect(await eepromValue.getCssValue('text-decoration')).to.include('underline');
            expect(await eepromValue.getCssValue('font-style')).to.equal('italic');

            await setElementProperty(deferredModeSwitch, 'checked', false);
            await testDialog('Register View', 'Commit Pending Writes', 'message-no');

            expect(await getElementProperty(deferredModeSwitch, 'checked')).to.be.false;
            expect(await getElementProperty(eepromValue, 'value')).to.equal('0x0000');
            expect(await eepromValue.getCssValue('text-decoration')).to.not.include('underline');
            expect(await eepromValue.getCssValue('font-style')).to.equal('normal');

            await setElementProperty(deferredModeSwitch, 'checked', true);
            await driver.actions().doubleClick(eepromBit).perform();
            await waitForNextAnimationFrame();

            expect(await getElementProperty(eepromValue, 'value')).to.equal('0x8000');
            expect(await eepromValue.getCssValue('text-decoration')).to.include('underline');
            expect(await eepromValue.getCssValue('font-style')).to.equal('italic');

            await setElementProperty(deferredModeSwitch, 'checked', false);
            await testDialog('Register View', 'Commit Pending Writes', 'message-yes');
            await testDialog('Warning', 'Write to 1 register(s) enqueued - not connected to target', 'message-ok');

            expect(await getElementProperty(deferredModeSwitch, 'checked')).to.be.false;
            expect(await getElementProperty(eepromValue, 'value')).to.equal('0x8000');
            expect(await eepromValue.getCssValue('text-decoration')).to.not.include('underline');
            expect(await eepromValue.getCssValue('font-style')).to.equal('normal');

            await setElementProperty(deferredModeSwitch, 'checked', true);
            await setElementProperty(modelSelect, 'selectedIndex', 1);
            expect(await getElementProperty(deferredModeSwitch, 'checked')).to.be.false;
            await setElementProperty(modelSelect, 'selectedIndex', 0);
            expect(await getElementProperty(deferredModeSwitch, 'checked')).to.be.true;

            await setElementProperty(deferredModeSwitch, 'checked', false);
            expect((await driver.findElements(By.tagName('gc-widget-message-dialog'))).length).to.equal(0);
        });

        it('changing selected register repeatedly', async () => {

            const alertLoValue = await grid.findElement(By.css('.grid-column[id="6,2"] input'));
            const alertLoBit = await grid.findElement(By.css('.grid-column[id="6,3"] span'));
            const blankBit = await grid.findElement(By.css('.grid-column[id="7,3"] span'));

            expect(await getElementProperty(alertLoValue, 'value')).to.equal('0x8000');
            for (let count = 0; count < 25; count++) {
                await alertLoBit.click();
                await blankBit.click();
            }
            expect(await getElementProperty(alertLoValue, 'value')).to.equal('0x8000');

        });
    });

    afterEach(async () => {
        let entries = await  driver.manage().logs().get(logging.Type.BROWSER);
        if (entries.length > 1) {
            entries = entries.filter( entry => entry.level > logging.Level.DEBUG);
            entries = entries.filter( entry => !entry.message.includes('should be set after'));
            expect(entries[0]?.message).to.not.exist;
        }
    });
});