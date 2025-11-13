/**
 *  Copyright (c) 2021, Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  *   Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *  *   Neither the name of Texas Instruments Incorporated nor the names of
 *  its contributors may be used to endorse or promote products derived
 *  from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { GcConsole } from '../../gc-core-assets/lib/GcConsole';

/* eslint-disable @typescript-eslint/no-explicit-any */

// TODO: define types or convert to use htmlParser typescript when ready
export type HtmlParser = any;
export type StyleRule = any;

export type ElementBlock = {
    name: string;
    children: Array<ElementBlock>;
    parentElement: ElementBlock;
    attributes: { [index: string]: any };

    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    renameAttribute(fromName: string, toName: string): void;

    setStyle(styleName: string, value: string): void;

    rename(name: string): void;
    removeChild(child: ElementBlock): void;
    detached(): void;

};
export type StyleElement = {
    name: string;
    rules: Array<StyleRule>;
    attributes: { [index: string]: string };

    removeRule(rule: StyleRule): void;
    insertRule(rule: StyleRule|string, beforeIndex: number): void;
    removeAttribute(name: string): void;
};

type Gist = {
    stylesheets: Array<StyleElement>;
    root: ElementBlock;
    htmlParser: HtmlParser;
};

export interface IElementMigrator {
    path: string;
    getSupportedElements(): undefined | Record<string, (element: ElementBlock, fromLibVer: Version, toLibVer: Version) => Promise<void>>;
}

/**
 * The migration manager callback.
 */
export interface IMigrationManagerCallback {
    /**
     * Purge the import links, for example `components/ti-widget-common/ti-widget-button.html`.
     * @param imports the import links
     */
    purgeImport(...imports: Array<string>): void;

    /**
     * Adds a list of element blocks that were migrated.
     * @param elements the element blocks
     */
    addConsumed(...elements: Array<ElementBlock>): void;

    /**
     * Hand off the partially migrated element to the next migrator.
     * @param element the element to handed off
     */
    doMigrateElement(element: ElementBlock, fromLibVer: Version): Promise<void>;
}

/**
 * Version class.
 */
export class Version {
    constructor(readonly major: number, readonly minor: number, readonly revision: number) {}

    /**
     * Compares the two versions, Return 1 if v1 > v2, -1 if v1 < v2, otherwise 0.
     *
     * @param v1
     * @param v2
     */
    static compareVersions (v1: Version, v2: Version): -1 | 0 | 1 {
        const _v1 = [v1.major, v1.minor, v1.revision];
        const _v2 = [v2.major, v2.minor, v2.revision];

        for (let i = 0; i < 3; ++i) {
            if (_v1[i] > _v2[i]) return 1;  // v1 is bigger
            if (_v1[i] < _v2[i]) return -1; // v2 is bigger
        }

        return 0;                           // v1 === v2
    }

    static parse(verText: string): Version {
        if (typeof verText === 'string') {
            const segments = verText.split('.');
            return {
                major: segments[0] ? +segments[0] : 0,
                minor: segments[1] ? +segments[1] : 0,
                revision: segments[2] ? +segments[2] : 0
            };
        }
        return { major: 0, minor: 0, revision: 0 };
    }
}
const MAJOR_VER = 3;
export const V3_0_0 = new Version(MAJOR_VER, 0, 0);
export const V1_5_0 = new Version(1, 5, 0);

const LOGGER_NAME = 'MigrationManager';
export class MigrationManager {
    private gist?: Gist;
    private elementMigrators: { [index: string]: IElementMigrator } = {};
    private migratedElements: Array<ElementBlock> = [];
    private importsToPurge: Array<string> = [];

    constructor(
        readonly logger: GcConsole,
        readonly componentManifestJsonPath: string,
        readonly componentRootPath: string) {
    }

    private async getFileReader(): Promise<{ readJsonFile(path: string): Promise<any>; readTextFile(path: string): Promise<any> }> {
        let fileReader = window['gc'].fileCache;
        if (!fileReader) {
            // @ts-ignore
            fileReader = (await import('../../gc-core-assets/lib/GcFiles')).GcFiles;
        }
        return fileReader;
    }

    private async getElementCollection() {
        const entries = ((await (await this.getFileReader()).readJsonFile(this.componentManifestJsonPath)) as any).entries;
        return entries.map((entry: string) => entry.replace(/\\/g, '/').split('/')[0]);
    }

    private async getElementMigrators(htmlParser: HtmlParser, migrationManagerCallback: IMigrationManagerCallback) {
        const migrators = {};
        const elementCollection = await this.getElementCollection();

        for (const element of elementCollection) {
            try {
                const migratorPath = `${this.componentRootPath}/${element}/migration`;

                // @ts-ignore
                const module = (await import(`${migratorPath}/index.js`));
                const migrator = new module.default(migratorPath, htmlParser, migrationManagerCallback);

                // @ts-ignore
                migrators[element] = migrator;
            } catch (e) { /* ignore - debugger will print the error */ }
        }

        return migrators;
    }

    async getMigratorChangeLogs(migrator: IElementMigrator, fromLibVer: Version, toLibVer: Version): Promise<Array<{ version: Version; changes: string }>> {
        const mdPath = `${migrator.path}/changelogs.md`;
        const changeLogText = await (await this.getFileReader()).readTextFile(mdPath);
        if (changeLogText.length > 0) {
            const changeLogs = changeLogText.split('## <a id=').map((log: string) => log.trim()).map((log: string) => {
                const vStart = log.indexOf('"')+1;
                const vEnd = log.indexOf('"', vStart+1);
                const version = Version.parse(log.substring(vStart, vEnd).trim());
                const changes = '## <a id=' + log.trim();
                return { version: version, changes: changes };
            });

            return changeLogs.filter((log: { version: Version; changes: string }) =>
                Version.compareVersions(log.version, fromLibVer) > 0 &&
                Version.compareVersions(log.version, toLibVer) <= 0
            );
        }

        return [];
    }

    private getDefaultCSSStyleSheet(stylesheets: Array<StyleElement>): StyleElement|null {
        for (const stylesheet of stylesheets) {
            if (stylesheet.attributes['is'] === 'custom-style') {
                return stylesheet;
            }
        }
        if (stylesheets.length > 0) {
            return stylesheets[0];
        }

        return null;
    }

    private async parseGistContent (content: string): Promise<Gist> {
        if (typeof window['gc'] === 'undefined' || typeof window['gc']['htmlParserFactory'] === 'undefined') {
            // @ts-ignore
            await import('../../gc-core-webcomponent/lib/internal/IDomApi.js');

            // @ts-ignore
            await import('../../gc-core-webcomponent/lib/internal/htmlParser.js');
        }

        const htmlParserFactory = window['gc']['htmlParserFactory'];
        const htmlParser = htmlParserFactory.create(content, 2);
        const stylesheets = [];
        let stylesheet = htmlParser.getFirstStylesheet();
        while (stylesheet) {
            stylesheets.push(stylesheet);
            stylesheet = htmlParser.getNextStylesheet(stylesheet);
        }

        return { stylesheets: stylesheets, root: htmlParser.getRoot(), htmlParser: htmlParser };
    }

    /**
     * Returns whether should migrate between fromLibVer and toLibVer.
     *
     * @param fromLibVer
     * @param toLibVer
     * @param myLibVer
     */
    static shouldMigrate(fromLibVer: Version, toLibVer: Version, myLibVer: Version) {
        // compare fromLibVer < myLibVer <= toLibVer
        return Version.compareVersions(fromLibVer, myLibVer) < 0 && Version.compareVersions(myLibVer, toLibVer) <= 0;
    };

    private async doMigrateElements(elements: Array<ElementBlock>, fromLibVer: Version, toLibVer: Version) {
        for (const element of [...elements]) {
            this.logger.debug(LOGGER_NAME, `migrating ${element.name}`);

            /* process element */
            // @ts-ignore
            if (!this.migratedElements.includes(element) && !element.isAnOrphan()) {
                for (const key in this.elementMigrators) {
                    // @ts-ignore
                    const elementMigrator = this.elementMigrators[key];
                    if (!elementMigrator.getSupportedElements) continue;

                    const supportedElements = elementMigrator.getSupportedElements();
                    if (supportedElements && supportedElements[element.name]) {
                        const migratorCallback = supportedElements[element.name];
                        if (!migratorCallback) {
                            this.logger.debug(LOGGER_NAME, `Migrator callback for ${element.name} does not exist! Project might not be fully migrated.`);

                        } else {
                            await migratorCallback(element, fromLibVer, toLibVer);
                        }
                        break;
                    }
                }
            }

            /* process children */
            await this.doMigrateElements(element.children, fromLibVer, toLibVer);
        }
    }

    private doMigrateAppStylesheet(stylesheets: Array<StyleElement>, fromLibVer: Version, toLibVer: Version) {
        if (MigrationManager.shouldMigrate(fromLibVer, toLibVer, toLibVer)) {
            /* remove legacy 'html .viewport' css rule */ {
                for (const stylesheet of stylesheets) {
                    for (let i = stylesheet.rules.length-1; i >= 0; i--) {
                        const rule = stylesheet.rules[i];
                        if (rule.name.indexOf('.viewport') !== -1) {
                            stylesheet.removeRule(rule);
                        }
                    }
                }
            }

            /* add new css rules */ {
                try {
                    const stylesheet = this.getDefaultCSSStyleSheet(stylesheets);
                    if (stylesheet) {
                        stylesheet.insertRule(`#viewport {
                            width: 100%;
                            overflow: auto;
                            margin: 0;
                            padding: 0;
                        }`, 0);
                        stylesheet.insertRule(`#editorRoot {
                            position: absolute;
                            top: 0;
                            right: 0;
                            bottom: 0;
                            left: 0;
                            overflow: hidden;
                            opacity: 1;
                            margin: 0;
                        }`, 0);
                        stylesheet.insertRule('body {\nmargin: 0;\n}\n', 0);
                        stylesheet.removeAttribute('is');
                    }

                } catch (e) {
                    this.logger.error(LOGGER_NAME, e.message);
                }
            }
        }
    }

    //********************************************************************************************************************
    //* Public methods
    //********************************************************************************************************************

    async migrateHTML(html: string, fromLibVer: Version, toLibVer: Version, widgetBindings?: any): Promise<{ migratedElements: Array<ElementBlock>; bindings: any }> {
        this.gist = await this.parseGistContent(html);

        if (widgetBindings) {
            this.gist.htmlParser.setAllBindings(widgetBindings);
        }

        this.migratedElements.splice(0);
        this.importsToPurge.splice(0);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        this.elementMigrators = await this.getElementMigrators(this.gist.htmlParser, {
            purgeImport(...imports: Array<string>): void {
                self.importsToPurge.push(...imports);
            },

            addConsumed(...elements) {
                self.migratedElements.push(...elements);
            },

            doMigrateElement(element, myFromLibVer) {
                return self.doMigrateElements([element], myFromLibVer, toLibVer);
            }
        });

        /* migrate app level stylesheet */
        this.logger.debug(LOGGER_NAME, 'migrating app level stylesheet...');
        this.doMigrateAppStylesheet(this.gist.stylesheets, fromLibVer, toLibVer);

        /* migrate application level elements */
        this.logger.debug(LOGGER_NAME, 'migrating app level element tags...');
        const editorRoot = this.gist.htmlParser.getRoot();
        if (MigrationManager.shouldMigrate(fromLibVer, toLibVer, toLibVer)) {
            editorRoot.rename('div');
            editorRoot.removeAttribute('is');
            editorRoot.setId('editorRoot');
        }

        /* migrate GC elements */
        this.logger.debug(LOGGER_NAME, 'migrating GC element tags...');
        await this.doMigrateElements(this.gist.root.children, fromLibVer, toLibVer);

        /* purge legacy imports */
        if (this.importsToPurge.length > 0) {
            const imports: { [index: string]: boolean } = {};
            for (let i = 0; i < this.importsToPurge.length; ++i) {
                imports[`${this.importsToPurge[i]}`] = false;
            }
            this.gist.htmlParser.updateImportLinks(imports, true);
        }

        /* add new imports */
        // @ts-ignore
        this.insertScriptTags({ 'components/@ti/build/gc-components.esm.js': true });

        return {
            migratedElements: this.migratedElements,
            bindings: this.gist.htmlParser.getAllBindings()
        };
    }

    getHtml(): string {
        if (this.gist) {
            return this.gist.htmlParser.getText();
        } else {
            throw Error('gist not defined');
        }
    }

    insertScriptTags(scripts: { [index: string]: string }) {
        if (this.gist) {
            const currentVer = this.gist.htmlParser.parser.metaVersion;
            this.gist.htmlParser.parser.metaVersion = MAJOR_VER;
            this.gist.htmlParser.updateImportLinks(scripts, false);
            this.gist.htmlParser.parser.metaVersion = currentVer;
        } else {
            throw Error('gist not defined');
        }
    }

    async getChangeLogs(fromLibVer: Version, toLibVer: Version) {
        let changeLogs = '';
        for (const key in this.elementMigrators) {
            try {
                const logs = await this.getMigratorChangeLogs(this.elementMigrators[key], fromLibVer, toLibVer);
                if (Array.isArray(logs)) {
                    changeLogs += logs.reduce((acc, next) => acc + next.changes, '') + '\n\n';
                }
            } catch (e) {
                this.logger.warning(LOGGER_NAME, `Failed to get change log for ${key}`);
            }
        }
        return changeLogs;
    }
}

/* Designer support */
window['gc'] = window['gc'] || {};
window['gc']['MigrationManager'] = window['gc']['MigrationManager'] || MigrationManager;
window['gc']['MigrationManager'].Version = Version;
window['gc']['MigrationManager'].V3_0_0 = V3_0_0;
window['gc']['MigrationManager'].V1_5_0 = V1_5_0;