/**
 *  Copyright (c) 2021 Texas Instruments Incorporated
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
import { h, Component, Prop, Event, EventEmitter, Element, Method, State } from '@stencil/core';
import { WidgetDialog } from '../gc-widget-dialog/gc-widget-dialog';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { GcFiles } from '../gc-core-assets/lib/GcFiles';
import { ActionRegistry } from '../gc-widget-menu/lib/ActionRegistry';
import { GcWidget } from '../gc-widget-base/lib/GcWidget';

type SoftwareInfo = {
    name: string;
    version?: string;
    link: string;
    linkText?: string;
};

ActionRegistry.registerAction('cmd_open_about_dialog', {
    run() {
        GcWidget.querySelector('gc-widget-about-dialog').then(about => (about as unknown as WidgetAboutDialog).open());
    },
    isEnabled() {
        return !GcUtils.isInDesigner;
    }
});

/**
 * `gc-widget-about-dialog` provides information about the current application.
 *
 * There are two ways to extend the dialog to include additional software manifest file
 * license file, and detail information:
 *
 *   * Enter the information in the General page of the Project properties dialog.
 *   * Set the information with Javascript, see usage for example.
 *
 * @label About Dialog
 * @group Dialogs
 * @demo
 * @usage
 * @archetype <gc-widget-about-dialog id="about_dialog"></gc-widget-about-dialog>
 */
@Component({
    tag: 'gc-widget-about-dialog',
    styleUrl: 'gc-widget-about-dialog.scss',
    shadow: true
})
export class WidgetAboutDialog implements WidgetBaseProps {
    private dialog: WidgetDialog;
    private tiBranding: boolean = true;
    private defaultSoftwareInfo: SoftwareInfo[];

    /**
     * Link to the application software manifest file. i.e docs/manifest.txt
     * @order 2
     */
    @Prop() appManifestLink: string;

    /**
     * Link to the application license file. i.e docs/license.txt
     * @order 3
     */
    @Prop() appLicenseLink: string;

    /**
     * The application info text.
     * @order 4
     */
    @Prop() appInfoText: string;

    /**
     * The application info text title.
     * @order 5
     */
    @Prop() appInfoTextHeading: string;

    @State() name: string;
    @State() version: string;
    @State() copyright: string;
    @State() publishedDate: string;
    @State() installedSoftware: SoftwareInfo[] = [];
    @State() _appInfoText: string;
    @State() _appInfoTextHeading: string;

    render() {
        return (
            // JSXON
            <gc-widget-dialog
                modal
                ref={ (el: HTMLElement) => this.dialog = el as unknown as WidgetDialog }
                heading={ `About ${this.name}` }
            >
                { /* content */ }
                <div id='content' class='user-select'>
                    <h2>Application info</h2>
                    <div id='application-grid' class='grid'>
                        <div class='label'>Name:</div>
                        <div>{ `${this.name}` }</div>

                        <div class='label'>Version:</div>
                        <div>{ `${this.version || ''}` }</div>

                        <div class='label'>Published Date:</div>
                        <div>{ `${this.publishedDate || ''}` }</div>
                    </div>


                    <gc-widget-container id='content-detail' class='user-select'>
                        <h2>Installed software</h2>
                        <div id='software-grid' class='grid'>
                            <div class='label highlight'>Name</div>
                            <div class='label highlight'>Version</div>
                            <div class='label highlight'>Additional Info</div>

                            {
                                this.installedSoftware.map((software, index) => {
                                    const clazz = index % 2 === 1 ? 'highlight' : undefined;
                                    return [
                                        <div class={ clazz }>{ software.name }</div>,
                                        <div class={ clazz }>{ software.version || '' }</div>,
                                        <div class={ clazz }><a href={ software.link } target='_blank'>{ software.linkText || software.link }</a></div>
                                    ];
                                })
                            }
                        </div>

                        {
                            this._appInfoText ? [
                                <h2>{ this._appInfoTextHeading }</h2>,
                                <div id='additional-info-detail'>
                                    { this._appInfoText }
                                </div>
                            ] : undefined
                        }

                        <div id='copyright'>{ this.copyrightText }</div>
                    </gc-widget-container>
                </div>

                { /* action bar */ }
                <gc-widget-button slot='action-bar' class="dialog-dismiss" label='CLOSE' onClick={ () => this.close() } />
            </gc-widget-dialog>
            // JSXOFF
        );
    }

    @Method()
    async open() {
        if (!this.defaultSoftwareInfo) {
            this.defaultSoftwareInfo = [];
            let runtimeVersion = undefined;

            /* desktop software info */
            if (GcUtils.isNW) {
                this.defaultSoftwareInfo.push({
                    name: 'NodeWebkit',
                    version: process.versions['node-webkit'],
                    link: 'https://nwjs.io/'
                });

                this.defaultSoftwareInfo.push({
                    name: 'NodeJS',
                    version: process.versions['node'],
                    link: 'https://nodejs.org/'
                });

                this.defaultSoftwareInfo.push({
                    name: 'Chromium',
                    version: process.versions['chromium'],
                    link: 'https://chromestatus.com/features'
                });

                runtimeVersion = await GcFiles.readTextFile('version.xml').then(xml => {
                    const start = xml.indexOf('<version>');
                    const end = xml.indexOf('</version>');
                    return ((start > 0) && (end > start)) ? xml.substring(start+9, end) : undefined;
                });
            }

            /* desktop/cloud info */
            const segments = window.location.href.split('/');
            if (segments[segments.length-1] === 'index.html') {
                segments.pop();
            }
            const atTIIndex = segments.indexOf('@ti');
            if (atTIIndex > 0) {
                segments.splice(atTIIndex+1);
            } else {
                segments.push('components/@ti');
            }
            const atTIFolderPath = segments.join('/');
            // const atTIFolderPath = 'components/@ti';
            this.defaultSoftwareInfo = [...this.defaultSoftwareInfo,
                {
                    name: 'GUI Composer License',
                    linkText: 'TSPA_Modified.pdf',
                    link: `${atTIFolderPath}/assets/TSPA_Modified.pdf`,
                    version: runtimeVersion
                },
                {
                    name: 'GUI Composer Manifest',
                    linkText: 'GUI_Composer_manifest.html',
                    link: `${atTIFolderPath}/assets/GUI_Composer_manifest.html`,
                    version: runtimeVersion
                },
                {
                    name: 'StencilJS',
                    /* eslint-disable @typescript-eslint/no-explicit-any */
                    version: (await GcFiles.readJsonFile(`${atTIFolderPath}/collection-manifest.json`) as any).compiler.version || '0.0.0',
                    link: 'https://stenciljs.com/'
                }
            ];
        }

        /* dynamically info, read each time the dialog is opened to pickup any change */
        const projectJson = (await GcFiles.readJsonFile('project.json')) as any;
        this.name = projectJson.applicationName || 'Untitled';
        this.version = projectJson.applicationVersion;
        this.publishedDate = projectJson.publishedDate;
        this.tiBranding = projectJson.tiBrandingEnabled;

        const installedSoftware = [...this.defaultSoftwareInfo];
        installedSoftware.splice(2, 0, {
            name: 'GUI Composer Library',
            version: projectJson.version || '3.0.0',
            link: 'https://dev.ti.com/gc/'
        });

        const appLicenseLink = this.appLicenseLink || (projectJson.customLicense ?? undefined);
        if (appLicenseLink) {
            installedSoftware.push({
                name: 'Application License',
                link: appLicenseLink,
                linkText: this.getTextFromLink(appLicenseLink)
            });
        }

        const appManifestLink = this.appManifestLink || (projectJson.customManifest ?? undefined);
        if (appManifestLink) {
            installedSoftware.push({
                name: 'Application Manifest',
                link: appManifestLink,
                linkText: this.getTextFromLink(appManifestLink)
            });
        }

        this.installedSoftware = installedSoftware;
        this._appInfoText = this.appInfoText || (projectJson.customAppInfo ? await GcFiles.readTextFile(projectJson.customAppInfo) : undefined);
        this._appInfoTextHeading = this.appInfoTextHeading || 'Details';

        await this.dialog?.open();
    }

    @Method()
    async close() {
        this.dialog?.close();
    }

    private getTextFromLink(link: string) {
        return link?.replace(/\\/g, '/').split(/\//).pop();
    }

    private get copyrightText(): string {
        if (this.tiBranding) {
            return `Copyright © ${new Date().getFullYear()} Texas Instruments Incorporated. All rights reserved.`;
        } else {
            return this.copyright;
        }
    }

    // #region gc-widget-base/gc-widget-base-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The widget element.
     */
    @Element() el: HTMLElement;

    /**
     * Sets to `true` to hide the element, otherwise `false`.
     *
     * @order 200
     */
    @Prop({ reflect: true }) hidden: boolean = false;

    /**
     * Fired when a CSS property has changed.
     **/
    @Event({ eventName: 'css-property-changed' }) cssPropertyChanged: EventEmitter<{ name: string; value: string }>;

    /**
     * Sets the CSS property.
     *
     * @param {string} name the element style name
     * @param {string} value the new CSS property to be set
     */
    @Method()
    async setCSSProperty(name: string, value: string): Promise<void> {
        value = value.replace(/^[ ]+|[ ]+$/g, '');
        if (await this.getCSSProperty(name) !== value) {
            this.el.style.setProperty(name, value);
            this.cssPropertyChanged.emit({ name: name, value: value });
        }
    }

    /**
     * Returns the value of a CSS property.
     *
     * @param {string} name the element style property
     * @returns {string} the value of the property
     */
    @Method()
    async getCSSProperty(name: string): Promise<string> {
        return getComputedStyle(this.el).getPropertyValue(name).trim();
    }

    /**
     * Refresh the widget.
     */
    @Method()
    async refresh(): Promise<void> {
        return this.el['forceUpdate']();
    }
    // #endregion

}
