/**
 *  Copyright (c) 2020, Texas Instruments Incorporated
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
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS'
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
import { GcConsole } from './GcConsole';

const MODULE_NAME = 'Events';
const console = new GcConsole(MODULE_NAME);

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IEvent {};

export interface IListener<T extends IEvent> {
    (details: T): void;
}

class ListenerList<T extends IEvent> {
    private listeners = new Array<IListener<T>>();

    add(listener: IListener<T>) {
        if (!this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
    };

    remove(listener: IListener<T> | undefined) {
        if (listener) {
            this.listeners = this.listeners.filter((l) => listener !== l);
        }
    }

    fire(type: EventType<T>, details: T) {
        this.listeners.forEach((listener: IListener<T>) => {
            try {
                listener(details);
            } catch (e) {
                GcConsole.error(MODULE_NAME, e);
            }
        });
    }

    get isEmpty() {
        return this.listeners.length === 0;
    };

    forEach(callback: (listener: IListener<T>) => void) {
        this.listeners.forEach((listener: IListener<T>) => {
            try {
                callback(listener);
            } catch (e) {
                console.error(e);
            }
        });
    }
}

export class EventType<T extends IEvent> {
    readonly id: symbol;
    constructor(public readonly eventName: string) {
        this.id = Symbol(eventName);
    }
    asEventType(listener: IListener<IEvent>): IListener<T> {
        return listener as IListener<T>;
    }
}

export interface IEvents {
    /**
     * Adds an event listener.
     *
     * @param type the event type
     * @param listener the event listener

     * @category event
     */
    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>): void;

    /**
     * Removes an event listener.
     *
     * @param type the event type
     * @param listener the event listener
     *
     * @category event
     */
    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T> | undefined): void;
};

export class Events implements IEvents {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private eventMap = new Map<symbol, any>();
    private firstAddedEventMap = new Map<symbol, ListenerList<IEvent>>();
    private lastRemovedEventMap = new Map<symbol, ListenerList<IEvent>>();

    protected hasAnyListeners<T extends IEvent>(type: EventType<T>) {
        const listeners = this.eventMap.get(type.id) as ListenerList<T>;
        return listeners ? !listeners.isEmpty : false;
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        const first = this.doAddEventListener(this.eventMap, type, listener);
        if (first) {
            this.doFireEvent(this.firstAddedEventMap, type as EventType<IEvent>, {});
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T> | undefined) {
        const last = this.doRemoveEventListener(this.eventMap, type, listener);
        if (last) {
            this.doFireEvent(this.lastRemovedEventMap, type as EventType<IEvent>, {});
        }
    }

    protected fireEvent<T extends IEvent>(type: EventType<T>, details: T) {
        this.doFireEvent(this.eventMap, type, details);
    }

    // Helper functions
    protected addEventListenerOnFirstAdded<T extends IEvent>(type: EventType<T>, listener: IListener<IEvent>) {
        this.doAddEventListener(this.firstAddedEventMap, type as EventType<IEvent>, listener);
        // Automatically fire first listener added event if there are already listeners when added.
        const listeners = this.eventMap.get(type.id) as ListenerList<T>;
        if (listeners && !listeners.isEmpty) {
            listener({});
        }
    };

    protected removeEventListenerOnFirstAdded<T extends IEvent>(type: EventType<T>, listener: IListener<IEvent> | undefined) {
        this.doRemoveEventListener(this.firstAddedEventMap, type as EventType<IEvent>, listener);
    }

    protected addEventListenerOnLastRemoved<T extends IEvent>(type: EventType<T>, listener: IListener<IEvent>) {
        this.doAddEventListener(this.lastRemovedEventMap, type as EventType<IEvent>, listener);
    }

    protected removeEventListenerOnLastRemoved<T extends IEvent>(type: EventType<T>, listener: IListener<IEvent> | undefined) {
        this.doRemoveEventListener(this.lastRemovedEventMap, type as EventType<IEvent>, listener);
    }

    private doAddEventListener<T extends IEvent>(map: Map<symbol, ListenerList<T>>, type: EventType<T>, listener: IListener<T>): boolean {
        let listeners = map.get(type.id) as ListenerList<T>;
        if (!listeners) {
            listeners = new ListenerList<T>();
            map.set(type.id, listeners);
        }
        const first = listeners.isEmpty;
        listeners.add(listener);
        return first;
    }

    private doRemoveEventListener<T extends IEvent>(map: Map<symbol, ListenerList<T>>, type: EventType<T>, listener: IListener<T> | undefined): boolean {
        const listeners = map.get(type.id) as ListenerList<T>;
        let last = false;
        if (listeners && !listeners.isEmpty) {
            listeners.remove(listener);
            last = listeners.isEmpty;
        }
        return last;
    };

    private doFireEvent<T extends IEvent>(map: Map<symbol, ListenerList<T>>, type: EventType<T>, details: T) {
        const listeners = map.get(type.id);
        if (listeners) {
            listeners.fire(type, details);
        }
    }

    protected forEachEventListener<T>(type: EventType<T>, callback: (listener: IListener<T>) => void) {
        const listeners = this.eventMap.get(type.id) as ListenerList<T>;
        if (listeners) {
            listeners.forEach(callback);
        }
    }
}

