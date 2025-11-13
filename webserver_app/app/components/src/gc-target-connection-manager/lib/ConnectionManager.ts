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
import { GcPromise, IDeferedPromise } from '../../gc-core-assets/lib/GcPromise';
import { codecRegistry, IConnectionLog, AbstractTransport, IConnectionLogEvent, connectionLogEventType, ITransport, IConnectedStateChangedEvent, TRANSPORT_STATE, connectedStateChangedEventType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { EventType, IEvent } from '../../gc-core-assets/lib/Events';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';

let transports = new Array<ITransport>();
let programLoaders = new Array<ITargetProgramLoader>();

/**
 * Interface for a target program loader.
 */
export interface ITargetProgramLoader extends ICodecBaseParams {
    /**
     * Load a target program.  This method is used by the Connection Manager as part of the connect step to load the appropriate
     * binaries on the appropriate targets.  To ensure the program is loaded, you should pase force=true, otherwise this program
     * loader may opt not to load the program; for example, if autoProgram is not enabled, or the program has been loaded once already.
     *
     * @param logger a callback to log progress, error, warning, and debug messages
     * @param progressCallback a callback to updated progress, as a percentage, when loading the program.
     * @param force a flag to force the program to be loaded or reloaded as the case may be.
     */
    loadProgram(logger: IConnectionLog, progressCallback?: (progress: number) => void, force?: boolean): Promise<void>;
}

export interface IBusyStateChangedEvent extends IEvent {
    isBusy: boolean;
}

export const busyStateChangedEvent = new EventType<IBusyStateChangedEvent>('busy');

export const activeConfigurationChangedEvent = new EventType<IEvent>('activeConfiguration');

const NO_CONFIGURATION_ERROR = Error('Failed to connect: There is no active configuration to connect with.');

/**
 * A connection manager to control the connection of the active configuration consisting of transports, models and codecs.
 */
class ConnectionManager extends AbstractTransport {
    id = '';
    allowAutoConnectOnDeviceDetection = false;

    protected params = {};
    private busyCount = 0;
    private _isPartiallyConnected = false;  // TODO: not being used at the moment.
    private configurations = new Map<string, string>();
    private waitForConfigurations = new Map<string, IDeferedPromise<string>>();
    private activeConfigurationError? = NO_CONFIGURATION_ERROR;
    private nextActiveConfiguration = '';
    private _activeConfigurationId = 'default';
    protected console = new GcConsole('gc-target-connection-manager');

    private get isBusy(): boolean {
        return this.busyCount > 0;
    }

    private set isBusy(busy: boolean) {
        const oldCount = this.busyCount;
        if (busy) {
            this.busyCount++;
        } else {
            this.busyCount--;
        }
        if (this.busyCount === 0 || oldCount === 0) {
            this.fireEvent(busyStateChangedEvent, { isBusy: this.isBusy });
        }
    }

    /**
     * The identifier of the active configuration, if there is one.
     */
    public get activeConfigurationId() {
        return this._activeConfigurationId;
    }

    protected async doConnect() {
        this.isBusy = true;
        try {
            this.console.log('Starting to connect.');

            this.ensureConfiguration();
            if (this.activeConfigurationError) {
                throw this.activeConfigurationError;
            }

            const activeTransports = this.getActiveTransports();
            if (activeTransports.length === 0) {
                throw Error('Failed to connect: There are no active transports to connect with.');
            }
            const requiredDevices = new Map<string, Array<ITargetProgramLoader>>([['', new Array<ITargetProgramLoader>()]]);
            const optionalDevices = new Map<string, Array<ITargetProgramLoader>>([['', new Array<ITargetProgramLoader>()]]);
            programLoaders.forEach( (loader) => {
                const deviceId = loader.deviceId;
                if (deviceId) {
                    switch (codecRegistry.isDeviceRequired(activeTransports.map( (transport) => transport.id), deviceId, true)) {
                        case 'yes':
                            if (!loader.optional) {
                                if (!requiredDevices.has(deviceId)) {
                                    requiredDevices.set(deviceId, new Array<ITargetProgramLoader>());
                                }
                                requiredDevices.get(deviceId)!.push(loader);
                                break;
                            }
                        // eslint-disable-next-line no-fallthrough
                        case 'maybe':
                            if (!optionalDevices.has(deviceId)) {
                                optionalDevices.set(deviceId, new Array<ITargetProgramLoader>());
                            }
                            optionalDevices.get(deviceId)!.push(loader);
                            break;
                    }
                } else if (loader.optional) {
                    optionalDevices.get('')!.push(loader);
                } else {
                    requiredDevices.get('')!.push(loader);
                }
            });

            for ( const [deviceId, activeProgramLoaders] of requiredDevices) {
                for (let i = 0; i < activeProgramLoaders.length; i++) {

                    this.assertStillConnecting();

                    const loader = activeProgramLoaders[i];
                    await loader.loadProgram(this).catch( (e) => {
                        const transport = activeTransports.find( transport => codecRegistry.isDeviceRequired(transport.id, deviceId, true) === 'yes') ?? activeTransports[0];
                        transport.addErrorMessage(e.message || e.toString());
                        throw Error('One or more required programs failed to load without error.');
                    });
                }
            }

            const failedDevicesList: Array<string> = [];
            for ( const [deviceId, activeProgramLoaders] of optionalDevices) {
                for (let i = 0; i < activeProgramLoaders.length; i++) {

                    this.assertStillConnecting();

                    const loader = activeProgramLoaders[i];
                    try {
                        await loader.loadProgram(this);
                    } catch (e) {
                        // determine if program is optional for overall connection.
                        if (!loader.optional && deviceId) {
                            failedDevicesList.push(deviceId);
                        }
                        this.addWarningMessage(e.message || e.toString());
                    }
                }
            }

            this.assertStillConnecting();

            const requiredPromises: Promise<void>[] = [];
            const allPromises = activeTransports.reduce( (promises: Promise<void>[], transport) => {
                const connectPromise = transport.connect(failedDevicesList);
                if (!codecRegistry.isOptional(transport.id)) {
                    requiredPromises.push(connectPromise);
                }
                promises.push(connectPromise);
                return promises;
            }, []);

            // disconnect if any required connection fails.
            let requiredPromise: Promise<void[]> = Promise.resolve([]);
            if (requiredPromises.length > 0) {
                requiredPromise = Promise.all(requiredPromises).catch( (err) => {
                    if (this.isConnecting) {
                        this.disconnect();  // start disconnecting to force allSettled() below to complete.
                        throw Error('One or more transports failed to connect without error.');
                    }
                    throw err;
                });
            }

            // wait for all transports to complete, if a required transport fails they all should eventually abort.
            await GcPromise.allSettled(allPromises);
            await requiredPromise;  // this should already be resolved, but we want to throw an error here if any required promise failed.

            this.assertStillConnecting();
            this.computeStatus();

            // if state is disconnecting, hold up the connect promise until the disconnect has completed.
            if (this.isDisconnecting) {
                await this.doDisconnect();
                this.computeStatus();
            }
        } catch (e) {
            const errorMessage = e.message || e.toString();
            if (errorMessage.includes('was aborted by the user')) {
                this.addProgressMessage(errorMessage);
            } else {
                this.addErrorMessage(errorMessage);
            }
            this.disconnect();
            throw e;
        } finally {
            this.isBusy = false;
            this.console.log('Finished connecting.  New state = ' + this.state);
        }

        // if no errors thrown already, and no transports connected, make sure we reject the connect promise.
        if (this.isDisconnected) {
            throw Error('One or more transports failed to connect without error.');
        }
    }

    protected async doDisconnect() {
        this.isBusy = true;
        try {
            const promises = transports.reduce((promises: Promise<void>[], transport) => {
                if (codecRegistry.isActive(transport.id)) {
                    promises.push(transport.disconnect());
                }
                return promises;
            }, []);
            await GcPromise.allSettled(promises);
            if (this.isDisconnecting) {
                this.computeStatus();  // don't compute a new status if we have already moved on from just disconnecting.
            }
        } finally {
            this.isBusy = false;
        }
    }

    protected async doAbort() {
        // do nothing for connection manager, let each transport manage its own abort operation.
    }

    private readonly transportStateChangedHandler = (details: IConnectedStateChangedEvent) => {
        if (!this.isBusy) {
            this.computeStatus();
        }
    };

    private readonly transportConnectionLogHandler = (details: IConnectionLogEvent) => {
        this.fireEvent(connectionLogEventType, details);
    };

    /**
     * Method to register transports with the connection manager.  Only registered transports, that are active in the configuration
     * will be used when connecting to the target.
     *
     * @param transport the transport to register with the connection manager.
     */
    registerTransport(transport: ITransport) {
        if (!transports.includes(transport)) {
            transports.push(transport);
            transport.addEventListener(connectedStateChangedEventType, this.transportStateChangedHandler);
            transport.addEventListener(connectionLogEventType, this.transportConnectionLogHandler);
        }
    }
    /**
     * Method to retrieve a list of all active transports in the current configuration.
     */
    getActiveTransports() {
        return transports.filter((transport) => codecRegistry.isActive(transport.id)).sort( (a, b) => codecRegistry.compareOrder(a.id, b.id));
    }

    /**
     * Method to unregister transports with the connection manager.
     *
     * @param transport the transport to unregister from the connection manager.
     */
    unregisterTransport(transport: ITransport) {
        if (transports.includes(transport)) {
            transport.removeEventListener(connectedStateChangedEventType, this.transportStateChangedHandler);
            transport.removeEventListener(connectionLogEventType, this.transportConnectionLogHandler);
            transports = transports.filter((elem) => elem !== transport);
        }
    }

    /**
     * Method to register program loaders with the connection manager.  Only registered program loaders will be used when connecting to the target.
     *
     * @param programLoader the program loader to register with the connection manager.
     */
    registerProgramLoader(programLoader: ITargetProgramLoader) {
        if (!programLoaders.includes(programLoader)) {
            programLoaders.push(programLoader);
        }
    }

    /**
     * Method to unregister program loaders with the connection manager.
     *
     * @param programLoader the program loader to unregister from the connection manager.
     */
    unregisterProgramLoader(programLoader: ITargetProgramLoader) {
        if (programLoaders.includes(programLoader)) {
            programLoaders = programLoaders.filter((elem) => elem !== programLoader);
        }
    }

    /**
     * Method to register configurations with the connection manager.  Only the active configuration will be used to connect
     * to the target.  However, multiple configurations can be registered, with the purpose of switching between different active
     * configurations.
     *
     * @param id unique identifier for a particular configuration.  This id can be used to set the active configuration.
     * @param configuration a string identifying transports, models, and codes and how they are to be interconnected.
     */
    registerConfiguration(id: string, configuration: string) {
        this.configurations.set(id, configuration);

        const promise = this.waitForConfigurations.get(id);
        if (promise) {
            promise.resolve(configuration);

            this.waitForConfigurations.delete(id);
        }
    }

    /**
     * Method to remove a registered configuration from the connection manager.
     *
     * @param id unique identifier of the configuration to unregister.
     */
    unregisterConfiguration(id: string) {
        this.configurations.delete(id);
        this.waitForConfigurations.delete(id);
    }

    /**
     * Method to dispose of the connection manager if it will not longer be used.  This will clear any register
     * transports, program loaders and configurations, and enable them to be garbage collected.
     */
    dispose() {
        this.configurations = new Map<string, string>();
        this.waitForConfigurations = new Map<string, IDeferedPromise<string>>();
        this.activeConfigurationError = NO_CONFIGURATION_ERROR;
        this.nextActiveConfiguration = '';
        this._activeConfigurationId = 'default';
        transports = new Array<ITransport>();
        programLoaders = new Array<ITargetProgramLoader>();
    }

    private computeStatus() {
        const state = { required: TRANSPORT_STATE.CONNECTED, optional: TRANSPORT_STATE.DISCONNECTED };
        let transportsConnectedCount = 0;
        const activeTransports = this.getActiveTransports();
        activeTransports.forEach((transport) => {

            if (codecRegistry.isOptional(transport.id)) {
                /*
                *       Optional                    Each Optional Target Transport
                *         State      |   CONNECTED      CONNECTING    DISCONNECTED   DISCONNECTING
                *     -----------------------------------------------------------------------------
                *  *   DISCONNECTED  |   CONNECTED      CONNECTING    DISCONNECTED   DISCONNECTING
                *  |   DISCONNECTING |   CONNECTED      CONNECTING    DISCONNECTING  DISCONNECTING
                *  |   CONNECTING    |   CONNECTED      CONNECTING     CONNECTING     CONNECTING
                *  V   CONNECTED     |   CONNECTED      CONNECTED      CONNECTED      CONNECTED
                *
                *  The way this works, is that the connectionManager starts with the optional state == DISCONNECTED.
                *  Then for each transport, one at a time, the optional state is modified based on the table above.
                *  This state always progresses down each row, so that the state cannot go up from DISCONNECTING to DISCONNECTED
                *  or up from CONNECTED to CONNECTING.  As a result, the state will only be disconnected when all optional transports
                *  are in the DISCONNECTED state, and the state will become CONNECTED if any optional transport is CONNECTED.
                */
                if (transport.state === TRANSPORT_STATE.CONNECTED) {
                    transportsConnectedCount++;
                    state.optional = TRANSPORT_STATE.CONNECTED;
                } else if (transport.state === TRANSPORT_STATE.CONNECTING || state.optional === TRANSPORT_STATE.CONNECTING) {
                    state.optional = TRANSPORT_STATE.CONNECTING;
                } else if (transport.state === TRANSPORT_STATE.DISCONNECTING || state.optional === TRANSPORT_STATE.DISCONNECTING) {
                    state.optional = TRANSPORT_STATE.DISCONNECTING;
                }
            } else { // required transport
                /*       Required                    Each Required Transport
                *         State      |   CONNECTED      CONNECTING    DISCONNECTED   DISCONNECTING
                *     -----------------------------------------------------------------------------
                *  *   CONNECTED     |   CONNECTED      CONNECTING    DISCONNECTED   DISCONNECTING
                *  |   CONNECTING    |   CONNECTING     CONNECTING    DISCONNECTED   DISCONNECTING
                *  |   DISCONNECTED  |  DISCONNECTED   DISCONNECTED   DISCONNECTED   DISCONNECTING
                *  V   DISCONNECTING |  DISCONNECTING  DISCONNECTING  DISCONNECTING  DISCONNECTING
                *
                *  The way this works, is that the connectionManager starts with the required state == CONNECTED.
                *  Then for each transport, one at a time, the required state is modified based on the table above.
                *  This state always progresses down each row, so that the state cannot go up from CONNECTING to CONNECTED or up from
                *  DISCONNECTING to DISCONNECTED.  As a result, the state will only be connected when all required transports are in the
                *  CONNECTED state, and the state will become DISCONNECTING if at least one required transport is DISCONNECTING.
                *
                *  Based on this table, there are only two outcomes, we either change the state to the current connection.state, or we don't change it.
                */
                if (transport.state === TRANSPORT_STATE.CONNECTED) {
                    // first column in state map for CONNECTED does not change the state.
                    transportsConnectedCount++;
                } else {
                    // the last row in state map does not change the state, nor does the
                    // state change if it is DISCONNECTING and the connection is CONNECTING.
                    if (state.required !== TRANSPORT_STATE.DISCONNECTING && !(state.required === TRANSPORT_STATE.DISCONNECTED && transport.state === TRANSPORT_STATE.CONNECTING)) {
                        state.required = transport.state;
                    }
                }
            }
        });

        /*  Finally, the resulting state of all optional and required transports are combined to determine resulting state
         *  overall, and this may result in a partially connected state.
	     *
	     *                                          Optional State
	     *  Required State |   CONNECTED      CONNECTING    DISCONNECTED  DISCONNECTING
	     *  -----------------------------------------------------------------------------
	     *   CONNECTED     |   CONNECTED      PARTIALLY*     PARTIALLY*     PARTIALLY*
	     *   CONNECTING    |   CONNECTING     CONNECTING     CONNECTING     CONNECTING
	     *   DISCONNECTED  |  DISCONNECTED   DISCONNECTED   DISCONNECTED   DISCONNECTING
	     *   DISCONNECTING |  DISCONNECTING  DISCONNECTING  DISCONNECTING  DISCONNECTING
	     *
	     *  (*) the partially connected state must be qualified by at least one required transport being connected.
	     *  Otherwise, we are in a situation with only optional transports, and we should use the optional state.
		 */

        let result = state.required;
        if (result === TRANSPORT_STATE.CONNECTED && state.optional !== TRANSPORT_STATE.CONNECTED) {
            // there are no optional transports connected because state.optional !== CONNECTED
            if (transportsConnectedCount === 0) {
                // there are no required transports, so use the optional state.
                result = state.optional;
            }
        } else if (result === TRANSPORT_STATE.DISCONNECTED && state.optional === TRANSPORT_STATE.DISCONNECTING) {
            result = TRANSPORT_STATE.DISCONNECTING;
        }

        // Make sure we have at least one transport connected, otherwise we are really disconnected.
        if (result === TRANSPORT_STATE.CONNECTED && transportsConnectedCount === 0) {
            result = TRANSPORT_STATE.DISCONNECTED;
        }

        const wasPartiallyConnected = this.isPartiallyConnected;

        this._isPartiallyConnected = false;
        if (result === TRANSPORT_STATE.CONNECTED && transportsConnectedCount < activeTransports.length) {
            this._isPartiallyConnected = true;
        } else {
            this._isPartiallyConnected = activeTransports.reduce( (result: boolean, transport) => result || codecRegistry.isPartiallyConnected(transport.id), false);
        }

        this.setState(result, wasPartiallyConnected !== this._isPartiallyConnected);

        if (result === TRANSPORT_STATE.DISCONNECTED) {
            this.ensureConfiguration();
        }
    }

    private isTargetConfigurationId(id: string) {
        if (id.search(/[+,)(]/) >= 0) {
            return false;
        } else if (this.configurations.has(id)) {
            return true;
        } else try {
            codecRegistry.getInstance(id);
            return false;
        } catch {
            return true;
        }
    }

    /**
     * Method to change the active configuration.  The new configuration will be used the next time the connection manager connects to
     * the target.  If the new active configuration contains codec chain operator like plus(+), comma(,), or braces() then it will be
     * assumed that this is the default configuration and you do not have to register the configuration separately.  Otherwise, the
     * new active configuration is assumed to be an identifier of a registered configuration.
     *
     * @param activeConfig the identifier of a registered configuration, or the new configuration string for the default configuration.
     */
    setActiveConfiguration(activeConfig: string) {
        const id = activeConfig.trim();
        if (!this.isTargetConfigurationId(id)) {
            this._activeConfigurationId = 'default';
            this.nextActiveConfiguration = id;
        } else {
            this._activeConfigurationId = id;
            this.nextActiveConfiguration = this.configurations.get(id) || '';
            if (!this.nextActiveConfiguration) {
                this.activeConfigurationError = Error(`Invalid configuration specified: Missing <gc-target-configuration id="${id}">.  This must exist somewhere in your index.gui.`);
                throw this.activeConfigurationError;
            }
        }

        if (this.isDisconnected) {
            this.ensureConfiguration();
            if (this.activeConfigurationError) {
                throw this.activeConfigurationError;
            }
        }
    }

    /**
     * Helper method to wait for a specific configuration, by id, has been registered with the connection manager.
     *
     * @param id the identifier of configuration to wait for.
     */
    async whenConfigurationReady(id: string) {
        let configuration = this.configurations.get(id);
        if (!configuration) {
            if (this.isTargetConfigurationId(id)) {
                const deferred = GcPromise.defer<string>();
                this.waitForConfigurations.set(id, deferred);

                configuration = await deferred.promise;
            }
        }
        await codecRegistry.whenConfigurationReady(configuration || id);
    }

    private ensureConfiguration() {
        if (this.nextActiveConfiguration) {
            try {
                codecRegistry.configure(this.nextActiveConfiguration);
                this.activeConfigurationError = undefined;
            } catch (e) {
                this.activeConfigurationError = e;
            }
            this.fireEvent(activeConfigurationChangedEvent, {});
        }
        this.nextActiveConfiguration = '';
    }

    get isPartiallyConnected() {
        return this._isPartiallyConnected;
    }

    get progressMessage() {
        const activeTransports = this.getActiveTransports();
        if (this.isConnecting) {
            const connecting = activeTransports.reduce( (count: number, transport) => count + (transport.canDisconnect ? 1 : 0), 0);
            const connected = activeTransports.reduce( (count: number, transport) => count + (transport.isConnected ? 1 : 0), 0);
            if (connecting > 0) {
                if (activeTransports.length > 1) {
                    return `connecting to ${connected + 1} of ${activeTransports.length} targets`;
                }
                return activeTransports[0].progressMessage;
            }
        }
        if (activeTransports.length === 1 && activeTransports[0].hasErrors) {
            return activeTransports[0].progressMessage;
        }
        return super.progressMessage;
    }

    get tooltipMessage(): string | undefined {
        const activeTransports = this.getActiveTransports();
        if (this.isConnecting) {
            const connecting = activeTransports.reduce( (count: number, transport) => count + (transport.canDisconnect ? 1 : 0), 0);
            if (connecting > 0) {
                if (activeTransports.length > 1) {
                    return undefined;
                }
                return activeTransports[0].tooltipMessage;
            }
        }
        if (activeTransports.length === 1 && activeTransports[0].hasErrors) {
            return activeTransports[0].tooltipMessage;
        }
        return super.tooltipMessage;
    }

    get connectionDescription() {
        const connections = this.getActiveTransports().map( transport => transport.connectionDescription ).filter( text => text );
        return connections.join(' ,');
    }

    toString() {
        return 'connection manager';
    }

    /**
     * Method to use a specific program loader to load a program onto a target device.
     *
     * @param loader the target loader that specifies the program and devices and or core to load the program onto.
     * @param logger a callback for logging error, warning, progress, and debug information.
     * @param progressCallback a callback for updating progress, as a percentage, while the program is loading.
     */
    async loadProgram(loader: ITargetProgramLoader, logger?: IConnectionLog, progressCallback?: (progress: number) => void) {
        const wasConnected = this.canDisconnect;

        // find all effected transports
        const deviceId = loader.deviceId;
        let activeTransports = this.getActiveTransports();
        let allRequired = activeTransports.filter(transport => transport.isXdsTransport).reduce( (required: boolean, transport) => required || !codecRegistry.isOptional(transport.id), false);

        if (deviceId && !allRequired) {
            const required = activeTransports.map( transport => codecRegistry.isDeviceRequired(transport.id, deviceId, true) );
            allRequired = required.reduce( (result: boolean, isRequired) => result || isRequired === 'yes', false);
            if (!allRequired) {
                activeTransports = activeTransports.filter( transport => transport.isXdsTransport || codecRegistry.isDeviceRequired(transport.id, deviceId, true) === 'maybe');
            }
        }

        // disconnect effected transports
        if (allRequired) {
            await this.disconnect();
        } else {
            await Promise.all(activeTransports.map( transport => transport.disconnect()));
        }

        // load program
        await loader.loadProgram(logger ?? this, progressCallback, true);

        // reconnect, if we started in the connected or connecting state.
        if (wasConnected) {
            if (allRequired) {
                this.connect();
            } else {
                activeTransports.map( transport => transport.connect());
            }
        }
    }
}
/**
 * Singleton instance of the global connection manager.
 */
export const connectionManager = new ConnectionManager();