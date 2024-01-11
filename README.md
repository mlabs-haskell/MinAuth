# MinAuth: Zero-Knowledge Authorization System

🚧 **DISCLAIMER: As of today MinAuth has not undergone any security audits and overall is a bit rough on edges. Use with caution.**

## Introduction
MinaAuth is a library and accompanying set of Typescript packages making it easy to set up authentication/authorization based on zero-knowledge proof verification.
The current functionality is focused on authorizing an HTTP API access with JWT tokens granted on providing valid zero-knowledge proofs.
The zero-knowledge part is provided via MINA's o1js library.

## Core Components
This repository is organized as a monorepo containing all the system's core components.

### MinAuth Library  [:link:](https://github.com/mlabs-haskell/MinAuth/tree/develop/minauth)
The library provides all the core types and interfaces that allow for cooperation between the system's elements. It has functions and utilities that help quickly set up compatible authorization plugins.  Additionally, it contains tools that may be useful when working with MinAuth, for example, a plugin HTTP server, and a compatible passport.js strategy. 

### MinAuth Plugins [:link:](https://github.com/mlabs-haskell/MinAuth/tree/develop/minauth-plugins)
MinAuth features a plugin-based architecture where the main functionality of building and verifying proofs is done via plugins. It provides a couple of example plugins and various utilities for building custom ones.
The plugin may, but doesn't have to involve blockchains such as MINA  (the natural choice because of `o1js`).
Since the authorization is given by a centralized authority (for example a server exposing a protected API) the proofs may regard any data that is verifiable by this authority ( blockchains, 3rd party database, trusted KYC provider's API data, trusted public keys, NFTs, etc).
As of today, MinAuth provides a couple of demonstrational plugins.

### Provided plugins

**A Simple Preimage Plugin** [:link:](https://github.com/mlabs-haskell/MinAuth/tree/develop/minauth-plugins/minauth-simple-preimage-plugin)  
  Probably the simplest possible plugin which functionality equals to that of a password authentication.
The server holds a set of Poseidon hashes assigned to roles or users. A ZKSnark that prove the knowledge of the preimage of given hash will grant the access.

**Merkle Memberships Plugin** [:link:](https://github.com/mlabs-haskell/MinAuth/tree/develop/minauth-plugins/minauth-merkle-membership-plugin)  
  A simple plugin that features an amazing `o1js` feature of recursive proofs.
Server is set up to have access to a storage of Merkle trees of secret commitments that can optionally be pinned to a MINA contract via their roots. 
The client can prove "membership" into the sets represented by merkle trees, by recursively adding proof layers. Each layer accepts a merkle witness and the secret behind the commitment.

**ERC721 Time-lock Plugin** [:link:](https://github.com/mlabs-haskell/MinAuth/tree/develop/minauth-plugins/minauth-erc721-timelock-plugin)  
  A plugin that demonstrates the ability to work against publicly verifiable data hosted on a blockchain. In this case Ethereum. The plugin is configured to point to a contract with a special interface that allow to time-lock an Ethereum NFT along with a secret commitment.
The plugin then monitors the chain and the contract state (and events) to build a merkle tree of secret commitments.
The prover can prove that 

### MinAuth Demo [:link:](https://github.com/mlabs-haskell/MinAuth/tree/develop/minauth-demo)  
Part of MinAuth's value proposition is to show a way to connect these innovative technologies in a full-stack web application where all the system components are configured and set up to work together. Consider it an example of how MinAuth can be set up with JWT-based ZKP-backed authentication and a playground to test out plugins or build your own.

## Usage

See this repository packages to get more information on their usage.

## Contributing
We welcome contributions, suggestions, complains (constructive!). Please use GH issues for that.

## License
See `LICENSE` file

## Credits  

The work on the library was funded by:
* zkIgnite (https://zkignite.minaprotocol.com/)
* MINA Navigators (https://minaprotocol.com/join-mina-navigators)
* MLabs (https://mlabs.city/)



