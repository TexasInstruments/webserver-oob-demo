import { WebElement, By } from 'selenium-webdriver';
import { goto, getActions, driver, getShadowRoot, querySelector, setElementProperty } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-image', () => {
    let el: WebElement;
    let shadowRoot: WebElement;
    let shadowImg: WebElement;

    before(async () => {
        await goto('gc-widget-image/demo/gc-widget-image.html');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
        shadowImg = await querySelector(shadowRoot, 'img');
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('file_path'));
        await setElementProperty(input, 'selectedValue', 'assets/venus/frame-01.gif');

        input = await driver.findElement(By.id('lock_aspect_ratio'));
        await setElementProperty(input, 'checked', true);

        input = await driver.findElement(By.id('hover_effect'));
        await setElementProperty(input, 'selectedIndex', 0);

        input = await driver.findElement(By.id('disabled'));
        await setElementProperty(input, 'checked', false);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('file-path', async () => {
            await driver.wait(async () => (await shadowImg.getAttribute('src')).indexOf('assets/venus/frame-01.gif') !== -1);
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

        it('disabled', async () => {
            const dis = await driver.findElement(By.id('disabled'));
            await driver.wait(async() => await shadowImg.getCssValue('filter') === 'none');
            await setElementProperty(dis, 'checked', true);
            await driver.wait(async() =>  await shadowImg.getCssValue('filter') === 'grayscale(1) blur(2px) brightness(0.75)');
        });
    });
});