/**
 *  Copyright (c) 2019, 2020 Texas Instruments Incorporated
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
import { IScripting } from './IScripting';
import { scriptValueType, IScriptingTarget } from '../../gc-core-databind/lib/CoreDatabind';

/* eslint-disable @typescript-eslint/indent */
/* eslint-disable spaced-comment */

const RuntimeScriptURL = window.URL.createObjectURL(new Blob([
`/****************************************************
* Synchronization Logic
***************************************************/
var box = this;
var Runtime = (function() {
    var buffer   = null;
    var lock     = null;
    var _timeout = 10000;
    var _command = null;

    box.onmessage = function(event) {
        var detail = event.data;
        switch (detail.cmd) {
            case 'init':
                lock   = new Int32Array(detail.lock);
                buffer = new Uint8Array(detail.buffer);
                break;

            case 'main':
                try {
                    main();
                } catch (err) {
                    box.postMessage({event: 'Console', detail: {message: err.toString(), type: 'error'}});
                }
                box.postMessage({event: 'MainCompleted'});
                break;

            case 'eval':
                try {
                    var result = eval(detail.expression);
                    box.postMessage({event: 'EvalCompleted', detail: {result: result}});
                } catch (err) {
                    box.postMessage({event: 'EvalFailed', detail: {error: err.toString()}});
                    box.postMessage({event: 'Console', detail: {message: err.toString(), type: 'error'}});
                }

                break;
        }
    };

    function reset() {
        Atomics.store(lock, 0, 0);
        buffer.fill(0);
    };

    function getResult() {
        if (Atomics.wait(lock, 0, 0, _timeout) != 'ok') {
            console.error('Script timeout while waiting for result!');
        }

        if (Atomics.load(lock, 0) != 0) {
            throw new Error('Error executing ' + JSON.stringify(_command));
        }

        return buffer;
    };

    function Runtime(timeout) {
        if (timeout) {
            _timeout = timeout;
        }
    }

    Runtime.prototype.execute = function(command) {
        _command = command;

        reset();
        box.postMessage(command);
        return getResult();
    };

    return Runtime;
})();`
], { type: 'text/javascript' }));

const APIScriptURL = window.URL.createObjectURL(new Blob([
`/****************************************************
* Common Scripting API
***************************************************/
var Runtime = new Runtime();

function byteArrayToLong(/*byte[]*/byteArray) {
    var value = 0;
    for (var i = byteArray.length - 1; i >= 0; i--) {
        value = (value * 256) + byteArray[i];
    }

    return value;
}

function read(name) {
    var result = byteArrayToLong(Runtime.execute({
        cmd: 'read',
        name: name
    }));

    box.postMessage({event: 'Console', detail: {message: 'read(' + name + ') => ' + result}});
    return result;
}

function write(name, value) {
    var result = byteArrayToLong(Runtime.execute({
        cmd: 'write',
        name: name,
        value: value
    }));
    box.postMessage({event: 'Console', detail: {message: 'write(' + name + ', ' +  value + ') => ' + result}});
    return result;
}

function invoke(name, args, inf) {
    /* move inf from first argument to the last argument, backward compatible support */
    var hasInf = false;
    if (arguments.length === 3 && Array.isArray(arguments[2])) {
        // inf, name, args
        var _inf = name;
        name = args;
        args = inf;
        inf = _inf;
        hasInf = true;
    }

    var result = Runtime.execute({
        cmd: 'invoke',
        inf: inf,
        name: name,
        args: args
    });

    var _result = result;
    if (!hasInf) {
        result =  byteArrayToLong(result.slice(0, 8));
        _result = '0x' + result.toString(16);

    }
    box.postMessage({event: 'Console', detail: {message: 'invoke(' + name + ', [' + args + '], ' + inf + ') => ' + _result}});
    return result;
};

function log(text, clear) {
    box.postMessage({event: 'Log', detail: {text: text, clear: clear}});
}

function exit() {
    box.postMessage({event: 'Exit'});
}
`
], { type: 'text/javascript' }));

interface EvalQueueEntry {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferred: { resolve: (result: any) => void; reject: (reason: any) => void };
    expression: string;
}

interface IScriptingCommand {
    readonly cmd: string;
};

interface IReadCommand extends IScriptingCommand {
    readonly name: string;
};

interface IWriteCommand extends IReadCommand {
    readonly value: scriptValueType;
};

interface IInvokeCommand extends IReadCommand {
    readonly args: string[];
    readonly inf: string;
};

interface IScriptingEvent {
    event: string;
};

interface ILogEvent extends IScriptingEvent {
    detail: {
        clear: boolean;
        text: string;
    };
};

interface IConsoleEvent extends IScriptingEvent {
    detail: {
        message: string;
        type: string;
    };
};

interface IEvalCompletedEvent extends IScriptingEvent {
    detail: {
        error?: string;
        result?: scriptValueType;
    };
};

/**************************************************************************************************
 *
 * Scripting Class
 *
 * Example - handles button click to call the sayHello function
 *
 *  document.querySelector("#my_btn").addEventListener("click", function() {
 *       var script = registerModel.getModel().newScriptInstance();
 *       gc.fileCache.readTextFile('app/scripts/myscript.js').then(function(text) {
 *           script.load(text);
 *           return script.eval("sayHello('patrick')");
 *       }).then(function(result) {
 *           console.log(result);
 *       }).fail(function(error) {
 *           console.error(error);
 *       }).finally(function() {
 *           script.stop();
 *       });
 *   });
 *
 **************************************************************************************************/
export class Scripting implements IScripting {
    private lock: SharedArrayBuffer;
    private lockArray: Int32Array;
    private userscriptURL: string | null;
    private worker?: Worker;
    private buffer: SharedArrayBuffer;
    private bufferArray: Uint8Array;
    private evalQueue: EvalQueueEntry[] = [];

    constructor(private readonly messageHdlr: IScriptingTarget, bufferLength: number, private readonly logfile?: string) {
        /* detect SharedArrayBuffer support */
        if (typeof SharedArrayBuffer === 'undefined') {
            throw new Error('SharedArrayBuffer');
        }

        this.lock = new SharedArrayBuffer(4);
        this.lockArray = new Int32Array(this.lock);
        this.userscriptURL = null;
        this.buffer = new SharedArrayBuffer(bufferLength);
        this.bufferArray = new Uint8Array(this.buffer);
    };

    static longToByteArray = function (long: number) {
        const byteArray = [0, 0, 0, 0, 0, 0, 0, 0];

        for (let index = 0; index < byteArray.length; index++) {
            const byte = long & 0xff;
            byteArray[index] = byte;
            long = (long - byte) / 256;
        }

        return byteArray;
    };

    static byteArrayToLong = function (byteArray: number[]) {
        let value = 0;
        for (let i = byteArray.length - 1; i >= 0; i--) {
            value = (value * 256) + byteArray[i];
        }

        return value;
    };

    load(script: string): IScripting {
        /* clean up existing user script object and terminate existing worker */
        if (this.userscriptURL) window.URL.revokeObjectURL(this.userscriptURL);
        if (this.worker) this.worker.terminate();

        /* create user script object url */
        this.userscriptURL = window.URL.createObjectURL(new Blob([
            'importScripts("' + RuntimeScriptURL + '")\n' +
            'importScripts("' + APIScriptURL + '")\n\n' +
            script
        ]));

        /* create a worker */
        this.worker = new Worker(this.userscriptURL);

        /* add worker message listener */
        this.worker.onmessage = (event: { data: IScriptingEvent | IScriptingCommand }) => {
            if ((event.data as IScriptingCommand).cmd) {
                this.commandHandler(event.data as IScriptingCommand).then((data) => {
                    /* array data type */
                    if (Array.isArray(data)) {
                        this.bufferArray.set(data); // only 8 bytes are used on the receiver side

                        /* boolean data type */
                    } else if (typeof data === 'boolean') {
                        this.bufferArray.set(Scripting.longToByteArray(data ? 1 : 0));

                        /* number data type */
                    } else if (typeof data === 'number') {
                        this.bufferArray.set(Scripting.longToByteArray(data));
                    }

                    Atomics.store(this.lockArray, 0, 0);

                }).catch(() => {
                    Atomics.store(this.lockArray, 0, -1);

                }).finally(() => {
                    Atomics.notify(this.lockArray, 0, +Infinity);
                });
            } else if ((event.data as IScriptingEvent).event) {
                this.eventHandler(event.data as IScriptingEvent);
            }
        };

        /* initialize the worker */
        this.worker.postMessage({
            cmd: 'init',
            buffer: this.buffer,
            lock: this.lock
        });

        return this;
    };

    main() {
        if (!this.worker) return;

        this.worker.postMessage({
            cmd: 'main'
        });
    };

    stop() {
        if (!this.worker) return;

        this.evalQueue = [];
        this.worker.terminate();
        this.saveLog();
    }

    eval(expression: string) {
        if (!this.worker) {
            this.load(''); // create an empty script
        }

        return new Promise<void>((resolve, reject) => {
            this.evalQueue.push({ deferred: { resolve: resolve, reject: reject }, expression: expression });

            if (this.worker && this.evalQueue.length === 1) {
                this.worker.postMessage({
                    cmd: 'eval',
                    expression: expression
                });
            }
        });
    };

    private commandHandler(event: IScriptingCommand) {
        switch (event.cmd) {
            case 'read': {
                const readEvent = event as IReadCommand;
                return this.messageHdlr.scriptRead(readEvent.name);
            }
            case 'write': {
                const writeEvent = event as IWriteCommand;
                return this.messageHdlr.scriptWrite(writeEvent.name, writeEvent.value);
            }
            case 'invoke': {
                const invokeEvent = event as IInvokeCommand;
                return this.messageHdlr.invokeMethod(invokeEvent.name, invokeEvent.args, invokeEvent.inf);
            }
            default:
                return Promise.reject('Unsupported command: ' + event.cmd);
        }
    };

    private eventHandler(event: IScriptingEvent) {
        switch (event.event) {
            case 'Exit':
                this.saveLog().then(function () {
                    window.close();
                });
                break;
            case 'Log':
                this.onLog(event as ILogEvent);
                break;
            case 'MainCompleted':
                this.saveLog();
                break;
            case 'EvalCompleted':
            case 'EvalFailed':
                this.onEvalCompleted(event as IEvalCompletedEvent);
                break;
        }
    };

    private logs: string[] = [];
    onLog(event: ILogEvent) {
        if (event.detail.clear) {
            this.logs = [];
        }
        if (event.detail.text) {
            this.logs.push(event.detail.text);
        }
    };

    saveLog() {
        return new Promise<void>((resolve) => {
            if (this.logs && this.logs.length > 0) {
                if (typeof process === 'undefined') {
                    // TODO: supprt file save
                    // gc.File.saveBrowserFile(this.logs.join('\n'), { filename: this.logfile || 'scripting.log' });
                    this.logs = [];
                    resolve();

                } else {
                    // TODO: support file save
                    // gc.File.save(this.logs.join('\n'), { localPath: this.logfile || 'scripting.log' }, null, () => {
                    this.logs = [];
                    resolve();
                }
            } else {
                resolve();  // nothing to save.
            }
        });
    };

    onEvalCompleted(event: IEvalCompletedEvent) {
        const curEval = this.evalQueue.shift();
        if (curEval) {
            const deferred = curEval.deferred;
            event.event === 'EvalCompleted' ? deferred.resolve(event.detail.result) : deferred.reject(event.detail.error);
            if (this.worker && this.evalQueue.length >= 1) {
                this.worker.postMessage({
                    cmd: 'eval',
                    expression: this.evalQueue[0].expression
                });
            }
        }
    };
};