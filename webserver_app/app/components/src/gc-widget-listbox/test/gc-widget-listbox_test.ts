import { expect } from 'chai';
import { WebElement, By } from 'selenium-webdriver';
import { driver, getActions, goto, setElementProperty, waitForElementEvent, getShadowRoot, getElementProperty } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-listbox', () => {
    let el: WebElement;
    let shadowRoot: WebElement;

    before(async () => {
        await goto('gc-widget-listbox/demo');
        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('labels'));
        await setElementProperty(input, 'value', 'dummy');
        await setElementProperty(input, 'value', 'one,two,three,four,five');

        input = await driver.findElement(By.id('values'));
        await setElementProperty(input, 'value', 'dummy');
        await setElementProperty(input, 'value', 'o,tw,th,fo,fi');

        input = await driver.findElement(By.id('sorted'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('has_delete_icon'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('selected_index'));
        await setElementProperty(input, 'value', 2);

        input = await driver.findElement(By.id('selected_label'));
        await setElementProperty(input, 'value', 'three');

        input = await driver.findElement(By.id('selected_value'));
        await setElementProperty(input, 'value', 'th');

        input = await driver.findElement(By.id('readonly'));
        await setElementProperty(input, 'checked', false);

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('labels', async () => {
            const input = await driver.findElement(By.id('labels'));
            await setElementProperty(input, 'value', 'foo,boo,zoo,kaa');
            await driver.wait(async () => {
                const rows = await shadowRoot.findElements(By.className('row'));
                return rows.length === 4 &&
                    await rows[0].getText() === 'foo' &&
                    await rows[3].getText() === 'kaa';
            });
        });

        it('values', async () => {
            const input = await driver.findElement(By.id('values'));
            await setElementProperty(input, 'value', 'foo,boo,zoo,kaa');
            await setElementProperty(el, 'selectedIndex', 1);
            let selectedValue = await getElementProperty(el, 'selectedValue');
            expect(selectedValue, 'boo');

            await setElementProperty(el, 'selectedIndex', 3);
            selectedValue = await getElementProperty(el, 'selectedValue');
            expect(selectedValue, 'kaa');
        });

        it('initial-index', async () => {
            await driver.wait(async () => {
                const { 2: row } = await shadowRoot.findElements(By.className('row'));
                return (await row.getAttribute('class')).indexOf('selected') !== -1;
            });
        });

        it('sorted', async () => {
            const input = await driver.findElement(By.id('sorted'));
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () => {
                const rows = await shadowRoot.findElements(By.className('row'));
                return rows.length === 5 &&
                    await rows[0].getText() === 'five' &&
                    await rows[1].getText() === 'four' &&
                    await rows[2].getText() === 'one' &&
                    await rows[3].getText() === 'three' &&
                    await rows[4].getText() === 'two';
            });
        });

        it('has-delete-icon', async () => {
            const input = await driver.findElement(By.id('has_delete_icon'));
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () => {
                const { 2: row } = await shadowRoot.findElements(By.className('row'));
                const icon = await row.findElement(By.css('gc-widget-icon'));
                if (icon === undefined) return false;

                const label = await row.findElement(By.className('label'));
                await getActions().move({ origin: label }).perform();
                await icon.click();
                await driver.wait(async () => {
                    const rows = await shadowRoot.findElements(By.className('row'));
                    return rows.length === 4;
                });

                return true;
            });
        });

        it('selected-index', async () => {
            const input = await driver.findElement(By.id('selected_index'));
            await setElementProperty(input, 'value', 3);

            await driver.wait(async () => {
                const { 3: row } = await shadowRoot.findElements(By.className('row'));
                return (await row.getAttribute('class')).indexOf('selected') !== -1;
            });

            await setElementProperty(input, 'value', -1);
            await driver.wait(async () => {
                const { 3: row } = await shadowRoot.findElements(By.className('row'));
                return (await row.getAttribute('class')).indexOf('selected') !== -1;
            });
        });

        it('selected-label', async () => {
            const input = await driver.findElement(By.id('selected_label'));
            await setElementProperty(input, 'value', 'four');

            await driver.wait(async () => {
                const { 3: row } = await shadowRoot.findElements(By.className('row'));
                return (await row.getAttribute('class')).indexOf('selected') !== -1;
            });

            await setElementProperty(input, 'value', 'foobar');
            await driver.wait(async () => {
                const { 3: row } = await shadowRoot.findElements(By.className('row'));
                return (await row.getAttribute('class')).indexOf('selected') !== -1;
            });
        });

        it('selected-value', async () => {
            const input = await driver.findElement(By.id('selected_value'));
            await setElementProperty(input, 'value', 'fo');

            await driver.wait(async () => {
                const { 3: row } = await shadowRoot.findElements(By.className('row'));
                return (await row.getAttribute('class')).indexOf('selected') !== -1;
            });

            await setElementProperty(input, 'value', 'zookar');
            await driver.wait(async () => {
                const { 3: row } = await shadowRoot.findElements(By.className('row'));
                return (await row.getAttribute('class')).indexOf('selected') !== -1;
            });
        });

        it('readonly', async () => {
            const input = await driver.findElement(By.id('readonly'));
            await setElementProperty(input, 'checked', true);

            const { 1: row } = await shadowRoot.findElements(By.className('row'));
            const label = await row.findElement(By.className('label'));
            await label.click();

            expect(await getElementProperty(el, 'selectedIndex')).eq(2);
        });

        it('disabled', async () => {
            const input = await driver.findElement(By.id('disabled'));
            await setElementProperty(input, 'checked', true);

            const { 1: row } = await shadowRoot.findElements(By.className('row'));
            const label = await row.findElement(By.className('label'));
            await label.click();

            expect(await getElementProperty(el, 'selectedIndex')).eq(2);
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('disabled', async () => {
            const input = await driver.findElement(By.id('disabled'));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => {
                const cursor = await el.getCssValue('cursor');
                const bgColor = await el.getCssValue('background-color');
                return cursor === 'not-allowed' && bgColor.indexOf('229, 229, 229') !== -1;
            });
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
                    try {
                        expect(detail.value).eq(3);
                    } catch (e) {
                        error = e;
                    };
                    done(error);
                });

                setElementProperty(el, 'selectedIndex', 3);
            })();
        });

        it('selected-value-changed', done => {
            (async () => {
                await waitForElementEvent<{value: string}>(el, 'selected-value-changed', detail => {
                    let error = undefined;
                    try {
                        expect(detail.value).eq('fo');
                    } catch (e) {
                        error = e;
                    };
                    done(error);
                });

                setElementProperty(el, 'selectedValue', 'fo');
            })();
        });

        it('selected-label-changed', done => {
            (async () => {
                await waitForElementEvent<{value: string}>(el, 'selected-label-changed', detail => {
                    let error = undefined;
                    try {
                        expect(detail.value).eq('four');
                    } catch (e) {
                        error = e;
                    };
                    done(error);
                });

                setElementProperty(el, 'selectedLabel', 'four');
            })();
        });
    });
});