import { WebElement, By } from 'selenium-webdriver';
import { goto, getActions, driver, getShadowRoot, querySelector, setElementProperty } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-multi-image', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let shadowImg: WebElement;

    before(async () => {
        await goto('gc-widget-image/demo/gc-widget-multi-image.html');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);

        const imageWidget = await querySelector(shadowRoot, 'gc-widget-image');
        const innerShadowRoot = await getShadowRoot(imageWidget);
        shadowImg = await querySelector(innerShadowRoot, 'img');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('file_paths'));
        await setElementProperty(input, 'value', 'frame-10.gif, frame-20.gif, frame-30.gif',);

        input = await driver.findElement(By.id('folder_path'));
        await setElementProperty(input, 'value', './assets/venus');

        input = await driver.findElement(By.id('lock_aspect_ratio'));
        await setElementProperty(input, 'checked', true);

        input = await driver.findElement(By.id('hover_effect'));
        await setElementProperty(input, 'selectedIndex', 0);

        input = await driver.findElement(By.id('selected_index'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('values'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('selected_value'));
        await setElementProperty(input, 'value', 1);

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('file-paths', async () => {
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('assets/venus/frame-10.gif') !== -1);
        });

        it('folder-path', async () => {
            const fol = await driver.findElement(By.id('folder_path'));
            await setElementProperty(fol, 'value', '');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('demo/frame-10.gif') !== -1);
        });

        it('lock-aspect-ratio', async () => {
            const lar = await driver.findElement(By.id('lock_aspect_ratio'));
            await driver.wait(async() => await shadowImg.getCssValue('width') === '160px');
            await setElementProperty(lar, 'checked', false);
            await driver.wait(async() => await shadowImg.getCssValue('width') === '240px');
        });

        it('hover-effect', async () => {
            const hov = await driver.findElement(By.id('hover_effect'));
            await getActions().move({ origin: el }).perform();
            await setElementProperty( hov, 'selectedIndex', 1);
            await driver.wait(async () => (await el.getCssValue('box-shadow')).indexOf('158, 214, 223') !== -1);
            await setElementProperty( hov, 'selectedIndex', 2);
            await driver.wait(async () => (await el.getCssValue('transform')) === 'matrix(1.02, 0, 0, 1.02, 0, 0)');
            await setElementProperty( hov, 'selectedIndex', 3);
            await driver.wait(async () => (await el.getCssValue('box-shadow')).indexOf('0px 2px 4px -1px') !== -1);
        });


        it('selected-index', async () => {
            const sel = await driver.findElement(By.id('selected_index'));
            await setElementProperty(sel, 'value', '1');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('frame-20.gif') !== -1);

            await setElementProperty(sel, 'value', '42');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('data:image/svg') === 0);

            await setElementProperty(sel, 'value', '2');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('frame-30.gif') !== -1);

            await setElementProperty(sel, 'value', '-1');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('data:image/svg') === 0);
        });

        it('selected-value', async () => {
            const sel = await driver.findElement(By.id('selected_value'));
            const val = await driver.findElement(By.id('values'));
            await setElementProperty(val, 'value', 'one, two, three');

            await setElementProperty(sel, 'value', 'three');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('frame-30.gif') !== -1);

            await setElementProperty(sel, 'value', 'two');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('frame-20.gif') !== -1);

            await setElementProperty(sel, 'value', 'one');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('frame-10.gif') !== -1);

            await setElementProperty(sel, 'value', 'foobar');
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('data:image/svg+xml') !== -1);
        });

        it('disabled', async () => {
            const dis = await driver.findElement(By.id('disabled'));
            await driver.wait(async() => await shadowImg.getCssValue('filter') === 'none');
            await setElementProperty(dis, 'checked', true);
            await driver.wait(async() =>  await shadowImg.getCssValue('filter') === 'grayscale(1) blur(2px) brightness(0.75)');
        });
    });
});