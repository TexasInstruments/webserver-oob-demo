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
import { GcUtils } from '../lib/GcUtils';

export const LAUNCHPADS = ['MSP432P401R', 'CC1310F128', 'MSP430F5529'];

export function isMSP430(deviceName: string) {
    return deviceName.indexOf('MSP430') >= 0;
}

class ProcessArgs {
    private static filteredArgsMap = new Map<string, string>();

    private static getStringArg(name: string): string {
        const envName = GcUtils.camelToDashCase(name).split('-').join('_');
        return ProcessArgs.filteredArgsMap.get(name) || process.env['GC_' + envName.toUpperCase()] || '';
    }

    private static getBooleanArg(name: string): boolean {
        const val = this.getStringArg(name);
        return (val && val.toLowerCase() === 'true') || false;
    }

    private static getNumberArg(name: string, defaultValue = NaN): number {
        const val = this.getStringArg(name);
        return val ? +val : defaultValue;
    }

    constructor() {
        Array.prototype.slice.call(process.argv)
            .filter((e: string) => (e.startsWith('-') || e.startsWith('--')) && !e.startsWith('---'))
            .map((e: string) => e.split('='))
            .forEach(([key, val]) => {
                if (key.startsWith('--')) {
                    ProcessArgs.filteredArgsMap.set(key.substr(2), val);
                } else {
                    const keys = key.substr(1).split('');
                    keys.forEach( (k: string) => ProcessArgs.filteredArgsMap.set(k, 'true'));
                }
            });
    }

    get enableLog() {
        return ProcessArgs.getNumberArg('enableLog', -1);
    }

    get deviceNames(): string[] {
        return ProcessArgs.getStringArg('deviceName').split(',').map( device => device.trim());
    }

    get browser() {
        return ProcessArgs.getStringArg('browser');
    }

    get baseurl() {
        return ProcessArgs.getStringArg('baseurl');
    }

    get chromedrv() {
        return ProcessArgs.getStringArg('chromedrv');
    }
}

export const processArgs = new ProcessArgs();
