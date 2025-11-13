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
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { Version, V3_0_0, MigrationManager, ElementBlock, HtmlParser, IMigrationManagerCallback, IElementMigrator } from './MigrationManager';

export type AttrsToRename = Array<{ fromName: string; toName: string }>;
export type AttrsNewValue = Array<{ name: string; value: string }>;
export type AttrsToRemove = Array<string>;

/**
 * An abstract element migrator.
 */
export abstract class AbstractMigrator implements IElementMigrator {
    constructor(readonly path: string, readonly htmlParser: HtmlParser, readonly migrationManagerCallback: IMigrationManagerCallback) { }

    /**
     * Migrate common properties.
     *
     * @param element the element
     * @param fromLibVer
     * @param toLibVer
     */
    protected migrateCommons(element: ElementBlock, fromLibVer: Version, toLibVer: Version): { attrsNewValue: AttrsNewValue; attrsToRename: AttrsToRename; attrsToRemove: AttrsToRemove } {
        const attrsNewValue: AttrsNewValue = [];
        const attrsToRename: AttrsToRename = [];
        const attrsToRemove: AttrsToRemove = [];

        if (MigrationManager.shouldMigrate(fromLibVer, toLibVer, V3_0_0)) {
            if (element.attributes['nonvisible']) {
                attrsToRename.push({ fromName: 'nonvisible', toName: 'hidden' });

            } else if (element.attributes['visible']) {
                attrsToRemove.push('visible');
            }
        }

        return { attrsNewValue: attrsNewValue, attrsToRename: attrsToRename, attrsToRemove: attrsToRemove };
    }

    /**
     * Updates the element to the new tagName and update attributes values.
     *
     * @param element the element
     * @param tagName the new tag name
     * @param attrsNewValue the new attributes
     * @param attrsToRename  the attributes to rename
     * @param attrsToRemove the attributes to remove
     */
    protected updateElement(element: ElementBlock, tagName: string, attrsNewValue: AttrsNewValue, attrsToRename: AttrsToRename, attrsToRemove: AttrsToRemove) {
        element.rename(tagName);
        attrsNewValue.forEach(({ name, value }) => element.setAttribute(GcUtils.dashToCamelCase(name), value));
        attrsToRename.forEach(({ fromName, toName }) => element.renameAttribute(GcUtils.dashToCamelCase(fromName), GcUtils.dashToCamelCase(toName)));
        attrsToRemove.forEach(attr => element.removeAttribute(GcUtils.dashToCamelCase(attr)));
    }

    /**
     * Removes the element.
     *
     * @param element the element
     */
    protected removeElement(element: ElementBlock) {
        element.detached();
        element.parentElement.removeChild(element);
    }

    /**
     * Returns a map of migrate-able element names and it's migration function.
     */
    abstract getSupportedElements(): undefined | Record<string, (element: ElementBlock, fromLibVer: Version, toLibVer: Version) => Promise<void>>;
}