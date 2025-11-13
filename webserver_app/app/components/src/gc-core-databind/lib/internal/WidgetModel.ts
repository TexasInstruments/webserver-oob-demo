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

import { IBindValue, bindValueType, IValueChangedEvent, valueChangedEventType } from './IBindValue';
import { AbstractBindValue, blockNewEditUndoOperationCreation } from './AbstractBindValue';
import { AbstractBindFactory } from './AbstractBindFactory';
import { IStatusEvent, NAME } from './IBind';
import { EventType, IEvent } from '../../../gc-core-assets/lib/Events';
import { GcUtils } from '../../../gc-core-assets/lib/GcUtils';
import { GcConsole } from '../../../gc-core-assets/lib/GcConsole';
import { ILookupBindValue, indexValueType } from './ILookupBindValue';
import { StatusIndicatorFactory } from './StatusIndicator';

declare namespace Polymer {
    function dom(param: DocumentFragment | Element): DocumentFragment | Element;
}

declare global {
    interface Window {
        Polymer: unknown;
    }
}

export interface IWidget {
    [ index: string ]: bindValueType;
    addEventListener(name: string, listener: () => void): void;
    removeEventListener(name: string, listener: () => void): void;
    setCSSProperty?(name: string, value: string): Promise<void>;
}

interface IEditOperation {
    undo(): void;
    redo(): void;
    toString(): string;
}

interface IUserEditEvent extends IEvent {
    operation: IEditOperation;
}

export const userEditEvent = new EventType<IUserEditEvent>('user edit');

class EditOperation implements IEditOperation {
    constructor(private bind: IBindValue, private oldValue: bindValueType, private newValue: bindValueType, private time: number) {
    }

    undo() {
        this.bind.setValue(this.oldValue);
    }

    redo() {
        this.bind.setValue(this.newValue);
    }

    toString() {
        return 'edit';
    }

    canMergeOperation(bind: WidgetBindValue, newValue: bindValueType, now: number) {
        // make sure it's also different from original value; e.g.,
        // checkbox toggled quickly.
        return bind === this.bind && now - this.time < 250 && this.oldValue !== newValue;
    }

    mergeOperation(newValue: bindValueType, time: number) {
        this.newValue = newValue;
        this.time = time;
        this.redo(); // perform action now.
    }
}

class WidgetBindValue extends AbstractBindValue implements IBindValue {
    private changedPropertyEventName: string;
    private _widget?: IWidget;
    private widgetId: string;

    excludeFromStorageProviderData = true;

    constructor(widget: IWidget, private widgetProperty: string, initialValue: bindValueType, private parent?:  DocumentFragment | Element) {
        super();

        this.widgetId = widget.id;
        this._widget = widget;
        this.cachedValue = initialValue;
        this.changedPropertyEventName = GcUtils.camelToDashCase(widgetProperty) + '-changed';

        this.addEventListenerOnFirstAdded(valueChangedEventType, this.onFirstValueChangedListenerAdded);
        this.addEventListenerOnLastRemoved(valueChangedEventType, this.onLastValueChangedListenerRemoved);

        const streamingListener = widget[widgetProperty + 'StreamingDataListener'] as (data: bindValueType) => void;
        if (streamingListener && typeof streamingListener === 'function') {
            (this as IBindValue).onStreamingDataReceived = streamingListener.bind(widget);
        }
    }

    protected writePropertyValue(widget: IWidget, newValue: bindValueType) {
        widget[this.widgetProperty] = newValue;
    }

    protected onValueChanged(details: IValueChangedEvent) {
        this.excludeFromStorageProviderData = true;

        const widget = this.widget;
        if (widget) {
            // widget available, so update property
            this.writePropertyValue(widget, details.newValue);
        }
    }

    protected get widget() {
        this._widget = this._widget || (this.parent || document).querySelector(`[id="${this.widgetId}"`) || undefined;
        return this._widget;
    }

    protected onStatusChanged(details: IStatusEvent) {
        const statusIndicator = StatusIndicatorFactory.get(this.widget as HTMLElement);

        if (!statusIndicator) {
            return;
        }

        if (details.oldStatus) {
            statusIndicator.removeMessage(details.oldStatus.message);
        }
        if (details.newStatus) {
            statusIndicator.addMessage(details.newStatus.message, details.newStatus.type);
        }
    }

    protected readPropertyValue(widget: IWidget) {
        return widget[this.widgetProperty];
    }

    private doUserEditOperation = () => {
        const widget = this.widget;
        if (widget) {
            const oldValue = this.getValue();
            const newValue = this.readPropertyValue(widget!);
            if (oldValue !== newValue) {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                WidgetModel.doUserEditOperation(this, newValue, oldValue);
                this.excludeFromStorageProviderData = false;
            }
        }
    };

    private onFirstValueChangedListenerAdded = () => {
        const widget = this.widget;
        if (widget) {
            widget.addEventListener(this.changedPropertyEventName, this.doUserEditOperation);

            const oldStatus = this.status;
            if (oldStatus) {
                // restore status indicators for the new widget.
                widget.errorMessage = oldStatus.message;
            }
        }
    };

    private onLastValueChangedListenerRemoved = () => {
        const widget = this.widget;
        if (widget) {
            widget.removeEventListener(this.changedPropertyEventName, this.doUserEditOperation);

            const oldStatus = this.status;
            if (oldStatus) {
                // remove status indicators that are tied to this widget
                widget.errorMessage = undefined;
            }
            // next time we have to bind to the widget, lets use a fresh widget pointer
            // this way we support unbind from widgets, recreate widgets, then bind to new widgets.
            this._widget = undefined;
        }
    };
}

class WidgetStyleLookupBind extends WidgetBindValue implements ILookupBindValue {
    private cssPropertyName?: string;

    constructor(widget: IWidget, parent?:  DocumentFragment | Element) {
        super(widget, 'cssProperty', parent);
    }

    setIndex(...index: indexValueType[]): void {
        this.cssPropertyName = '' + (index[0] || '');
        const widget = this.widget;
        if (widget) {
            this.updateValue(this.readPropertyValue(widget));
        }
    }

    protected readPropertyValue(widget: IWidget) {
        if (this.cssPropertyName) {
            // using getComputedStyle(widget).getPropertyValue(name) because widget.getCSSProperty(name) returns a promise
            // and I need the value now.

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (getComputedStyle as any)(widget as unknown).getPropertyValue(this.cssPropertyName)?.trim() || '';
        }
        return undefined;
    }

    protected writePropertyValue(widget: IWidget, newValue: bindValueType) {
        if (this.cssPropertyName && typeof newValue === 'string') {
            if (widget.setCSSProperty) {
                widget.setCSSProperty?.(this.cssPropertyName, newValue);
            } else {
                widget.style.setProperty(name, newValue.trim());
            }
        }
    }
}

export class WidgetModel extends AbstractBindFactory {
    private static lastUndoOperation?: EditOperation;
    static instance = new WidgetModel();

    constructor(private rootElement?: DocumentFragment | Element) {
        super('widget');
    }

    private static findWidgetShallow(parent: DocumentFragment | Element, uri: string) {
        const query = `[id="${uri.split('.').join('"] [id="')}"]`;
        const result = ((window.Polymer && Polymer.dom) ? Polymer.dom(parent) : parent).querySelector(query);
        if (!result) {
            GcConsole.error(NAME, `Failed to find widget ${query}.`);
        }
        return result;
    }

    private static findWidget(deepUri: string, from: DocumentFragment | Element) {
        const shallowUri = deepUri.split('.$.');

        let result = this.findWidgetShallow(from, shallowUri[0]);
        for (let i = 1; result && i < shallowUri.length; i++) {
            if (result.shadowRoot) {
                result = this.findWidgetShallow(result.shadowRoot, shallowUri[i]);
            } else if (window.Polymer && Polymer.dom) {
                result = this.findWidgetShallow(result, shallowUri[i]);
            } else {
                GcConsole.error(NAME, `Cannot access shadow dom of widget ${shallowUri[i-1]} in ${deepUri}`);
                return null;
            }
        }
        return result;
    }

    createNewBind(name: string): AbstractBindValue | null {
        let bind = null;
        const pos = name.lastIndexOf('.');
        if (pos > 0) {
            const widgetName = name.substring(0, pos);
            const widgetProperty = name.substring(pos + 1);

            const widget = WidgetModel.findWidget(widgetName, this.rootElement || document as unknown as DocumentFragment) as IWidget;
            if (widget) {
                if (widgetProperty === 'style') {
                    bind = new WidgetStyleLookupBind(widget, this.rootElement);
                } else {
                    bind = new WidgetBindValue(widget, widgetProperty, widget[widgetProperty], this.rootElement);
                }
            }
        }
        return bind;
    }

    static clearLastUserEditOperation() {
        this.lastUndoOperation = undefined;
    }

    static doUserEditOperation(bind: WidgetBindValue, newValue: bindValueType, oldValue: bindValueType) {
        const lastOperation = this.lastUndoOperation;
        const now = Date.now();

        if (lastOperation && lastOperation.canMergeOperation(bind, newValue, now)) {
            lastOperation.mergeOperation(newValue, now);
        } else if (oldValue !== undefined && newValue !== undefined && !blockNewEditUndoOperationCreation) {
            const operation = new EditOperation(bind, oldValue, newValue, now);
            this.instance.fireEvent(userEditEvent, { operation: operation });
            operation.redo();
            this.lastUndoOperation = operation;
        } else {
            bind.setValue(newValue);
        }
    }

    static readonly documentContentLoaded = !GcUtils.isNodeJS && document.readyState === 'loading' ? new Promise<void>( resolve => {
        document.addEventListener('DOMContentLoaded', () => resolve() );
    }) : Promise.resolve();

    static async whenWidgetReady(widgetId: string) {
        if (GcUtils.isNodeJS) {
            return Promise.resolve();
        }

        await this.documentContentLoaded;

        // I could use GcWidgets.querySelector() here, but gc-model-xxx cannot depend on gc-widget-xxxx as a rule.
        const widget = this.findWidget(widgetId, document as unknown as DocumentFragment);
        if (widget) {
            await customElements.whenDefined(widget.tagName.toLowerCase());
        } else {
            throw Error(`Widget id="${widgetId} was not found in html document.`);
        }
        return widget;
    }
}
