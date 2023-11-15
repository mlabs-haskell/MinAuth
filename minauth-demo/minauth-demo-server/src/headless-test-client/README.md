# Headless Client

This is a cli tool for testing `someServer` and `pluginServer`.

## How to use it

### Spin up both servers

1. Generate test fixtures

```bash
mkdir .fixtures
npm run run-client -- runUtil genRoles
npm run run-client -- runUtil genTrees
```

2. Start the plugin server:

```bash
npm run serve-plugin-server
```

3. (In another terminal) Start the api server:

```bash
npm run serve-api
```

### Login using the simple preimage plugin

1. Create a configuration file `.fixtures/sppConf.json` with the following content:

```json
{ "password": "1" }
```

2. Login:

```bash
npm run run-client -- login -g SimplePreimage -c ./.fixtures/sppConf.json
```

The jwt token issued by the api server will be stored at `.fixtures/jwt`.

### Login using the merkle memberships plugin

1. Create a configuration file `.fixtures/mmpConf.json` with the following content:

```json
{
  "pluginUrl": "http://127.0.0.1:3001/plugins/MerkleMembershipsPlugin",
  "allInputs": [
    {
      "treeRoot": "23677077440781146505135211739372132754346907641862154489298610120615142915141",
      "leafIndex": "0",
      "secret": "0"
    },
    {
      "treeRoot": "18899731314113395294456531345036718829118004565425508785092877281253012411124",
      "leafIndex": "2",
      "secret": "2"
    }
  ]
}
```

2. Login

```bash
npm run run-client -- login -g MerkleMembership -c ./.fixtures/mmpConf.json
```

### Refresh JWT Token

```bash
npm run run-client -- refresh
```

### Access Protected Route

```bash
npm run run-client -- accessProtected
```
