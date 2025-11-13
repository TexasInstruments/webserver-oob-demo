import { expect } from 'chai';
import { goto, driver, getElementProperty, setElementProperty, waitForElementEvent, createElement, querySelector } from '../../gc-core-assets/test/SeleniumDriver';

const tagname = 'gc-widget-select';

describe('gc-widget-select-bugfix', () => {
    describe('GC-2813', () => {
        beforeEach(async () => {
            await goto('gc-widget-base/demo');
        });

        it('default-selected-value', async () => {
            const el = await createElement(tagname, 'labels=one,two,three,four', 'values=1,2,3,4', 'selected-value=2');
            const defaultSelectedValue = await getElementProperty(el, 'selectedValue');
            expect(defaultSelectedValue, 'Failed to set initial selectedValue').to.eq(2);
        });

        it('selected-value-event', done => {
            (async () => {
                const el = await createElement(tagname, 'labels=one,two,three,four', 'values=1,2,3,4', 'selected-value=2');
                await waitForElementEvent(el, 'selected-value-changed', (e: { value: number }) => {
                    done(e.value !== 1 ? `selectedValue does not have the correct value of 1 (${e.value}).` : undefined);
                });
                await setElementProperty(el, 'selectedValue', 1);
            })();
        });

        it('text-selected-value', done => {
            (async () => {
                const el = await createElement(tagname, 'labels=one,two,three,four', 'values=1,2,3,4', 'selected-value=2');
                await waitForElementEvent(el, 'selected-index-changed', (e: { value: number }) => {
                    done(e.value !== 3 ? `selectedIndex does not have the correct value of 3 (${e.value}).` : undefined);
                });
                await setElementProperty(el, 'selectedValue', '4');
            })();
        });
    });

    describe('GC-2838', () => {
        beforeEach(async () => {
            await goto('gc-widget-base/demo');
        });

        it('set labels: selected-label-changed', done => {
            (async () => {
                const el = await createElement(tagname, 'labels=one,two,three,four,five', 'values=1,2,3,4,5', 'selected-value=2');

                await waitForElementEvent<{value: string}>(el, 'selected-label-changed', async detail => {
                    let error = undefined;
                    try {
                        expect(detail.value).eq('seven');
                        expect(await getElementProperty(el, 'selectedIndex')).eq(1);
                        expect(await getElementProperty(el, 'selectedValue')).eq(2);
                    } catch (e) { error = e; };
                    done(error);
                });

                await setElementProperty(el, 'labels', 'six,seven,eight,nine,ten');
            })();
        });

        it('set values: [selected-labels-changed, selected-index-changed]', done => {
            (async () => {
                const el = await createElement(tagname, 'labels=one,two,three,four,five', 'values=1,2,3,4,5', 'selected-value=2');
                let eventCounts = 0;

                await waitForElementEvent<{value: string}>(el, 'selected-label-changed', async detail => {
                    let error = undefined;
                    try {
                        expect(detail.value).eq(undefined);
                        expect(await getElementProperty(el, 'selectedValue')).eq(2);
                        eventCounts++;
                    } catch (e) { error = e; };
                    if (eventCounts == 2) done(error);
                });

                await waitForElementEvent<{value: number}>(el, 'selected-index-changed', async detail => {
                    let error = undefined;
                    try {
                        expect(detail.value).eq(-1);
                        expect(await getElementProperty(el, 'selectedValue')).eq(2);
                        eventCounts++;
                    } catch (e) { error = e; };
                    if (eventCounts == 2) done(error);
                });

                await setElementProperty(el, 'values', '1,42,3,4,5');
            })();
        });

        it('set model values, labels, selectedLabel: [!selectedLabelChanged, selectedValueChanged, selectedIndexChanged]', async () => {
            const el = await createElement(tagname, 'id=modelSelect');
            await createElement('script', 'type=module', 'src=../../gc-widget-select/test/TargetBindings.js');

            await driver.executeScript('window.$test.setSelectedLabel("two")');
            await driver.executeScript('window.$test.binding.reset()');
            await driver.executeScript('window.$test.setLabels("one,two,three,four,five")');

            await driver.wait(async () => {
                const selectedLabelChanged = await driver.executeScript('return window.$test.binding.selectedLabelChanged');
                const selectedValueChanged = await driver.executeScript('return window.$test.binding.selectedValueChanged');
                const selectedIndexChanged = await driver.executeScript('return window.$test.binding.selectedIndexChanged');
                return !selectedLabelChanged && selectedValueChanged && selectedIndexChanged;
            });
        });

        it('set model values, labels, selectedValue: [selectedLabelChanged, !selectedValueChanged, selectedIndexChanged]', async () => {
            const el = await createElement(tagname, 'id=modelSelect');
            await createElement('script', 'type=module', 'src=../../gc-widget-select/test/TargetBindings.js');

            await driver.executeScript('window.$test.setSelectedValue(2)');
            await driver.executeScript('window.$test.binding.reset()');
            await driver.executeScript('window.$test.setLabels("one,two,three,four,five")');
            await driver.executeScript('window.$test.setValues("1,2,3,4,5")');

            await driver.wait(async () => {
                const selectedLabelChanged = await driver.executeScript('return window.$test.binding.selectedLabelChanged');
                const selectedValueChanged = await driver.executeScript('return window.$test.binding.selectedValueChanged');
                const selectedIndexChanged = await driver.executeScript('return window.$test.binding.selectedIndexChanged');
                return selectedLabelChanged && !selectedValueChanged && selectedIndexChanged;
            });
        });

        it('set model values, labels, selectedIndex: [selectedLabelChanged, selectedValueChanged, !selectedIndexChanged]', async () => {
            const el = await createElement(tagname, 'id=modelSelect');
            await createElement('script', 'type=module', 'src=../../gc-widget-select/test/TargetBindings.js');

            await driver.executeScript('window.$test.setSelectedIndex(2)');
            await driver.executeScript('window.$test.binding.reset()');
            await driver.executeScript('window.$test.setLabels("one,two,three,four,five")');
            await driver.executeScript('window.$test.setValues("1,2,3,4,5")');

            await driver.wait(async () => {
                const selectedLabelChanged = await driver.executeScript('return window.$test.binding.selectedLabelChanged');
                const selectedValueChanged = await driver.executeScript('return window.$test.binding.selectedValueChanged');
                const selectedIndexChanged = await driver.executeScript('return window.$test.binding.selectedIndexChanged');
                return selectedLabelChanged && selectedValueChanged && !selectedIndexChanged;
            });
        });

        it('set selectedLabel and labels', async () => {
            const el = await createElement(tagname, 'id=modelSelect');
            await createElement('script', 'type=module', 'src=../../gc-widget-select/test/TargetBindings.js');

            await driver.executeScript('window.$test.setLabels("A,B,C,D")');
            await driver.executeScript('window.$test.setValues(1,2,3,4)');

            const testData = [
                { propName: 'SelectedLabel', propValue: 'C', expectedIndex: 2, expectedValue: 3, expectedLabel: 'C' },
                { propName: 'Labels', propValue: 'C,D,E,F', expectedIndex: 0, expectedValue: 1, expectedLabel: 'C' },
                { propName: 'SelectedLabel', propValue: 'B', expectedIndex: -1, expectedValue: null, expectedLabel: 'B' },
                { propName: 'Labels', propValue: 'A,B,C,D', expectedIndex: 1, expectedValue: 2, expectedLabel: 'B' }
            ];

            for (let entry of testData) {
                await driver.executeScript(`window.$test.set${entry.propName}("${entry.propValue}")`);
                await driver.wait(async () => {
                    const index = await driver.executeScript('return window.$test.getSelectedIndex()');
                    const value = await driver.executeScript('return window.$test.getSelectedValue()');
                    const label = await driver.executeScript('return window.$test.getSelectedLabel()');
                    return index == entry.expectedIndex && value == entry.expectedValue && label == entry.expectedLabel;
                }, 2000, `Failed to set ${entry.propName}`);
            }
        });
    })
});