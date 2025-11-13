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
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * `NodeJsEnv` provides polyfill for the TICloudAgent running in the NodeJS environment,
 * this file should be import before any other modules.
 *
 * @packageDocumentation
 */

import os from 'os';
import ws from 'ws';
import { TextEncoder, TextDecoder } from 'util';

const { Blob, FileReader } = require('blob-polyfill/Blob');

declare global {
    namespace NodeJS {
        interface Global extends Window {
            window: Window | Global;
            parent: Global;
            navigator: Navigator;
            WebSocket: new(address: string, options?: ws.ClientOptions) => WebSocket;
            TextEncoder: new() => TextEncoder;
            TextDecoder: new() => TextDecoder;
            Blob: new() => Blob;
            FileReader: new() => FileReader;
            btoa: (str: Buffer|string) => void;
            TICloudAgent: any;
        }
    }
};

const btoa = (str: Buffer|string) => {
    return ((str instanceof Buffer) ? str : Buffer.from(str.toString(), 'binary')).toString('base64');
};

export class Navigator {
    userAgent = 'Node';

    get appVersion() {
        let _os = 'Linux';
        switch (os.platform()) {
            case 'win32':
                _os = 'Windows';
                break;
            case 'darwin':
                _os = 'Mac';
                break;
        }
        return `${process.version} (Node; ${_os})`;
    }
};

export class Event {
    type: string = '';
    canBubble?: boolean;
    cancelable?: boolean;
    detail?: any;

    initCustomEvent(type: string, canBubble: boolean, cancelable: boolean, detail: any): void {
        this.type = type;
        this.canBubble = canBubble;
        this.cancelable = cancelable;
        this.detail = detail;
    }
}

export class Document {
    createEvent(eventInterface: string): Event {
        return new Event();
    }
};

export class Location {
    protocol = 'http';
    hostname = 'localhost';
    port = undefined;
};

export class Window {
    private eventListeners: Map<string, ((event: Event) => void)[]> = new Map<string, Array<(event: Event) => void>>();
    document = new Document();
    location = new Location();

    constructor(global: any) {
        Object.assign(this, global);
    };

    addEventListener(type: string, callback: (event: Event) => void, ...params: any[]): void {
        let listeners = this.eventListeners.get(type);

        /* creates a new list of listeners for the given even type if one doesn't exist */
        if (!listeners) {
            listeners = new Array<(event: Event) => void>();
        }

        /* add the callback listener to the list of callback if one doesn't exist */
        if (!listeners.includes(callback)) {
            listeners.push(callback);
            this.eventListeners.set(type, listeners);
        }

    };
    removeEventListener(type: string, callback: (event: Event) => void, ...params: any[]): void {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    };
    dispatchEvent(event: Event): void {
        const listeners = this.eventListeners.get(event.type);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (error) { /* suppress exception */ }
            });
        }
    };

};

export declare let window: Window;

export class WebSocket {
    [key: string]: any;
    private socket: ws;

    constructor(address: string, options?: ws.ClientOptions) {
        this.socket = new ws(address, options);
        this.socket.on('open', this.handleEvent.bind(this, 'onopen'));
        this.socket.on('close', this.handleEvent.bind(this, 'onclose'));
        this.socket.on('error', this.handleEvent.bind(this, 'onerror'));
        this.socket.on('message', this.handleEvent.bind(this, 'onmessage'));
    }

    close(): void {
        this.socket.close();
    }

    send(data: any): void {
        this.socket.send(data);
    }

    private handleEvent(name: string, data: any) {
        try {
            if (this[name]) {
                this[name]({ data: data });
            }
        } catch (e) {/* suppress error */ }
    }
}

// Polyfill Promise.finally for nodejs environment running older node.js
if (Promise.prototype.finally === undefined) {
    Promise.prototype.finally = function (x?: (() => void | null | undefined)): Promise<any> {
        return this.then(function (result) {
            if (x) x();
            return result;
        }).catch(function (e) {
            if (x) x();
            throw e;
        });
    };
}

/* setup the global/window object */
(() => {
    if (!global.window) {
        global.parent = global;
        global.window = new Window(global);
        global.navigator = new Navigator();
        global.WebSocket = WebSocket;
        global.TextEncoder = TextEncoder;
        global.TextDecoder = TextDecoder;
        global.Blob = Blob;
        global.FileReader = FileReader;
        global.btoa = btoa;
    }
})();