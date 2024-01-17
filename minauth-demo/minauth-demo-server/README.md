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

### Additional steps for NFT time-lock plugin

In order to succefully demo the ERC721-timelock plugin will have to have a funded (ETH for transactions) wallet with NFT's that it can lock.
You can do so by using a CLI provided with the plugin. For example:

1. Give 5 ETH to the address

```bash

    $ npx ts-node eth-contract/scripts/cli.ts fund -a [the-wallets-eth-address] -v 5

```
2. Mint NFT tokens #1 and #2

```bash

    $ npx ts-node eth-contract/scripts/cli.ts mint -a [the-wallets-eth-address]
    $ npx ts-node eth-contract/scripts/cli.ts mint -a [the-wallets-eth-address]

```


### E2E tests with headless client

The demo server features a set of e2e tests and the example of how to use headless client and proof generators with MinAuth. To run it first setup the server and then run:

```
   $ npm run test
```
