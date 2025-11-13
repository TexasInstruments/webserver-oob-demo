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

import { Component, h, Prop, Watch, Element, Host, getAssetPath, Listen, EventEmitter, Method, Event } from '@stencil/core';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';

const console = new GcConsole('gc-widget-theme');

/* Theme files within the assets folder.*/
const DARK_THEME_FILE = 'gc-theme-dark.css';
const LIGHT_THEME_FILE = 'gc-theme-light.css';

let themeAlreadyLoaded = false;

/**
 *`gc-widget-theme` sets theme colors according to a linked theme css sheet.
 *
 * @label Theme
 * @group Common
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-theme',
    styleUrl: 'gc-widget-theme.scss',
    shadow: true
})
export class WidgetTheme implements WidgetBaseProps{
    private cssLinkTag: HTMLLinkElement;
    private themeArray: string[] = [];
    private active = false;
    /**
     * Index for the css theme file.
     * @order 1
     */
    @Prop({ reflect: true }) selectedThemeIndex: number = 0;

    /**
     * Collection of file paths to all the theme css files to associate with. The list of paths are
     * separated by ',' or '|'. Note: to show up in the designer, the list must have 5 or less themes listed.
     * @order 2
     */
    @Prop({ reflect: true }) themeFilePaths: string = '$gc-theme-light|$gc-theme-dark';

    /**
     * Switches to the theme index listed if valid (described in themeFilePaths).
     */
    @Watch('selectedThemeIndex')
    selectedThemeIndexChanged(){
        if (-1 < this.selectedThemeIndex && this.selectedThemeIndex < this.themeArray.length) {
            this.cssLinkTag.href = this.themeArray[this.selectedThemeIndex];
        }
    }

    /**
     * Updates the theme paths list. Any reference to $gc-theme-light or $gc-theme-dark with internal assets path to the GC theme.
     */
    @Watch('themeFilePaths')
    themeFilePathsChanged() {
        this.themeArray = this.themeFilePaths.split(/,|\|/g).map((themeFile) => {
            return themeFile.trim();
        });
        const lightIndex = this.themeArray.indexOf('$gc-theme-light');
        const darkIndex = this.themeArray.indexOf('$gc-theme-dark');
        // if light theme don't load anything (default theme)
        if (lightIndex !== -1) this.themeArray[lightIndex] = `${getAssetPath('../assets/stylesheets/')}${LIGHT_THEME_FILE}`;
        if (darkIndex !== -1) this.themeArray[darkIndex] = `${getAssetPath('../assets/stylesheets/')}${DARK_THEME_FILE}`;
        this.selectedThemeIndexChanged();
    }

    componentWillLoad() {
        console.log('themeAlreadyLoaded: ', themeAlreadyLoaded);
        if (!themeAlreadyLoaded){
            /* Create HTML link tag to a CSS file in <head> or <body>. By default load light theme. */
            this.cssLinkTag = document.createElement('link');
            this.cssLinkTag.rel = 'stylesheet';
            this.cssLinkTag.type = 'text/css';
            this.cssLinkTag.href = '';

            this.themeFilePathsChanged();
            this.selectedThemeIndexChanged();

            const element = document.head || document.body;
            element.appendChild(this.cssLinkTag);
            themeAlreadyLoaded = true;
        } else {
            console.error('Duplicate(s) of gc-widget-theme loaded. Only one is allowed.');
        }
    }

    disconnectedCallback() {
        if (!GcUtils.isInDesigner) this.cssLinkTag.disabled = true;
        const nextThemeWidget = document.getElementsByTagName('gc-widget-theme');
        if (!nextThemeWidget.length) {
            if (GcUtils.isInDesigner) this.cssLinkTag.disabled = true;
            themeAlreadyLoaded = false;
        }
    }

    render() {
        return (
            // JSXON
            <Host/>
            // JSXOFF
        );
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
