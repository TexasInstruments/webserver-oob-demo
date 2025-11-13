import '../../gc-core-assets/lib/NodeJSEnv';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { expect } from 'chai';
import { IBackplaneService, backplaneServiceType } from '../lib/BackplaneService';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';

//-------------------------------------------------------------------------------------------------------------------------------
// Enable Logging
const [logLevel] = Array.prototype.slice.call(process.argv).filter(e => e.startsWith('--enableLog')).map(e => e.split('=')[1]);
GcConsole.setLevel('gc-service-backplane', logLevel);
//-------------------------------------------------------------------------------------------------------------------------------

describe('BackplaneServiceTest', () => {
    let service: IBackplaneService;
    before(() => {
        service = ServicesRegistry.getService<IBackplaneService>(backplaneServiceType);
        expect(service).is.not.null;
    });

    it('getSubModule', done => {
        (async () => {
            const file = await service.getSubModule('File');
            !file ? done('File SubModule not found.') : done();
        })();
    });

    it('getUtil', done => {
        (async () => {
            const util = await service.getUtil();
            !util ? done('Failed to get Util object.') : done();
        })();
    });
});