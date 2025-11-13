import { WebElement, By } from 'selenium-webdriver';
import { expect, default as chai } from 'chai';
import chaiAsPromise from 'chai-as-promised';
import { goto, driver, getElementProperty, setElementProperty, getShadowRoot, waitForElementEvent, querySelector } from '../../gc-core-assets/test/SeleniumDriver';

chai.use(chaiAsPromise);

const asyncFilter = async <T>(arr: Array<T>, predicate: (item: T) => Promise<boolean>) =>
    Promise.all(arr.map(predicate)).then(results => arr.filter((_, index) => results[index]));

const getVisibleTabs = async (tabs: Array<WebElement>) => asyncFilter(tabs, async item => !(await item.getAttribute('hidden')));

const getActiveTab = async (tabs: Array<WebElement>) => {
    for (let i = 0; i < tabs.length; ++i) {
        if (await tabs[i].getCssValue('display') !== 'none') {
            return tabs[i];
        }
    }
};

describe('gc-widget-tab', () => {
    let el: WebElement;
    let shadowRoot: WebElement;

    before(async () => {
        await goto('gc-widget-tab/demo');

        el = await driver.findElement(By.id('demo_element'));
        shadowRoot = await getShadowRoot(el);
    });

    beforeEach(async () => {
        let input = await driver.findElement(By.id('position'));
        await setElementProperty(input, 'selectedLabel', 'top');

        input = await driver.findElement(By.id('index'));
        await setElementProperty(input, 'value', 0);

        input = await driver.findElement(By.id('label'));
        await setElementProperty(input, 'value', 'Intro');

        input = await driver.findElement(By.id('icon_name'));
        await setElementProperty(input, 'value', 'action:home');

        input = await driver.findElement(By.id('icon_path'));
        await setElementProperty(input, 'value', '');

        input = await driver.findElement(By.id('href'));
        await setElementProperty(input, 'value', './intro.html');

        input = await driver.findElement(By.id('hidden'));
        await setElementProperty(input, 'checked', false);
    });

    /**
     * Properties
     */
    describe('properties', () => {
        it('position', async () => {
            const input = await driver.findElement(By.id('position'));

            const rootContainer = await shadowRoot.findElement(By.id('root-container'));
            await driver.wait(async () => await rootContainer.getCssValue('flex-direction') === 'column');

            await setElementProperty(input, 'selectedLabel', 'bottom');
            await driver.wait(async () => await rootContainer.getCssValue('flex-direction') === 'column-reverse');

            await setElementProperty(input, 'selectedLabel', 'left');
            await driver.wait(async () => await rootContainer.getCssValue('flex-direction') === 'row');

            await setElementProperty(input, 'selectedLabel', 'right');
            await driver.wait(async () => await rootContainer.getCssValue('flex-direction') === 'row-reverse');
        });

        it('index', async () => {
            const input = await driver.findElement(By.id('index'));
            const tabs = await el.findElements(By.css('gc-widget-tab-panel, gc-widget-link-tab-panel'));

            await driver.wait(async () => {
                const tab = await getActiveTab(tabs);
                if (!tab) return false;
                const text = await getElementProperty(tab, 'label');
                return text === 'Intro';
            });

            await setElementProperty(input, 'value', 1);
            await driver.wait(async () => {
                const tab = await getActiveTab(tabs);
                if (!tab) return false;
                const text = await getElementProperty(tab, 'label');
                return text === 'Search';
            });
        });

        it('label', async () => {
            const input = await driver.findElement(By.id('label'));
            const [intro, search, report] = await shadowRoot.findElements(By.css('#tab-selector-container > div > gc-widget-label'));
            await expect(getElementProperty(intro, 'label')).to.eventually.equal('Intro');
            await expect(getElementProperty(search, 'label')).to.eventually.equal('Search');
            await expect(getElementProperty(report, 'label')).to.eventually.equal('Report');

            await setElementProperty(input, 'value', 'foobar');
            await driver.wait(async () => await getElementProperty(intro, 'label') === 'foobar');

            await setElementProperty(input, 'value', '');
            await driver.wait(async () => {
                const labels = await shadowRoot.findElements(By.css('#tab-selector-container > div > gc-widget-label'));
                return labels.length === 2;
            });
        });

        it('no-label', async () => {
            const input = await (await driver).findElement(By.id('no_labels'));
            await driver.wait(async () => await querySelector(shadowRoot, '#tab_0 gc-widget-label') !== undefined);
            await setElementProperty(input, 'checked', true);
            await driver.wait(async () => {
                try {
                    await shadowRoot.findElement(By.css('#tab_0 gc-widget-label'));
                    return false;
                } catch {
                    return true;
                }
            });
        });

        it('has-heading', async () => {
            await setElementProperty(el, 'index', 1);

            const input = await driver.findElement(By.id('has_heading'));

            const searchPanel = await driver.findElement(By.id('demo_element_search_panel'));
            const searchPanelRoot = await getShadowRoot(searchPanel);
            await driver.wait(async () => await querySelector(searchPanelRoot, '#heading') !== undefined);

            await setElementProperty(input, 'checked', false);
            await driver.wait(async () => {
                try {
                    await searchPanelRoot.findElement(By.id('heading'));
                    return false;
                } catch {
                    return true;
                }
            });
        });

        it('icon-name', async () => {
            const input = await driver.findElement(By.id('icon_name'));
            const [intro, search, report] = await shadowRoot.findElements(By.css('#tab-selector-container > div > gc-widget-icon'));
            await expect(getElementProperty(intro, 'icon')).to.eventually.equal('action:home');
            await expect(getElementProperty(search, 'icon')).to.eventually.equal('action:search');
            await expect(getElementProperty(report, 'icon')).to.eventually.equal('action:bug_report');

            await setElementProperty(input, 'value', 'icons:add');
            await driver.wait(async () => await getElementProperty(intro, 'icon') === 'icons:add');

            await setElementProperty(input, 'value', '');
            await driver.wait(async () => {
                const icons = await shadowRoot.findElements(By.css('#tab-selector-container > div > gc-widget-icon'));
                return icons.length === 2;
            });
        });

        it('icon-path', async () => {
            const input = await driver.findElement(By.id('icon_path'));
            const [intro] = await shadowRoot.findElements(By.css('#tab-selector-container > div > gc-widget-icon'));
            await expect(getElementProperty(intro, 'path')).to.eventually.equal('');

            await setElementProperty(input, 'value', './notexist');
            await driver.wait(async () => await getElementProperty(intro, 'path') === './notexist');
        });

        it('href', async () => {
            const input = await driver.findElement(By.id('href'));
            const tabs = await el.findElements(By.css('gc-widget-link-tab-panel'));

            const [tab] = await getVisibleTabs(tabs);
            const tabShadowRoot = await getShadowRoot(tab);
            const iframe = await tabShadowRoot.findElement(By.css('iframe'));
            const src = await iframe.getAttribute('src');
            expect(src).includes('intro.html');

            await setElementProperty(input, 'value', 'http://www.google.com');
            await driver.wait(async () => (await iframe.getAttribute('src')).includes('http://www.google.com'));
        });

        it('hidden', async () => {
            const input = await driver.findElement(By.id('hidden'));
            await setElementProperty(input, 'checked', true);

            await driver.wait(async () => {
                const tabs = await el.findElements(By.css('gc-widget-tab-panel, gc-widget-link-tab-panel'));
                return (await getVisibleTabs(tabs)).length === 2;
            });
        });
    });

    /**
     * Styles
     */
    describe('Styles', () => {
        it('active', async () => {
            driver.wait(async () => {
                const [intro, search, report] = await shadowRoot.findElements(By.css('#tab-selector-container > div'));
                return (intro && search && report) &&
                    await intro.getCssValue('border-color') === 'rgb(85, 85, 85) rgb(85, 85, 85) rgb(204, 0, 0)' &&
                    await search.getCssValue('border-color') === 'rgb(85, 85, 85) rgb(85, 85, 85) rgba(0, 0, 0, 0)' &&
                    await report.getCssValue('border-color') === 'rgb(85, 85, 85) rgb(85, 85, 85) rgba(0, 0, 0, 0)';
            });
        });
    });

    /**
     * Events
     */
    describe('Events', () => {
        it('index-changed', done  => {
            (async () => {
                await waitForElementEvent<{value: boolean}>(el, 'index-changed', () => done());
                await setElementProperty(el, 'index', 1);
            })();
        });
    });
});