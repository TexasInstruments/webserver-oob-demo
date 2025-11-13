/* eslint-disable @typescript-eslint/brace-style */
import { WebElement, By, Key } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, querySelector, waitForElementEvent, querySelectorAll, createScript } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

['select', 'filter'].forEach(type => describe(`gc-widget-select (type=${type})`, () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let tiInput: WebElement;
    let htmlInput: WebElement;
    let clearIcon: WebElement;

    before(async () => {
        await goto('gc-widget-select/demo');

        el = await driver.findElement(By.id(`demo_element_${type}`));
        shadowRoot = await getShadowRoot(el);

        const inputFilter = await querySelector(shadowRoot, 'gc-widget-input-filter');
        let root = await getShadowRoot(inputFilter);
        if (type === 'filter') {
            clearIcon = await querySelector(root, 'gc-widget-icon');
        }
        const input = await querySelector(root, 'gc-widget-input');
        root = await getShadowRoot(input);
        tiInput = await querySelector(root, 'ti-input');
        root = await getShadowRoot(tiInput);
        htmlInput = await querySelector(root, 'input');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('readonly'));
        await setElementProperty(input, 'checked', false);

        await htmlInput.sendKeys(Key.ESCAPE);

        input = await driver.findElement(By.id('labels'));
        await setElementProperty(input, 'value', 'one|two|three|four|five');

        input = await driver.findElement(By.id('values'));
        await setElementProperty(input, 'value', '1|2|3|4|5');

        input = await driver.findElement(By.id('pattern'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('placeholder'));
        await setElementProperty(input, 'value', 'It is wonderful day!');

        input = await driver.findElement(By.id('sorted'));
        await setElementProperty(input, 'checked', true);

        input = await driver.findElement(By.id('max_visible_items'));
        await setElementProperty(input, 'value', 4);

        input = await driver.findElement(By.id('selected_index'));
        await setElementProperty(input, 'value', 3);

        input = await driver.findElement(By.id('selected_label'));
        await setElementProperty(input, 'value', 'two');

        input = await driver.findElement(By.id('selected_value'));
        await setElementProperty(input, 'value', 2);

        input = await driver.findElement(By.id('auto_open'));
        await setElementProperty(input, 'checked', true);

        input = await driver.findElement(By.id('filter_text'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('text_align'));
        await setElementProperty(input, 'selectedValue', '');
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('labels', async () => {

            const input = await driver.findElement(By.id('labels'));
            await setElementProperty(input, 'value', 'five|four|three|two|one|zero');
            await htmlInput.sendKeys(Key.F2);

            await driver.wait(async () => {
                const menuItems = await querySelectorAll(shadowRoot, '#menu .menu-item');
                return (type === 'select' && menuItems?.length === 6) ||
                        (type === 'filter' && menuItems?.length === 1);
            });
        });

        it('values', async () => {
            const input = await driver.findElement(By.id('values'));
            await setElementProperty(input, 'value', '1|2|3|4|5');
            await setElementProperty(el, 'selectedValue', 3);
            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === 'three');
        });

        it('placeholder', async function () {
            const input = await driver.findElement(By.id('placeholder'));
            await setElementProperty(input, 'value', 'foobar');

            await driver.wait(async () => await getElementProperty(htmlInput, 'placeholder') === 'foobar');
        });

        it('sorted', async () => {
            await htmlInput.sendKeys(Key.F2);
            await driver.wait(async () => {
                const menuItems = await querySelectorAll(shadowRoot, '#menu .menu-item');
                const result = await Promise.all(menuItems.map(async (element, index) => {
                    return element.getText();
                }));
                return result.toString() === ['five', 'four', 'one', 'three', 'two'].toString();
            });

            const input = await driver.findElement(By.id('sorted'));
            await setElementProperty(input, 'checked', false);
            await htmlInput.sendKeys(Key.F2);

            if (type === 'filter') {
                const filter = await driver.findElement(By.id('filter_text'));
                await setElementProperty(filter, 'value', '');
            }

            await driver.wait(async () => {
                const menuItems = await querySelectorAll(shadowRoot, '#menu .menu-item');
                const result = await Promise.all(menuItems.map(async (element, index) => {
                    return element.getText();
                }));
                return result.toString() === ['one', 'two', 'three', 'four', 'five'].toString();
            });
        });

        it('max-visible-items', async () => {
            if (type === 'filter') {
                await clearIcon.click();
            }

            const input = await driver.findElement(By.id('max_visible_items'));
            await setElementProperty(input, 'value', 3);

            await htmlInput.sendKeys(Key.F2);
            await driver.wait(async () => {
                let height = await (await querySelector(shadowRoot, '#menu')).getCssValue('height');
                height = height.replace('px', '');
                return +height === 104;
            });
        });

        it('selected-index', async () => {
            const input = await driver.findElement(By.id('selected_index'));
            await setElementProperty(input, 'value', 0);

            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === 'one');
        });

        it('selected-value', async () => {
            const input = await driver.findElement(By.id('selected_value'));
            await setElementProperty(input, 'value', 3);

            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === 'three');
        });

        it('selected-label', async () => {
            const input = await driver.findElement(By.id('selected_label'));
            await setElementProperty(input, 'value', 'three');

            await driver.wait(async () => await getElementProperty(htmlInput, 'value') === 'three');
        });

        if (type === 'filter') {
            it('auto-open', async function() {
                const input = await driver.findElement(By.id('auto_open'));
                await setElementProperty(input, 'checked', true);

                await htmlInput.click();
                await driver.wait(async () => (await querySelectorAll(shadowRoot, '#menu .menu-item')).length >= 1);
            });
        }

        if (type === 'filter') {
            it('filter-text', async function () {
                const input = await driver.findElement(By.id('filter_text'));
                await setElementProperty(input, 'value', 'o');

                await htmlInput.click();
                await driver.wait(async () => (await querySelectorAll(shadowRoot, '#menu .menu-item')).length === 3);
            });
        }

        if (type === 'filter') {
            it('pattern', async () => {
                const input = await driver.findElement(By.id('pattern'));
                await setElementProperty(input, 'value', '[0-9]*');

                await clearIcon.click();
                await el.click();
                await htmlInput.sendKeys('hello1234567890world');

                const filter = await driver.findElement(By.id('filter_text'));
                //@ts-ignore
                await driver.wait(async () => !isNaN(+(await getElementProperty(filter, 'value'))) );
            });
        }

        it('disabled', async () => {
            const input = await driver.findElement(By.id('disabled'));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => await tiInput.getCssValue('cursor') === 'not-allowed');
        });

        it('readonly', async () => {
            const input = await driver.findElement(By.id('readonly'));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => await tiInput.getCssValue('pointer-events') === 'none');
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('disabled', async () => {
            const input = (await driver.findElement(By.id('disabled')));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => (await el.getCssValue('background-color')).includes('229, 229, 229'));
            await driver.wait(async () => (await htmlInput.getCssValue('cursor')) === 'not-allowed');
        });

        it('--gc-text-align', async () => {
            const input = (await driver.findElement(By.id('text_align')));
            await setElementProperty(input, 'selectedLabel', 'center');

            const htmlInput = await querySelector(await getShadowRoot(tiInput), 'input');

            await driver.wait(async () => (await htmlInput.getCssValue('text-align')) === 'center');
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
        it('selected-index-changed', done => {
            (async () => {
                await waitForElementEvent<{value: number}>(el, 'selected-index-changed', detail => {
                    let error = undefined;
                    try { expect(detail.value).eq(3); }
                    catch (e) { error = e; }
                    done(error);
                });

                await setElementProperty(el, 'selectedIndex', 3);
            })();
        });

        it('selected-value-changed', done => {
            (async () => {
                await waitForElementEvent<{value: string}>(el, 'selected-value-changed', detail => {
                    let error = undefined;
                    try { expect(+detail.value).eq(4); }
                    catch (e) { error = e; };
                    done(error);
                });

                await setElementProperty(el, 'selectedValue', 4);
            })();
        });

        it('selected-label-changed', done => {
            (async () => {
                await waitForElementEvent<{value: string}>(el, 'selected-label-changed', detail => {
                    let error = undefined;
                    try { expect(detail.value).eq('five'); }
                    catch (e) { error = e; }
                    done(error);
                });

                await setElementProperty(el, 'selectedLabel', 'five');
            })();
        });
    });

    /**
     * Other test cases
     */
    describe('Others', () => {
        if (type === 'filter') {
            it('Uncommitted icon', async () => {
                await htmlInput.sendKeys('abc');
                await driver.wait(async () => {
                    const icon = await querySelector(shadowRoot, '#warning-icon')
                    return icon !== undefined
                });
            });

            it('setFilterFunction', async () => {
                try {
                    await createScript('document.querySelector("#demo_element_filter").setFilterFunction( options => options )');

                    const icon = await querySelector(shadowRoot, '#menu-icon');
                    await icon.click();
                    await setElementProperty(el, 'filterText', 'foobar');
                    await driver.wait(async () => {
                        let height = await (await querySelector(shadowRoot, '#menu')).getCssValue('height');
                        height = height.replace('px', '');
                        return +height === 138;
                    });
                } finally {
                    await createScript('document.querySelector("#demo_element_filter").setFilterFunction( undefined )');
                }
            });

        }
    });
}));