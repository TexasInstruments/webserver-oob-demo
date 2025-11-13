import { expect } from 'chai';
import { GcPromise, IDeferedPromise } from '../../gc-core-assets/lib/GcPromise';
import { GcUtils } from '../lib/GcUtils';

describe('GcPromise', () => {
    it('allSettled', async () => {
        let completed = false;

        const deferred: IDeferedPromise<void>[] = [ GcPromise.defer(), GcPromise.defer(), GcPromise.defer() ];

        GcPromise.allSettled(deferred.map( (deferred) => deferred.promise)).then( () => completed = true );

        expect(completed).to.be.false;
        deferred[2].resolve();
        await GcUtils.delay(1);

        expect(completed).to.be.false;
        deferred[1].reject('no reason');
        await GcUtils.delay(1);

        expect(completed).to.be.false;
        deferred[0].reject('why not');
        await GcUtils.delay(1);

        expect(completed).to.be.true;
    });

    it('empty allSettled call', async () => {
        let completed = false;

        GcPromise.allSettled([]).then( () => completed = true );
        await GcUtils.delay(1);

        expect(completed).to.be.true;
    });

});
