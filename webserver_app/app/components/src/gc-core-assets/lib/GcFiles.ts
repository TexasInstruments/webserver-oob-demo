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
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * `GcFiles` provides file access for the browser and the NodeJS environments, supporting
 * JSON, TEXT, and BINARY file formats.
 *
 * @example
 * ```typescript
 * import { GcFiles } from '<path-to>/gc-core-assets/lib/GcFiles';
 * const jsonObj = await GcFiles.readJsonFile('path-to-file/myfile.json');
 * ```
 *
 * @packageDocumentation
 */
import { GcUtils } from './GcUtils';
import { GcConsole } from './GcConsole';

const console = new GcConsole('GcFiles');
const cache: { [index: string]: Promise<any> } = {};
const nullParser = <T>(data: T) => {
    return data;
};

function toAbsolutePathNodeJS(fileURL: string) {
    const path = require('path');
    return path.resolve(process.cwd(), fileURL);
};

const saveFile = (fileURL: string, data: string | object, formatter: (data: string | object) => any) => {
    // TODO: do we need to support writing a binary file?
    // TODO: do we need to handle nw differently?

    fileURL = fileURL.trim();
    /* NodeJS save */
    if (GcUtils.isNodeJS) {
        const fs = require('fs-extra');
        fileURL = toAbsolutePathNodeJS(fileURL);
        cache[fileURL] = fs.writeFile(fileURL, formatter(data));

    /* browser save */
    } else {
        cache[fileURL] = new Promise((resolve, reject) => {
            const req = new XMLHttpRequest();

            req.onerror = (event: any) => {
                const message = `file failed to write file contents due to: ${event.error}`;
                console.error(message);
                reject(message);
            };

            req.onload = () => {
                resolve(data);
            };

            req.open('PUT', fileURL, true);
            req.send(formatter(data));
        });
    }

    return cache[fileURL];
};


const unloadFile = (fileURL: string) => {
    delete cache[fileURL];
};

const loadFile = (fileURL: string, parser: any, responseType: XMLHttpRequestResponseType, force: boolean) => {
    // TODO: do we need to handle nw differently?
    if (force) unloadFile(fileURL);

    fileURL = fileURL.trim();
    let promise = cache[fileURL];
    if (!promise) {
        /* NodeJS read */
        if (GcUtils.isNodeJS) {
            const fs = require('fs-extra');
            fileURL = toAbsolutePathNodeJS(fileURL);
            promise = fs.readFile(fileURL, responseType !== 'blob' ? 'utf-8' : undefined);

            /* browser read */
        } else {
            promise = new Promise((resolve, reject) => {
                const xmlHttp = new XMLHttpRequest();
                xmlHttp.onloadend = () => {
                    if (xmlHttp.readyState === 4 && (xmlHttp.status === 200 || xmlHttp.status === 0)) {
                        try {
                            resolve(responseType ? xmlHttp.response : xmlHttp.responseText);
                        } catch (e) {
                            reject(e);
                        }
                    } else {
                        reject(`Can't read file: ${fileURL}.  Status Code = ${xmlHttp.status}`);
                    }
                };

                xmlHttp.open('GET', fileURL, true);
                if (responseType) {
                    xmlHttp.responseType = responseType;
                }
                xmlHttp.send();
            });
        }

        cache[fileURL] = promise = promise.then((data: any) => {
            try {
                return parser(data);
            } catch (e) {
                console.error(`file parse error: ${e.toString()}`);
                throw e;
            }

        }).catch((e: Error) => {
            console.error(e.toString());
            unloadFile(fileURL);
            throw e;
        });
    }
    return promise;
};



/**
 * Provides file access API for the application.
 */
export class GcFiles {
    /**
     * Read a JSON file and return the JSON object.
     *
     * @param {string} fileURL the URL to read the file
     * @param {boolean} force force a read, otherwise return the cached value
     * @return {Promise<object>} a promise
     */
    static readJsonFile(fileURL: string, force = true): Promise<object> {
        return loadFile(fileURL, JSON.parse, 'text', force);
    }

    /**
     * Read a text file.
     *
     * @param {string} fileURL the URL to read the file
     * @param {boolean} force force a read, otherwise return the cached value
     * @returns {Promise<string>} a promise
     */
    static readTextFile(fileURL: string, force = true): Promise<string> {
        return loadFile(fileURL, nullParser, 'text', force);
    }

    /**
     * Read a binary file.
     *
     * @param {string} fileURL the URL to read the binary
     * @param {boolean} force force a read, otherwise return the cached value
     * @returns {Promise<Buffer | Blob>} a promise
     */
    static readBinaryFile(fileURL: string, force = true): Promise<Buffer | Blob> {
        return loadFile(fileURL, nullParser, 'blob', force);
    }

    /**
     * Write a JSON object to a file.
     *
     * @param {string} fileURL the URL to write the file
     * @param {object} jsonData the JSON object
     * @returns {Promise<string>} a promise
     */
    static writeJsonFile(fileURL: string, jsonData: object): Promise<string> {
        return saveFile(fileURL, jsonData, data => JSON.stringify(data, null, 4));
    }

    /**
     * Write the text to a file.
     *
     * @param {string} fileURL the URL to write the file
     * @param {string} textData the text to write
     * @returns {Promise<string>} a promise
     */
    static writeTextFile(fileURL: string, textData: string): Promise<string> {
        return saveFile(fileURL, textData, nullParser);
    }
}
