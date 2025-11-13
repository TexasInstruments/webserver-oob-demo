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
import { IEvent, IListener } from '../../../gc-core-assets/lib/Events';
import { GcPromise } from '../../../gc-core-assets/lib/GcPromise';

export interface IProgressCounter {
    /**
	 * Method to increase the count of jobs to do.
	 *
	 * @param {number} [jobs=1] - the number of new jobs to wait for completion on.
	 */
    wait(jobs?: number): void;

    /**
	 * Method to increase the count of jobs completed that have been completed.
	 *
	 * @param {number} [jobs=1] - the number of jobs that have been completed.
	 */
    done(jobs?: number): void;

    /**
	 * Method to retrieve the current number of jobs completed as a percentage of the total jobs.
	 * if there are no jobs to do at all, the percentage will be 100%.
	 *
	 * @return {number} - the percentage of jobs that have been completed.  A number between 0 and 100.
	 */
    getProgress(): number;

    readonly promise: Promise<number>;

    /**
	 * Count of number of progress jobs completed so far.
	 */
    readonly count: number;

    /**
	 * Count of number of progress jobs to be completed.
	 */
    readonly totalCount: number;
}

export const nullProgressCounter = new (class implements IProgressCounter {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    wait() {
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    done() {
    }
    getProgress() {
        return 100;
    }
    readonly promise = Promise.resolve(0);
    readonly count = 0;
    readonly totalCount = 0;
})();

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IFinished extends IEvent {
    jobsCompleted: number;
}

/**
 * Class that implements IProgressCounter interface to count progress.
 * This class is constructed with a
 * callback that will be called when the progress reaches 100%.
 * A single initial job is added to the progress counter automatically.
 * in the constructor.
 * As a result, the client must call IProgressCounter.done() once to
 * complete the job.  Typically, the client will pass this object
 * around to other parties who may or may not add their own jobs
 * to the progress counter.  Only when all jobs are completed will
 * the client receive the callback.
 *
 */
export class ProgressCounter implements IProgressCounter {
    wait(jobs: number = 1) {
        this.jobCount += jobs;
    }
    done(jobs: number = 1) {
        this.jobsDone += jobs;

        if (this.jobsDone === this.jobCount) {
            if (this.callback) {  // make sure callback is called immediately, instead of waiting for next clock tick for promise.
                this.callback({ jobsCompleted: this.jobCount - 1 });
                this.callback = undefined;
            }
            this.deferred.resolve(this.jobCount - 1);
        }
    }
    getProgress(): number {
        return 100 * this.jobsDone / this.jobCount;
    }
    private jobCount = 1;
    private jobsDone = 0;
    private deferred = GcPromise.defer<number>();
    promise: Promise<number>;
    constructor(private callback?: IListener<IFinished>) {
        this.promise = this.deferred.promise;
    }

    get count() {
        return this.jobsDone;
    }

    get totalCount() {
        return this.jobCount;
    }
}
