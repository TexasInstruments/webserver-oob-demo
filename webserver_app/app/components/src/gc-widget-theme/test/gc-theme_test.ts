import { WebElement, By } from 'selenium-webdriver';
import { goto, driver, setElementProperty, querySelector } from '../../gc-core-assets/test/SeleniumDriver';

describe('gc-widget-theme', () => {
    let primaryColor: WebElement;
    let secondaryColor: WebElement;
    let tertiaryColor: WebElement;

    let backgroundColor: WebElement;
    let backgroundColorDisabled: WebElement;
    let fontColor: WebElement;
    let headerFontColor: WebElement;


    before(async () => {
        await goto('gc-widget-theme/demo');

        primaryColor = await driver.findElement(By.id('primaryColor'));
        secondaryColor = await driver.findElement(By.id('secondaryColor'));
        tertiaryColor = await driver.findElement(By.id('tertiaryColor'));

        backgroundColor = await driver.findElement(By.id('backgroundColor'));
        backgroundColorDisabled = await driver.findElement(By.id('backgroundColorDisabled'));
        fontColor = await driver.findElement(By.id('fontColor'));
        headerFontColor = await driver.findElement(By.id('headerFontColor'));
    });

    beforeEach(async () => {
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('theme_files', async () => {

            await driver.wait(async () => {
                //light theme
                const primaryColorC = await primaryColor.getCssValue('color');
                const secondaryColorC = await secondaryColor.getCssValue('color');
                const tertiaryColorC = await tertiaryColor.getCssValue('color');

                const backgroundColorC = await backgroundColor.getCssValue('color');
                const backgroundColorDisabledC = await backgroundColorDisabled.getCssValue('color');
                const fontColorC = await fontColor.getCssValue('color');
                const headerFontColorC = await headerFontColor.getCssValue('color');
                return primaryColorC.includes('204, 0, 0') &&
                secondaryColorC.includes('17, 136, 153') &&
                tertiaryColorC.includes('99, 102, 106') &&
                backgroundColorC.includes('255, 255, 255') &&
                backgroundColorDisabledC.includes('229, 229, 229') &&
                fontColorC.includes('85, 85, 85') &&
                headerFontColorC.includes('35, 31, 32');
            });

            const input = (await driver.findElement(By.id('theme_index')));
            await setElementProperty(input, 'selectedLabel', '1');
            await driver.wait(async () => {
                //dark theme
                const primaryColorC = await primaryColor.getCssValue('color');
                const secondaryColorC = await secondaryColor.getCssValue('color');
                const tertiaryColorC = await tertiaryColor.getCssValue('color');

                const backgroundColorC = await backgroundColor.getCssValue('color');
                const backgroundColorDisabledC = await backgroundColorDisabled.getCssValue('color');
                const fontColorC = await fontColor.getCssValue('color');
                const headerFontColorC = await headerFontColor.getCssValue('color');

                return primaryColorC.includes('153, 0, 0') &&
                secondaryColorC.includes('17, 85, 102') &&
                tertiaryColorC.includes('99, 102, 106') &&
                backgroundColorC.includes('35, 31, 32') &&
                backgroundColorDisabledC.includes('99, 102, 106') &&
                fontColorC.includes('242, 242, 242') &&
                headerFontColorC.includes('242, 242, 242');
            });

            await setElementProperty(input, 'selectedLabel', '3');
            await driver.wait(async () => {
                // partial css change
                const primaryColorC = await primaryColor.getCssValue('color');
                const secondaryColorC = await secondaryColor.getCssValue('color');
                const tertiaryColorC = await tertiaryColor.getCssValue('color');

                const backgroundColorC = await backgroundColor.getCssValue('color');
                const backgroundColorDisabledC = await backgroundColorDisabled.getCssValue('color');
                const fontColorC = await fontColor.getCssValue('color');
                const headerFontColorC = await headerFontColor.getCssValue('color');

                return primaryColorC.includes('59, 97, 76') &&
                secondaryColorC.includes('17, 136, 153') &&
                tertiaryColorC.includes('99, 102, 106') &&
                backgroundColorC.includes('162, 179, 158') &&
                backgroundColorDisabledC.includes('229, 229, 229') &&
                fontColorC.includes('29, 41, 32') &&
                headerFontColorC.includes('35, 31, 32');
            });
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
    });

    /**
     * Events
     */
    describe('Events', () => {
    });
});