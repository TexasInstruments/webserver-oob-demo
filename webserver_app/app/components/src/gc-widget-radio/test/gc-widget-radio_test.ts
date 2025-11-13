import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, setElementProperty, getShadowRoot, querySelector, waitForElementEvent, invokeElementMethod, getElementProperty } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

let el: WebElement;
let elItem: WebElement;

const doBefore = async () => {
    await goto('gc-widget-radio/demo');

    el = await driver.findElement(By.id('demo_element'));
    elItem = await driver.findElement(By.id('demo_element_item'));
};

const doBeforeEach = async () => {
    let input = await driver.findElement(By.id('layout'));
    await setElementProperty(input, 'selectedLabel', 'vertical');

    input = await driver.findElement(By.id('selected_index'));
    await setElementProperty(input, 'value', 0);

    input = await driver.findElement(By.id('selected_value'));
    await setElementProperty(input, 'value', 'm');

    input = await driver.findElement(By.id('selected_label'));
    await setElementProperty(input, 'value', 'Medium');

    input = await driver.findElement(By.id('disabled'));
    await setElementProperty(input, 'checked', false);
};

describe('gc-widget-radio-group', async () => {
    before(doBefore);
    beforeEach(doBeforeEach);

    /**
     * Properties
     */
    describe('Properties', () => {
        it('selected-index', async () => {
            const input = await driver.findElement(By.id('selected_index'));
            await setElementProperty(input, 'value', 2);

            const tiRadio = await querySelector(
                await getShadowRoot(
                    await querySelector(el, 'gc-widget-radio[value="l"]')
                ), 'ti-radio'
            );
            await driver.wait(async () => await tiRadio.getAttribute('aria-checked') === '');
        });

        it('selected-value', async () => {
            const input = await driver.findElement(By.id('selected_value'));
            await setElementProperty(input, 'value', 's');

            const tiRadio = await querySelector(
                await getShadowRoot(
                    await querySelector(el, 'gc-widget-radio[value="s"]')
                ), 'ti-radio'
            );
            await driver.wait(async () => await tiRadio.getAttribute('aria-checked') === '');
        });

        it('selected-label', async () => {
            const input = await driver.findElement(By.id('selected_label'));
            await setElementProperty(input, 'value', 'Large');

            const tiRadio = await querySelector(
                await getShadowRoot(
                    await querySelector(el, 'gc-widget-radio[value="l"]')
                ), 'ti-radio'
            );
            await driver.wait(async () => await tiRadio.getAttribute('aria-checked') !== null);
        });

        it('disabled', async () => {
            const input = await driver.findElement(By.id('disabled'));
            await setElementProperty(input, 'checked', true);

            /* disabled */
            for (const value of ['s', 'm', 'l']) {
                const tiRadio = await querySelector(
                    await getShadowRoot(
                        await querySelector(el, `gc-widget-radio[value="${value}"]`)
                    ), 'ti-radio'
                );
                await driver.wait(async () => await tiRadio.getAttribute('aria-disabled') === 'true');
            }

            /* enabled */
            await setElementProperty(input, 'checked', false);
            for (const value of ['s', 'm', 'l']) {
                const tiRadio = await querySelector(
                    await getShadowRoot(
                        await querySelector(el, `gc-widget-radio[value="${value}"]`)
                    ), 'ti-radio'
                );
                await driver.wait(async () => await tiRadio.getAttribute('aria-disabled') === null);
            }
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('layout', async () => {
            const input = await driver.findElement(By.id('layout'));
            await setElementProperty(input, 'selectedLabel', 'horizontal');

            const shadowRoot = await getShadowRoot(el);
            const tiRadioGroup = await querySelector(shadowRoot, 'ti-radio-group');
            await driver.wait(async () => await tiRadioGroup.getCssValue('flex-direction') === 'row');
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
        it('selected-index-changed', done  => {
            (async () => {
                await waitForElementEvent(el, 'selected-index-changed', () => done());
                setElementProperty(el, 'selectedIndex', 0);
            })();
        });

        it('selected-value-changed', done  => {
            (async () => {
                await waitForElementEvent(el, 'selected-value-changed', () => done());
                setElementProperty(el, 'selectedValue', 's');
            })();
        });

        it('selected-label-changed', done  => {
            (async () => {
                await waitForElementEvent(el, 'selected-label-changed', () => done());
                setElementProperty(el, 'selectedLabel', 'Small');
            })();
        });
    });
});

describe('gc-widget-radio', () => {
    before(doBefore);
    beforeEach(doBeforeEach);

    /**
     * Properties
     */
    describe('Properties', () => {
        it('label', async () => {
            const input = await driver.findElement(By.id('radio__label'));
            await setElementProperty(input, 'value', 'Foobar');
            await setElementProperty(el, 'selectedIndex', 0);

            const label = await querySelector(await getShadowRoot(elItem), 'div[class="label"]');
            await driver.wait(async () => await label.getText() === 'Foobar');
        });

        it('label-when-checked', async () => {
            const input = await driver.findElement(By.id('radio__label_when_checked'));
            await setElementProperty(input, 'value', 'Zooka');
            await setElementProperty(el, 'selectedIndex', 1);

            const label = await querySelector(await getShadowRoot(elItem), 'div[class="labelWhenChecked"]');
            await driver.wait(async () => await label.getText() === 'Zooka');
        });

        it('checked', async () => {
            const input = await driver.findElement(By.id('radio__checked'));
            await setElementProperty(input, 'checked', false);

            const tiRadio = await querySelector(await getShadowRoot(elItem), 'ti-radio');
            await driver.wait(async () => await tiRadio.getAttribute('aria-checked') === null);

            await setElementProperty(input, 'checked', true);
            await driver.wait(async () => await tiRadio.getAttribute('aria-checked') !== null);
        });

        it('value', async () => {
            const tiRadio = await querySelector(await getShadowRoot(elItem), 'ti-radio');
            expect(await getElementProperty(tiRadio, 'value')).eq('m');
        });

        it('disabled', async () => {
            const input = await driver.findElement(By.id('radio__disabled'));
            await setElementProperty(input, 'checked', true);

            const tiRadio = await querySelector(await getShadowRoot(elItem), 'ti-radio');
            await driver.wait(async () => await tiRadio.getCssValue('cursor') === 'not-allowed');

            const label = await querySelector(await getShadowRoot(elItem), 'div[class="label"]');
            await driver.wait(async () => await label.getCssValue('cursor') === 'not-allowed');
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('disabled', async () => {
            const input = await driver.findElement(By.id('radio__disabled'));
            await setElementProperty(input, 'checked', true);

            const tiRadio = await querySelector(await getShadowRoot(elItem), 'ti-radio');
            await driver.wait(async () => await tiRadio.getCssValue('opacity') === '0.5');
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
        it('checked-changed', done  => {
            (async () => {
                await waitForElementEvent(elItem, 'checked-changed', () => done());
                setElementProperty(el, 'selectedIndex', 0);
            })();
        });
    });
});