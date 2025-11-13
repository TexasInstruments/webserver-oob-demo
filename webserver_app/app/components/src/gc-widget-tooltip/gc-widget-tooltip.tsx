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
 */

import { Component, h, Prop, Watch, Element, Method, Event, EventEmitter } from '@stencil/core';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetBaseKeepVisibleProps } from '../gc-widget-base/gc-widget-base-keep-visible-props';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';

interface DivRect {
    width: string; // in px
    height: string; // in px
}

export type Position = 'right' | 'left' | 'bottom' | 'top';

/**
 * `gc-widget-tooltip` is a tooltip with bindable properties. It is positioned in relation to its anchored element.
 *
 *
 * When given a div id to anchor, the tooltip is positioned based on initial position given.
 * If not possible within the viewport, the next best position is calculated based
 * on the viewport space in this order: right, left, top, and bottom.
 *
 * @label Tooltip
 * @group Common
 * @demo
 * @usage
 * @container
 * @archetype <gc-widget-tooltip text="Text inside tooltip"></gc-widget-tooltip>
 */
@Component({
    tag: 'gc-widget-tooltip',
    styleUrl: 'gc-widget-tooltip.scss',
    shadow: true
})
export class WidgetTooltip implements WidgetBaseProps, WidgetBaseKeepVisibleProps {
    private static sharedTooltip: HTMLElement;
    private anchorDiv: HTMLElement;
    private timeoutId = undefined;
    private delayTimeoutId = undefined;
    private tracking = false;
    private isVisible = false;

    constructor() {
        if (!WidgetTooltip.sharedTooltip) {
            WidgetTooltip.sharedTooltip = document.createElement('gc-widget-tooltip-shared');
            WidgetTooltip.sharedTooltip.style.display = 'none';
            document.body.append(WidgetTooltip.sharedTooltip);
        }
    }

    /**
     * The text message to display inside the tooltip.
     * @order 2
     */
    @Prop() text: string;

    /**
     * The ID of the element that the tooltip is anchored to.
     * @order 3
     */
    @Prop({ reflect: true, mutable: true }) anchorId: string;

    /**
     * Position of the tooltip relative to its anchor element.
     * @order 4
     */
    @Prop({ reflect: true }) position: Position = 'right';

    /**
     * Sets the anchor element div by finding the element
     * with the given ID in the parent's root or the document.
     *
     * div id with 'elementWrapper' and 'help-icon' is part of gc widget base.
     */
    @Watch('anchorId')
    private anchorIdChanged() {
        // unregister existing anchor mouse events
        if (this.anchorDiv) {
            this.unregisterMouseEvents();
        }

        if (this.anchorId) {
            window.setTimeout(() => {
                this.anchorDiv = this.findAnchor(this.anchorId.trim());
                if (this.anchorDiv) {
                    // register anchor mouse events
                    this.registerMouseEvents();
                    this.keepVisibleInDesignerChanged();
                }
            });
        }
    }

    @Watch('keepVisibleInDesigner')
    keepVisibleInDesignerChanged() {
        if (GcUtils.isInDesigner && !this.hidden && this.anchorDiv) {
            if (this.keepVisibleInDesigner) {
                this.showDiv();
                this.unregisterMouseEvents();
            } else {
                this.hideDiv();
                this.registerMouseEvents();
            }
        }
    }

    @Watch('position')
    positionChanged() {
        // case: in Designer and tooltip is permanently showing.
        if (GcUtils.isInDesigner && !this.hidden && this.keepVisibleInDesigner && this.anchorDiv) {
            this.showDiv();
        }
    }

    connectedCallback() {
        /*
         * On drag + drop from the GC palette, the parent element changes if dropped into another container etc. Triggers on
         * DOM move to remove/add event listeners to the right parent element. Initialized into a container, find id of
         * immediate container.
         */
        if (GcUtils.isInDesigner) {
            // case: in Designer and initialized into a container, find id of immediate container.
            this.anchorId = this.el.parentElement?.id;
        }
    }

    disconnectedCallback() {
        this.unregisterMouseEvents();
    }

    componentDidLoad() {
        if (!this.anchorId && GcUtils.isInDesigner) {
            // case: in Designer and initialized into a container, find id of immediate container.
            this.anchorId = this.el.parentElement?.id;
        }
        this.anchorIdChanged();
    }

    private findAnchor(anchorId: string): HTMLElement {
        return (anchorId && anchorId !== 'elementWrapper')
            ? this.el.parentElement.querySelector(`#${anchorId}`) || document.querySelector(`#${anchorId}`) || (this.el.parentElement.getRootNode() as HTMLElement).querySelector(`#${anchorId}`)
            : this.el.parentElement;
    }

    /**
     * Positions the tooltip on the viewport based on initial position given.
     * If not, calculate next best position based on the anchor element's
     * position in the window.
     *
     * @param anchor DOMRect of the anchorDiv.
     */
    private doShowDiv(anchor: DOMRect) {
        WidgetTooltip.sharedTooltip.style.display = 'flex';

        // get the tooltip dimensions
        const styles = window.getComputedStyle(WidgetTooltip.sharedTooltip);
        const tooltipRect = {
            width: parseInt(styles.width, 10) + parseInt(styles.paddingLeft, 10) + parseInt(styles.paddingRight, 10) + 'px',
            height: parseInt(styles.height, 10) + parseInt(styles.paddingTop, 10) + parseInt(styles.paddingBottom, 10) + 'px'
        };

        // update tooltip class with the best position for animation effect.
        WidgetTooltip.sharedTooltip.classList.forEach((name) => {
            if (name.indexOf('gc-tooltip-') > -1) {
                WidgetTooltip.sharedTooltip.classList.remove(name);
            }
        });
        const bestPosition = this.findBestPosition(anchor, tooltipRect);
        WidgetTooltip.sharedTooltip.classList.add(`gc-tooltip-${bestPosition}`);

        // update shared tooltip position.
        switch (bestPosition) {
            case 'right':
                WidgetTooltip.sharedTooltip.style.top = `${anchor.top - 10}px`;
                WidgetTooltip.sharedTooltip.style.left = `${anchor.right + 5}px`;
                break;
            case 'left':
                WidgetTooltip.sharedTooltip.style.top = `${anchor.top - 10}px`;
                WidgetTooltip.sharedTooltip.style.left = `${anchor.left - 5 - parseInt(tooltipRect.width, 10)}px`;
                break;
            case 'top':
                WidgetTooltip.sharedTooltip.style.top = `${anchor.top - 5 - parseInt(tooltipRect.height, 10)}px`;
                WidgetTooltip.sharedTooltip.style.left = `${anchor.left}px`;
                break;
            case 'bottom':
                WidgetTooltip.sharedTooltip.style.top = `${anchor.bottom + 5}px`;
                WidgetTooltip.sharedTooltip.style.left = `${anchor.left}px`;
                break;
        }
    }

    /**
     * Returns the best possible position
     * @param anchor DOMRect of the anchorDiv.
     * @param tooltipRect rect of the tooltip
     */
    private findBestPosition(anchor: DOMRect, tooltipRect: DivRect): Position {
        if (this.positionFits(this.position, anchor, tooltipRect)) {
            return this.position;
        } else {
            // find opposite first then the other two - priority: right > left, top> bottom
            let check: string[];
            switch (this.position) {
                case 'right':
                    check = ['left', 'top', 'bottom'];
                    break;
                case 'left':
                    check = ['right', 'top', 'bottom'];
                    break;
                case 'top':
                    check = ['bottom', 'right', 'left'];
                    break;
                case 'bottom':
                    check = ['top', 'right', 'left'];
                    break;
                default:
                    check = ['left', 'top', 'bottom']; // default to right in case invalid position string is added to tag
                    break;
            }
            const found = check.find(p => this.positionFits(p as Position, anchor, tooltipRect)) as Position;
            // undefined if no space; return right tooltip as last resort
            return  Object.is(found, undefined) ? 'right' : found;
        }
    }

    /**
     * Returns true if the given position for the tooltip will fit.
     * @param position 'right' | 'left' | 'top' | 'bottom'
     * @param rect DOMRect of the anchorDiv.
     * @param tooltipRect rect of the tooltip
     */
    private positionFits(position: Position, rect: DOMRect, tooltipRect: DivRect): boolean{
        switch (position) {
            case 'right':
                return ((rect.right + 5 + parseInt(tooltipRect.width, 10)) < window.innerWidth);
            case 'left':
                return ((rect.left - 5 - parseInt(tooltipRect.width, 10)) > 0);
            case 'top':
                return ((rect.top - 5 - parseInt(tooltipRect.height, 10)) > 0);
            case 'bottom':
                return ((rect.bottom + 5 + parseInt(tooltipRect.height, 10)) < window.innerHeight);
        }
    }

    private registerMouseEvents() {
        this.anchorDiv.addEventListener('mouseenter', this.mouseEnterHdlr);
        this.anchorDiv.addEventListener('mousemove', this.mouseMoveHdlr);
        this.anchorDiv.addEventListener('mouseleave', this.mouseLeaveHdlr);
        this.anchorDiv.addEventListener('mousedown', this.mouseDownHdlr);
    }

    private unregisterMouseEvents() {
        this.anchorDiv.removeEventListener('mouseenter', this.mouseEnterHdlr);
        this.anchorDiv.removeEventListener('mousemove', this.mouseMoveHdlr);
        this.anchorDiv.removeEventListener('mouseleave', this.mouseLeaveHdlr);
        this.anchorDiv.removeEventListener('mousedown', this.mouseDownHdlr);
    }

    private mouseEnterHdlr = () => this.tracking = true;
    private mouseMoveHdlr = () => this.showDiv();
    private mouseLeaveHdlr = () => {
        this.tracking = false;
        this.hideDiv();
    };
    private mouseDownHdlr = () => {
        this.tracking = false;
        this.hideDiv();
    };


    @Watch('text')
    textChanged() {
        if (this.isVisible) {
            (WidgetTooltip.sharedTooltip as unknown as WidgetTooltip).text = this.text;

            if (this.text.trim().length !== 0) {
                this.delayTimeoutId = setTimeout(() => {
                    this.doShowDiv(this.anchorDiv.getBoundingClientRect());
                }, 50); // allow the shared tooltip to render the text
            } else {
                this.hideDiv();
            }
        }
    }

    private showDiv() {
        this.isVisible = true;

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        if (this.tracking) {
            this.timeoutId = setTimeout(() => this.textChanged(), 500);
        }
    }

    private hideDiv() {
        this.isVisible = false;

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }

        if (this.delayTimeoutId) {
            clearTimeout(this.delayTimeoutId);
            this.delayTimeoutId = undefined;
        }

        WidgetTooltip.sharedTooltip.style.display = 'none';
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
    // #region gc-widget-base/gc-widget-base-keep-visible-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget visibility in the designer.
     * @order 900
     */
    @Prop({ reflect: true }) keepVisibleInDesigner: boolean;
    // #endregion

}
