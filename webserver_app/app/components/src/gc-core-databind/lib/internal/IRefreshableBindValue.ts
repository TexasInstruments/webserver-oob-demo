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

import { IBindValue } from './IBindValue';
import { IProgressCounter } from './ProgressCounter';
import { IRefreshIntervalProvider } from './IRefreshIntervalProvider';
import { IDisposable } from './IDisposable';

export interface IRefreshableBindValue extends IBindValue, IDisposable {
    /**
     * Method meant to wrap the onRefresh method with script recording support.
     * Widget that support manual refresh should call this method.
     *
     * @param {gc.databind.IProgressCounter} [progress] - a progress counter
     *        used to monitor asynchronous operations.
     */
    refreshAndLog(progress?: IProgressCounter): Promise<void>;

    /**
     * Method meant to be an event handler for an onRefresh event. This method
     * kicks off a read operation if idle. If this object is busy with other
     * operations, then it is ignored because the refresh will happen as a
     * result of those operations. This method is designed to be used with
     * gc.databind.RefreshIntervalBindValue to provide a periodic polling event
     * to refresh the read value of this asynchronous binding. Simply attach
     * this object as a listener and refresh() will be called periodically.
     *
     * @param [progress] - a progress counter
     *        used to monitor asynchronous operations.
     */
    refresh(progress?: IProgressCounter): Promise<void>;

    /**
     * Set a new refresh interval provider to control the polling interval.  The refresh interval provider should
     * be obtained from the model associated with this binding using the prefix '$refresh_interval.' followed by
     * a name to identify each separate refresh interval provider.  See the example below.
     *
     * @example
     * let refreshInterval = gc.databind.registry.getBinding("<model>.$refresh_interval.<name>");
     * refreshInterval.setValue(2500);  // the value is in milliseconds, so in this case every 2.5 seconds.
     * let myBinding = gc.databind.registry.getBinding("<model>.<URI>");
     * myBinding.setRefreshIntervalProvider(refreshInterval);
     *
     * @param {gc.databind.RefreshIntervalBindValue} refreshIntervalProvider - new refresh binding to use for polling interval.
     *
     */
    setRefreshIntervalProvider(refreshIntervalProvider?: IRefreshIntervalProvider): void;
};