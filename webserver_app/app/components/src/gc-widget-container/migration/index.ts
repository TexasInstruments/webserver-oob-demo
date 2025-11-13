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

import { ElementBlock, Version, V3_0_0, MigrationManager } from '../../gc-core-migration/migration/MigrationManager';
import { AbstractMigrator } from '../../gc-core-migration/migration/Migrator';

export default class GCWidgetContainerMigrator extends AbstractMigrator {
    getSupportedElements(): undefined | Record<string, (element: ElementBlock, fromLibVer: Version, toLibVer: Version) => Promise<void>> {
        return {
            'ti-widget-container': this.migrateTiWidgetContainer.bind(this),
            'gc-widget-container': this.migrateGcWidgetContainer.bind(this)
        };
    }

    /**
     * Migrate ti-widget-container to gc-widget-container
     *
     * @param element
     * @param fromLibVer
     * @param toLibVer
     */
    async migrateTiWidgetContainer(element: ElementBlock, fromLibVer: Version, toLibVer: Version): Promise<void> {
        /* migration from 2.x to 3.0 */
        if (MigrationManager.shouldMigrate(fromLibVer, toLibVer, V3_0_0)) {

            /* migrate ti-widget-container to gc-widget-container */
            const { attrsNewValue, attrsToRemove, attrsToRename } = this.migrateCommons(element, fromLibVer, toLibVer);

            const oldAttrs = Object.assign({}, element.attributes);
            switch (element.name) {
                case 'ti-widget-container':
                    /* tag migration */
                    for (const k in oldAttrs) {
                        const attribute = oldAttrs[k];
                        const name = attribute.name;

                        /* deprecated attributes */
                        if ([
                            'font-size',
                            'custom-font-size',
                            'font-color',
                            'auto-scroll'
                        ].includes(name)) {
                            attrsToRemove.push(name);
                        }
                    }

                    /* replace old element with new element */
                    this.updateElement(element, 'gc-widget-container', attrsNewValue, attrsToRename, attrsToRemove);

                    /* css rule migration */
                    if (oldAttrs['fontSize']?.getValue() === 'custom' && oldAttrs['customFontSize']) {
                        element.setStyle('font-size', oldAttrs['customFontSize'].getValue());
                    } else if (oldAttrs['fontSize']) {
                        element.setStyle('font-size', oldAttrs['fontSize'].getValue());
                    }

                    if (oldAttrs['fontColor']?.getValue()) {
                        element.setStyle('font-color', oldAttrs['fontColor'].getValue());
                    }

                    if (oldAttrs['id']?.getValue() !== 'viewport' && oldAttrs['autoScroll']) {
                        element.setStyle('overflow', 'auto');
                    }

                    /* notify the migration manager on the migrated element and purge the import link */
                    this.migrationManagerCallback.addConsumed(element);
                    this.migrationManagerCallback.purgeImport('components/ti-widget-common/ti-widget-container.html');
                    this.migrationManagerCallback.purgeImport('components/iron-flex-layout/iron-flex-layout.html');

                    break;

                case 'ti-tile-container':
                    // TODO:
                    break;

                case 'ti-widget-tilecontainer':
                    // TODO:
                    break;

                // TODO: convert all other tile components
            }
        }
    }

    /**
     * Migrate gc-widget-container
     *
     * @param element
     * @param fromLibVer
     * @param toLibVer
     */
    async migrateGcWidgetContainer(element: ElementBlock, fromLibVer: Version, toLibVer: Version): Promise<void> {
    }
}