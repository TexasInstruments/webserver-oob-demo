/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, waitForNextAnimationFrame, invokeElementMethod, findVisibleElements } from '../../gc-core-assets/test/SeleniumDriver';
import { expect } from 'chai';

// helper function to get the display value for gc-widget-input and gc-widget-spinner to verify formatting and precision.
async function getDisplayValue(element: WebElement) {
    let shadow = await getShadowRoot(element);
    const gcWidget = (await shadow.findElements(By.tagName('gc-widget-input')))[0];
    if (gcWidget) {
        shadow = await getShadowRoot(gcWidget);
    }

    const tiWidget = await shadow.findElement(By.tagName('ti-input'));
    shadow = await getShadowRoot(tiWidget);
    const input = await shadow.findElement(By.tagName('input'));
    const result = await getElementProperty(input, 'value');
    return result;
}

describe('gc-widget-register-bitfield-viewer', () => {
    let el: WebElement;
    let shadowRoot: WebElement;

    before(async () => {
        await goto('gc-widget-register-bitfield-viewer/demo');

        el = await driver.findElement(By.id('demo_element'));

        // Need to wait for demo to be ready, so wait for data binding to set heading to 'Data Column'.
        const heading = await driver.findElement(By.id('heading'));
        await driver.wait(async () => await getElementProperty(heading, 'value') === 'Field View');

        shadowRoot = await getShadowRoot(el);
    });

    beforeEach(async () => {
        setElementProperty('heading', 'value', 'Field View');
        setElementProperty('registerModelId', 'selectedLabel', 'test');
        setElementProperty('registerName', 'selectedLabel', 'CONTROL');
        setElementProperty('selectedFieldIndex', 'value', -1);
        await setElementProperty('value', 'value', -1);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('heading', async () => {
            const heading = await shadowRoot.findElement(By.className('heading'));
            expect(await getElementProperty(heading, 'innerHTML')).to.equal('Field View');

            await setElementProperty('heading', 'value', 'New Bit Field Viewer Heading');
            expect(await getElementProperty(heading, 'innerHTML')).to.equal('New Bit Field Viewer Heading');

            await setElementProperty('heading', 'value', '');
            expect(await shadowRoot.findElements(By.className('heading'))).to.be.empty;
        });

        it('registerModelId', async () => {
            const subHeading = await shadowRoot.findElement(By.className('sub-heading'));
            expect(await getElementProperty(subHeading, 'innerHTML')).to.equal('ALL / CONTROL');

            await setElementProperty('registerModelId', 'selectedLabel', 'TMP117');
            await setElementProperty('registerName', 'selectedLabel', 'TEMP_RESULT');
            expect(await getElementProperty(subHeading, 'innerHTML')).to.equal('TEMPERATURE / TEMP_RESULT');

            const visibleFields = await findVisibleElements(shadowRoot, By.className('field-container'));
            expect(visibleFields.length).to.equal(1);

            const caption = visibleFields[0].findElement(By.className('caption'));
            expect(await getElementProperty(caption, 'innerHTML')).to.equal('TEMP[15:0]');

            const icons = await findVisibleElements(visibleFields[0], By.tagName('gc-widget-icon'));
            expect(icons.length).to.equal(2);
            expect(await getElementProperty(icons[0], 'icon')).to.equal('action:help_outline');
            expect(await getElementProperty(icons[1], 'icon')).to.equal('action:lock');

            const labels = await findVisibleElements(visibleFields[0], By.tagName('gc-widget-label'));
            expect(icons.length).to.equal(2);
            expect(await getElementProperty(labels[0], 'label')).to.equal('-256');
            expect(await getElementProperty(labels[1], 'label')).to.equal('°C');
        });

        it('registerName', async () => {
            const subHeading = await shadowRoot.findElement(By.className('sub-heading'));
            expect(await getElementProperty(subHeading, 'innerHTML')).to.equal('ALL / CONTROL');

            const scrollContainer = await shadowRoot.findElement(By.className('scroll-container'));
            let fields = await findVisibleElements(scrollContainer, By.className('field-container'));
            expect(fields.length).to.equal(11);
            let lockedIcons = await findVisibleElements(scrollContainer, By.css('gc-widget-icon:not([id])'));
            expect(lockedIcons.length).to.equal(1);

            let checkboxes = await findVisibleElements(scrollContainer, By.css('gc-widget-checkbox:not([readonly])'));
            expect(checkboxes.length).to.equal(2);

            let indicators = await findVisibleElements(scrollContainer, By.css('gc-widget-led:not([readonly])'));
            expect(indicators.length).to.equal(1);
            expect(await invokeElementMethod(indicators[0], 'getCSSProperty', '--gc-off-color')).to.equal('grey');
            expect(await invokeElementMethod(indicators[0], 'getCSSProperty', '--gc-on-color')).to.equal('blue');

            let selectors = await findVisibleElements(scrollContainer, By.css('gc-widget-select:not([readonly])'));
            expect(selectors.length).to.equal(2);
            expect(await getElementProperty(selectors[0], 'labels')).to.equal('b0000|b0001|b0010|b0011|b0100|b0101|b0110|b0111|b1000|b1001|b1010|b1011|b1100|b1101|b1110|b1111|');
            expect(await getElementProperty(selectors[1], 'labels')).to.equal('Yes|No|');

            let inputs = await findVisibleElements(scrollContainer, By.css('gc-widget-input:not([readonly])'));
            expect(inputs.length).to.equal(3);
            expect(await getElementProperty(inputs[0], 'format')).to.equal('hex');
            expect(await getElementProperty(inputs[0], 'precision')).to.equal(2);
            expect(await getElementProperty(inputs[1], 'format')).to.equal('binary');
            expect(await getElementProperty(inputs[1], 'precision')).to.equal(2);
            expect(await getElementProperty(inputs[2], 'format')).to.equal('dec');
            expect(await getElementProperty(inputs[2], 'precision')).to.equal(2);

            let spinners = await findVisibleElements(scrollContainer, By.css('gc-widget-spinner:not([readonly])'));
            expect(selectors.length).to.equal(2);
            expect(await getElementProperty(spinners[0], 'minValue')).to.equal(0);
            expect(await getElementProperty(spinners[0], 'maxValue')).to.equal(7);
            expect(await getElementProperty(spinners[0], 'increment')).to.equal(1);
            expect(await invokeElementMethod(spinners[0], 'getCSSProperty', '--gc-text-align')).to.equal('right');
            expect(await getElementProperty(spinners[1], 'minValue')).to.equal(0.048);
            expect(await getElementProperty(spinners[1], 'maxValue')).to.equal(2.08);
            expect(await getElementProperty(spinners[1], 'increment')).to.equal(0.016);
            expect(await invokeElementMethod(spinners[1], 'getCSSProperty', '--gc-text-align')).to.equal('right');

            let labels = await findVisibleElements(scrollContainer, By.tagName('gc-widget-label'));
            expect(labels.length).to.equal(1);

            await setElementProperty('registerName', 'selectedLabel', 'STATUS');
            expect(await getElementProperty(subHeading, 'innerHTML')).to.equal('ALL / STATUS');

            fields = await findVisibleElements(scrollContainer, By.className('field-container'));
            expect(fields.length).to.equal(11);

            lockedIcons = await findVisibleElements(scrollContainer, By.css('gc-widget-icon:not([id])'));
            expect(lockedIcons.length).to.equal(11);

            checkboxes = await findVisibleElements(scrollContainer, By.tagName('gc-widget-checkbox'));
            expect(checkboxes.length).to.equal(0);

            indicators = await findVisibleElements(scrollContainer, By.tagName('gc-widget-led'));
            expect(indicators.length).to.equal(1);
            expect(await invokeElementMethod(indicators[0], 'getCSSProperty', '--gc-off-color')).to.equal('grey');
            expect(await invokeElementMethod(indicators[0], 'getCSSProperty', '--gc-on-color')).to.equal('blue');
            expect(await getElementProperty(indicators[0], 'on')).to.be.false;
            await indicators[0].click();
            await waitForNextAnimationFrame();
            expect(await getElementProperty(indicators[0], 'on')).to.be.false;

            selectors = await findVisibleElements(scrollContainer, By.css('gc-widget-select[readonly]'));
            expect(selectors.length).to.equal(1);
            expect(await getElementProperty(selectors[0], 'labels')).to.equal('Yes|No|');

            inputs = await findVisibleElements(scrollContainer, By.css('gc-widget-input[readonly]'));
            expect(inputs.length).to.equal(0);

            spinners = await findVisibleElements(scrollContainer, By.css('gc-widget-spinner[readonly]'));
            expect(spinners.length).to.equal(2);
            expect(await getElementProperty(spinners[0], 'minValue')).to.equal(0);
            expect(await getElementProperty(spinners[0], 'maxValue')).to.equal(7);
            expect(await getElementProperty(spinners[0], 'increment')).to.equal(1);
            expect(await invokeElementMethod(spinners[0], 'getCSSProperty', '--gc-text-align')).to.equal('right');
            expect(await getElementProperty(spinners[1], 'minValue')).to.equal(0.048);
            expect(await getElementProperty(spinners[1], 'maxValue')).to.equal(2.08);
            expect(await getElementProperty(spinners[1], 'increment')).to.equal(0.016);
            expect(await invokeElementMethod(spinners[1], 'getCSSProperty', '--gc-text-align')).to.equal('right');

            labels = await findVisibleElements(scrollContainer, By.tagName('gc-widget-label'));
            expect(labels.length).to.equal(7);
            expect(await getElementProperty(labels[0], 'label')).to.equal('b0');
            expect(await getElementProperty(labels[1], 'label')).to.equal('b0000');
            expect(await getElementProperty(labels[2], 'label')).to.equal('b00000');
            expect(await getElementProperty(labels[3], 'label')).to.equal('b00');
            expect(await getElementProperty(labels[4], 'label')).to.equal('0.00');
            expect(await getElementProperty(labels[5], 'label')).to.equal('b0');
            expect(await getElementProperty(labels[6], 'label')).to.equal('b0');
        });

        it('selectedFieldIndex', async () => {
            const selectedFieldIndex = await driver.findElement(By.id('selectedFieldIndex'));
            const infoContainer = await shadowRoot.findElement(By.className('info-container'));
            const scrollContainer = await shadowRoot.findElement(By.className('scroll-container'));

            const data = [{
                id: 'checkbox1',
                index: 0,
                bit: '31',
                type: 'RW',
                name: 'Checkbox'
            }, {
                id: 'value2',
                index: 5,
                bit: '19 - 18',
                type: 'RW',
                name: 'Binary'
            }, {
                id: 'label1',
                index: 11,
                bit: '0',
                type: 'R',
                name: 'Locked'
            }];

            for (let i = 0; i < data.length; i++) {
                const bitFieldIndex = data[i].index;
                const fieldContainer = await scrollContainer.findElement(By.id(data[i].id));

                expect(await getElementProperty(selectedFieldIndex, 'value')).to.equal(-1);
                expect(await infoContainer.getCssValue('display')).to.equal('none');
                expect(await fieldContainer.isDisplayed()).to.be.true;

                const fieldContainers = await findVisibleElements(scrollContainer, By.className('field-container'));
                expect(fieldContainers.length).to.be.gt(2);
                expect(await fieldContainers[fieldContainers.length - 1].getCssValue('border-bottom-width')).to.equal('0px');
                expect(await fieldContainers[fieldContainers.length - 2].getCssValue('border-bottom-width')).to.equal('1px');

                const helpIcon = await shadowRoot.findElement(By.css(`gc-widget-icon[id="${bitFieldIndex}"]`));
                if (i % 2 === 0) {  // alternate between mouse clicks and using properties to isolate the bit field.
                    await helpIcon.click();
                    await waitForNextAnimationFrame();
                } else {
                    await setElementProperty('selectedFieldIndex', 'value', bitFieldIndex);
                }

                expect(await getElementProperty(selectedFieldIndex, 'value')).to.equal(bitFieldIndex);
                expect(await infoContainer.getCssValue('display')).to.equal('flex');
                expect(await fieldContainer.isDisplayed()).to.be.true;

                const visibleFields = await findVisibleElements(shadowRoot, By.className('field-container'));
                expect(visibleFields.length).to.equal(1);
                expect(await visibleFields[0].getCssValue('border-bottom-width')).to.equal('1px');

                // test content of info-container
                const allInfoTitles = await infoContainer.findElements(By.className('info-title'));
                expect(await getElementProperty(allInfoTitles[0], 'innerHTML')).to.equal('Field');
                expect(await getElementProperty(allInfoTitles[1], 'innerHTML')).to.equal('Bit');
                expect(await getElementProperty(allInfoTitles[2], 'innerHTML')).to.equal('Type');
                expect(await getElementProperty(allInfoTitles[3], 'innerHTML')).to.equal('Description');

                const allInfoData = await infoContainer.findElements(By.tagName('gc-widget-label'));
                expect(await getElementProperty(allInfoData[0], 'label')).to.equal(data[i].name);
                expect(await getElementProperty(allInfoData[1], 'label')).to.equal(data[i].bit);
                expect(await getElementProperty(allInfoData[2], 'label')).to.equal(data[i].type);

                const description = await infoContainer.findElement(By.css('div:last-child'));
                expect(await getElementProperty(description, 'innerHTML')).to.equal(`Description for the CONTROL.${data[i].name} field.`);

                const closeIcon = await fieldContainer.findElement(By.tagName('gc-widget-icon'));
                expect(await getElementProperty(closeIcon, 'icon')).to.equal('navigation:cancel');

                if (i % 2 === 0) {  // alternate between mouse clicks and using properties to isolate the bit field.
                    await helpIcon.click();
                    await waitForNextAnimationFrame();
                } else {
                    await setElementProperty('selectedFieldIndex', 'value', -1);
                }

                expect(await getElementProperty(selectedFieldIndex, 'value')).to.equal(-1);
                expect(await infoContainer.getCssValue('display')).to.equal('none');
                expect(await fieldContainer.isDisplayed()).to.be.true;
                expect(await getElementProperty(closeIcon, 'icon')).to.equal('action:help_outline');
            };

        });

        it('value', async () => {
            const data = [{
                selector: 'gc-widget-checkbox[id="0"]',
                property: 'checked',
                before: true,
                after: false
            }, {
                selector: 'gc-widget-select[id="1"]',
                property: 'selectedLabel',
                before: 'b1111',
                after: 'b0101',
                setValue: 'b1010'
            }, {
                selector: 'gc-widget-input[id="2"]',
                property: 'value',
                before: '0x1F',
                after: '0x0A',
                setValue: '0x15'
            }, {
                selector: 'gc-widget-led[id="3"]',
                property: 'on',
                before: true,
                after: false
            }, {
                selector: 'gc-widget-select[id="4"]',
                property: 'selectedLabel',
                before: 'No',
                after: 'Yes',
                setValue: 'No'
            }, {
                selector: 'gc-widget-input[id="5"]',
                property: 'value',
                before: '11',
                after: '01',
                setValue: '10'
            }, {
                selector: 'gc-widget-input[id="6"]',
                property: 'value',
                before: '-0.25',
                after: '3.50',
                setValue: '-2.75'
            }, {
                selector: 'gc-widget-spinner[id="7"]',
                property: 'value',
                before: '7',
                after: '5',
                setValue: '2'
            }, {
                selector: 'gc-widget-spinner[id="8"]',
                property: 'value',
                before: '2.080',
                after: '0.208',
                setValue: '1.39'
            }, {
                selector: 'gc-widget-checkbox[id="10"]',
                property: 'checked',
                before: true,
                after: false
            }, {
                selector: 'gc-widget-label[id="11"]',
                property: 'label',
                before: 'b1',
                after: 'b0'
            }];

            // verify all widgets have before values
            for (let i = 0; i < data.length; i++ ) {
                const widget = await shadowRoot.findElement(By.css(data[i].selector));
                const value = data[i].property === 'value' ? await getDisplayValue(widget) : await getElementProperty(widget, data[i].property);
                expect(value, `failed before value of widget ${data[i].selector}`).to.equal(data[i].before);
            }

            const valueInput = await driver.findElement(By.id('value'));
            await setElementProperty(valueInput, 'value', 0x2A85D450);

            // verify all widgets have after values
            for (let i = 0; i < data.length; i++ ) {
                const widget = await shadowRoot.findElement(By.css(data[i].selector));
                const value = data[i].property === 'value' ? await getDisplayValue(widget) : await getElementProperty(widget, data[i].property);
                expect(value, `failed after value of widget ${data[i].selector}`).to.equal(data[i].after);
            }

            // set input widgets to setValue and verify value property updates properly.
            await setElementProperty('value', 'value', 0);
            for (let i = 0; i < data.length; i++ ) {
                const fieldContainer = (await shadowRoot.findElements(By.className('field-container')))[i];
                expect(fieldContainer, `Missing field container for bit field index ${i}`).to.exist;
                const widget = await shadowRoot.findElement(By.css(data[i].selector));
                if (data[i].setValue !== undefined) {
                    await setElementProperty(widget, data[i].property, data[i].setValue!);
                } else {
                    await widget.click();
                }
            }
            expect(await getElementProperty(valueInput, 'value')).to.equal(0xD57AAAA2);
        });
    });
});