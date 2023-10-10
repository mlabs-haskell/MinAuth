# MinAuth

Rapid development of POC of MinAuth - MinAuth is a library and a set of tools for providing JWT-based authentication protocol that uses SnarkyJS zero-knowledge proofs as the basis of the authentication. It uses plugins to prove statements about external data such as on-chain data or 3rd-party data.

### Current status

The current code implements minimal authentication flow that recreates the usual passport authentication, but using snarkyjs ZKPs.

### Repository Structure

Currently the source code of the repository is structure like this:

```
.
├── headlessClient
├── library
│   ├── client
│   ├── common
│   ├── plugin
│   ├── server
│   └── tools
├── plugins
│   └── simplePreimage
└── someServer
```

- headlessClient

This contains a hypothetical headless client using the MinAuth-enriched `someServer`. The purpose is to allow for quick tests and prototyping of the rest of the repository.

- library

This directory contains the code of the core library. It is divided by modules usage site. So for example in `library/plugin` you'll find stuff to build your own MinAuth plugins.

- plugins

This directory contains the official MinAuth plugins.

- someServer

An example of how you would use MinAuth on your server.
