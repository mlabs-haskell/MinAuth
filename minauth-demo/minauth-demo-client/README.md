# MinAuth Demo Client

This project is meant to be an example of how to use MinAuth provers in the browser.
It provides interfaces for the tree official MinAuth plugins and interacts with a server that
you can find in the parent directory of this client.

The UI is built with react & next.js.
It presents the overall data flow that you may expect when working with MinAuth.


## Setup

To build the project follow these steps:

1. Install node dependencies: `npm i`
2. Run the next.js app: `npm run dev`
3. The client should be run after the backend services (at ports 3000 & 3001) are launched.
4. Use `127.0.0.1:3002` instead of suggested by next.js `localhost:3002` - sometimes express.js proxy middleware has issues with proxying `localhost` requests.

The server configuration is hardcoded in one of modules: `server-config.ts`
