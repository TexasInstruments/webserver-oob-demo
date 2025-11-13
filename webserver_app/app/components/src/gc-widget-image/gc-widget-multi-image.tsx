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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Component, h, Prop, Event, EventEmitter, Watch, Element, Method } from '@stencil/core';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { IOption, WidgetBaseSelector } from '../gc-widget-base/gc-widget-base-selector';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetBaseImageProps } from '../gc-widget-base/gc-widget-base-image-props';
import { WidgetBaseSelectorProps } from '../gc-widget-base/gc-widget-base-selector-props';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

// TODO: hide selectedLabel and selectedLabelChanged event, see https://jira.itg.ti.com/browse/GC-2740

/**
 * `gc-widget-multi-image` is an image selection widget with a list of possible image options to display.
 * Only one image option, the current selected image option is displayed. In addition, this is not an input
 * widget as there is no way for the end user to control the currently selected image
 *
 * @label Multi Image
 * @group Common
 * @demo demo/gc-widget-multi-image.html
 * @usage gc-widget-multi-image-usage.md
 */
@Component({
    tag: 'gc-widget-multi-image',
    styleUrl: 'gc-widget-multi-image.scss',
    shadow: true
})
export class WidgetMultiImage implements WidgetBaseSelectorProps, WidgetBaseImageProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps {
    private valuesArray: string[] = [];
    private labelsArray: string[] = [];
    private lastSelectedIndex = -1;

    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBaseSelector {
            get widget() {
                return this.parent as WidgetMultiImage;
            }
            get element() {
                return this.widget.el;
            }
            protected setOptions(options: IOption[]): void {
                /* do nothing */
            }
            protected getSelectedIndex() {
                return this.widget.lastSelectedIndex;
            }
            protected setSelectedIndex(index: number) {
                this.widget.lastSelectedIndex = index;

                if (index >= 0 && index < this.widget.valuesArray.length) {
                    this.widget.selectedIndex = index;
                }
            }
            protected selectionChanged(index: number) {
                if (index >= 0 && index < this.widget.valuesArray.length) {
                    this.widget.selectedIndex = index;
                }
            }
            protected getValues() {
                return this.widget.valuesArray;
            }
            protected getLabels() {
                return this.widget.labelsArray;
            }
        })(this);

    /**
     * The path to the containing folder of the images, relative to the root of the project. If not defined, the image
     * file paths will be relative to the root of the project.
     * @order 3
     */
    @Prop() folderPath: string;

    /**
     * A list of image file paths, relative to the root of the project. The list of paths are separated by ',', '|', or ';'.
     * @order 4
     */
    @Prop() filePaths: string;

    /**
     * A list of values for the image options. This list should be the same length as the the list of
     * the images; otherwise the values extra options will have undefined values. The list of values are
     * separated by ',', '|', or ';'.
     *
     * @order 5
     */
    @Prop() values: string;

    render() {
        // JSXON
        return this.base.render(
            <gc-widget-image file-path={ this.imageFilePath } lockAspectRatio={ this.lockAspectRatio } disabled={ this.disabled } />,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    private get imageFilePath() {
        const filePaths = GcUtils.parseArrayProperty(this.filePaths);

        if (filePaths && filePaths.length > 0 && filePaths.length > this.selectedIndex && this.selectedIndex >= 0) {
            return this.folderPath ? `${this.folderPath.trim()}/${filePaths[this.selectedIndex]}` : filePaths[this.selectedIndex];
        }
    }

    componentWillLoad() {
        this.initializeComponent();
    }

    private initializeComponent() {
        this.base.reset();

        this.lastSelectedIndex = this.selectedIndex;
        this.valuesArray = GcUtils.parseArrayProperty(this.values) || [];
        this.labelsArray =  GcUtils.parseArrayProperty(this.filePaths) || [];

        if (this.valuesArray.length < this.labelsArray.length) {
            for (let i = this.valuesArray.length; i < this.labelsArray.length; i++ ) {
                this.valuesArray.push((i+1).toString());
            }
        }

        this.base.initializeComponent();
    }

    @Watch('filePaths')
    onFilePathsChanged() {
        this.initializeComponent();
    }

    @Watch('values')
    onValuesChanged() {
        this.initializeComponent();
    }

    @Watch('selectedIndex')
    onSelectedIndexChanged(newValue: number, oldValue: number) {
        this.base.selectedIndexChanged();
        this.selectedIndexChanged.emit({ value: newValue });
    }

    @Watch('selectedValue')
    onSelectedValueChanged(newValue: any, oldValue: any) {
        this.base.selectedValueChanged();
        this.selectedValueChanged.emit({ value: newValue });
    }

    // #region gc-widget-base/gc-widget-base-selector-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The zero-based index of the selected option.
     * @order 20
     */
    @Prop({ mutable: true }) selectedIndex: number;

    /**
     * Fired when the `selectedIndex` property has changed.
     */
    @Event({ eventName: 'selected-index-changed' }) selectedIndexChanged: EventEmitter<{ value: number }>;

    /**
     * The label of the selected option.
     * @order 21
     */
    @Prop({ mutable: true }) selectedLabel: string;

    /**
     * Fired when the `selectedLabel` property has changed.
     */
    @Event({ eventName: 'selected-label-changed' }) selectedLabelChanged: EventEmitter<{ value: string }>;

    /**
     * The value represented by the selected option.
     * @order 22
     */
    @Prop({ mutable: true }) selectedValue: number | string;

    /**
     * Fired when the `selectedValue` property has changed.
     */
    @Event({ eventName: 'selected-value-changed' }) selectedValueChanged: EventEmitter<{ value: number | string }>;

    /**
     * The index of the option to be initially selected by default.
     * @order 23
     */
    @Prop() initialIndex: number;
    // #endregion
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
    // #region gc-widget-base/gc-widget-base-image-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the image aspect ratio should be fixed when resizing.
     * @order 8
     */
    @Prop({ reflect: true }) lockAspectRatio: boolean;

    /**
     * Controls animated effects when mouse hover of the image.
     * <ul>
     *    <li>shadow - create a box shadow around the image</li>
     *    <li>border - add a border around the image</li>
     *    <li>enlarge - cause the image to expand</li>
     * </ul>
     * @order 9
     */
    @Prop({ reflect: true }) hoverEffect: ''|'shadow'|'border'|'enlarge';

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
    // #region gc-widget-base/gc-widget-base-disabled-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget disabled state.
     * @order 202
     */
    @Prop({ reflect: true }) disabled: boolean = false;
    // #endregion

}
