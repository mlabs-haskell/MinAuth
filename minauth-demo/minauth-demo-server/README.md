# MinAuth Demo Server

This package contains an example of a server using MinAuth authorize access to some of its endpoints.
It uses express.js, passport.js and MinAuth + JWT passport.js strategies.

### Usage

Follow these steps to set up and run the server API.

 1. Clone the repository
 2. Enter the server package root directory
 3. Install the server's dependencies: `npm i`
 5. Build the server: `npm run build`
 5. Create `minauth-config.template.json` (you can use the template in `minauth-config.template.json`) to enable and configure plugins. The schema of the config can be found in the MinAuth library codebase. Due to a bug wrt to in-browser compilation of recursive zk-programs, the merkle-membership-program will not be usable in the demo client.
 6. The template config enables all three (as of now) official MinAuth plugins. Some of them require additional services to be run and/or to build the plugin packages first, for example erc721-timelock plugin. Please make sure to setup the plugin first (instructions should be available in the plugin's README)

After the server is set up you can easily provide its backend services via:

     $ npm run run-backend


### E2E tests with headless client

The demo server features a set of e2e tests and the example of how to use headless client and proof generators with MinAuth. To run it first setup the server and then run:

```
   $ npm run test
```
