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
import { Element, Component } from '@stencil/core';
import { connectionManager } from '../gc-target-connection-manager/lib/ConnectionManager';

/**
 * `gc-target-configuration` defines a particular configuration of models, codecs, and transports for the connection manager.
 * A configuration as a tree with children.  The roots of the tree are the transports, and the leafs are the models.  To declare a
 * particular configuration you use the plus (+) operator to add a single child, and square brakets ([]) to add multiple children to a parent.  All
 * identifiers must refer to models, codecs, or transports by id (including custom ones created for a particular application), that are
 * present in index.gui.  This component is optional if you only have one configuration.  In this situation, you can set the
 * connection manager's acitveConfiguration property to the configuration string directly and avoid having to have a
 * `gc-target-configuration tag`.
 *
 * @usage
 * @label Target Configuration
 * @group Transports, Models, and Codecs
 */
@Component({
    tag: 'gc-target-configuration',
    shadow: true
})

export class GcTargetConfiguration {

    constructor() {
    }

    @Element() el!: HTMLElement;

    connectedCallback() {
        connectionManager.registerConfiguration(this.el.id || 'default', this.el.innerHTML);
    }

    disconnectedCallback() {
        connectionManager.unregisterConfiguration(this.el.id || 'default');
    }
}
