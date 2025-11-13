/**
 *  Copyright (c) 2020, 2021 Texas Instruments Incorporated
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
 *
 */
import { Component, h, Prop, State, Watch, Event, EventEmitter, Element, Method, getAssetPath } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

/**
 * `gc-widget-icon` is a svg icon widget with bindable properties, it uses the Material Design Icons provided by Google.
 * To browse the icons, see <a href="https://material.io/icons/" target="_blank">https://material.io/icons/</a>.
 *
 * @label Icon
 * @group Common
 * @css --gc-color | Icon color when `appearance` property is set to `custom` | { "kind": "color"}
 * @demo
 * @usage
 * @archetype <gc-widget-icon icon="alert:error_outline"></gc-widget-icon>
 */
@Component({
    tag: 'gc-widget-icon',
    styleUrl: 'gc-widget-icon.scss',
    shadow: true
})
export class WidgetIcon implements WidgetBaseProps, WidgetBaseTooltipProps, WidgetBaseTitleProps {
    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBase {
            get element(): HTMLElement {
                return (this.parent as WidgetIcon).el;
            }
        })(this);

    /**
    * An icon is formed by
    * ```
    * {icon_theme:icon_category:}icon_name
    * ```
     * *`icon_theme:icon_category`** are optional, and defaults to `filled` if no theme defined, and `action` if no category defined. `icon_name` is mandatory.
     *
     * > **`icon_theme`**: The supported icon themes are: `filled`, `outlined`, `round`, `sharp`, and `two-tone`.
     *
     * > **`icon_category`**: Supported icon catagories are: `action`, `alert`, `av`, `communication`, `content`, `device`, `editor`, `file`, `hardware`, `home`, `image`, `maps`, `navigation`, `notification`, `places`, `social`, and `toggle`.
     *
     * > **`icon_name`**:  Browse on [Material Icons](https://fonts.google.com/icons?selected=Material+Icons) for icons.
     * @order 2
     */
    @Prop() icon: string = 'alert:error_outline';

    /**
     * Icon appearance, can be one of the following: `primary`, `secondary`, `tertiary`, `success`, `warn`, `error`, `reversed`, or `custom`.
     * Also, `reversed` can be added as in `primary reversed`. This inverts the foreground and background colors.
     * And `custom` can be added as to provide custom color style by setting the `--gc-color` CSS property.
     * @order 3
     */
    @Prop({ reflect: true }) appearance?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warn' | 'error' | 'reversed' | 'custom' = 'tertiary';
    /**
     * Icon size - one of `xxs` (11x11), `xs` (14x14), `s` (18x18), `m` (24x24), `l` (36x36), or `xl` (48x48).
     * @order 4
     */
    @Prop() size?: 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm';

    /**
     * Place the icon in a circle wrapper.
     * @order 5
     */
    @Prop() circle?: boolean = false;

    /**
     * Path to the icon folder, can be used to override the default icon-theme and icon-file.
     * @order 6
     */
    @Prop() path?: string = undefined;

    @State() iconName = 'error_outline';
    @State() iconSet = 'alert';
    @State() iconFolderPath = '';
    @State() iconTheme = 'filled';

    render() {
        // JSXON
        return this.base.render(
            <ti-svg-icon
                iconSet={ this.iconSet }
                multiIconFile={true}
                size={ this.size }
                appearance={ this.appearance || '' }
                circle={ this.circle }
                iconName={ this.iconName }
                pathPrefix={ this.iconFolderPath }>
            </ti-svg-icon>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    componentWillLoad() {
        this.onPathChanged();
        this.onIconChanged();
    }

    @Watch('icon')
    onIconChanged() {
        const segments = this.icon ? this.icon.split(':') : [];
        if (segments.length >= 3) {
            this.iconTheme = segments[0];
            this.iconSet = segments[1];
            this.iconName = segments[2];

        } else if (segments.length === 2) {
            this.iconSet = segments[0];
            this.iconName = segments[1];

        } else if (segments.length === 1) {
            this.iconName = segments[0];
        }

        this.onPathChanged();
    }

    @Watch('path')
    onPathChanged() {
        this.iconFolderPath = !this.path ? getAssetPath(`../assets/icons/${this.iconTheme}/`) : this.path;
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
    // #region gc-widget-base/gc-widget-base-tooltip-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the tooltip that is displayed for this widget.
     * @order 210
     */
    @Prop() tooltip: string;
    // #endregion
    // #region gc-widget-base/gc-widget-base-title-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The widget caption text.
     * @order 207
     */
    @Prop({ reflect: true }) caption: string;

    /**
     * The widget info icon help text.
     * @order 208
     */
    @Prop({ reflect: true }) infoText: string;
    // #endregion

}
