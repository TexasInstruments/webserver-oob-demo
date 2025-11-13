import { expect } from 'chai';

import { GcLocalStorage } from '../lib/GcLocalStorage';

describe('GcLocalStorage', () => {
    beforeEach(() => {
        GcLocalStorage.clear();
    });

    it('setItem', () => {
        GcLocalStorage.setItem('patrickIsCool', 'true');
        GcLocalStorage.setItem('patrickIsAwesome', 'veryTrue');
        const cool = GcLocalStorage.getItem('patrickIsCool');
        const awesome = GcLocalStorage.getItem('patrickIsAwesome');

        expect(cool).is.equal('true');
        expect(awesome).is.equal('veryTrue');
    });

    it('getItem', () => {
        GcLocalStorage.setItem('not_empty', 'super duper');
        GcLocalStorage.setItem('empty', '');
        const notEmpty = GcLocalStorage.getItem('not_empty');
        const empty = GcLocalStorage.getItem('empty');
        const invalid = GcLocalStorage.getItem('invalid');

        expect(notEmpty).is.equal('super duper');
        expect(empty).is.equal('');
        expect(invalid).is.null;
    });

    it('removeItem', () => {
        GcLocalStorage.setItem('patrickIsCool', 'true');
        let cool = GcLocalStorage.getItem('patrickIsCool');
        expect(cool).is.equal('true');
        GcLocalStorage.removeItem('patrickIsCool');
        cool = GcLocalStorage.getItem('patrickIsCool');
        expect(cool).is.null;
    });

    it('length', () => {
        expect(GcLocalStorage.length).is.equal(0);
        GcLocalStorage.setItem('patrickIsCool', 'true');
        expect(GcLocalStorage.length).is.equal(1);
    });

    it('key', () => {
        GcLocalStorage.setItem('patrickIsCool1', 'true');
        GcLocalStorage.setItem('patrickIsCool2', 'true');
        GcLocalStorage.setItem('patrickIsCool3', 'true');
        expect(GcLocalStorage.key(0)).is.equal('patrickIsCool1');
        expect(GcLocalStorage.key(1)).is.equal('patrickIsCool2');
        expect(GcLocalStorage.key(2)).is.equal('patrickIsCool3');
    });
});
