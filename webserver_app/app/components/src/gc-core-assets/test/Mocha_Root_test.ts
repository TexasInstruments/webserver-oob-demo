/**
 * This file contains the global tear down routine for Mocha tests.
 */
import { driver } from './SeleniumDriver';

after(done => {
    /* shutdown the driver */
    driver.quit().then(done);
});