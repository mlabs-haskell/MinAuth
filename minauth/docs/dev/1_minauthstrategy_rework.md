## Problem
As of now (Feb 2024) MinAuth integrates passport.js / express.js stack only. Of course it can be used anywhere else, but that'd require a bit more manual work ( probably not that much at all).
The mean through the support is provided is the `MinAuthStrategy` - passport.js strategy that work with MinAuth's plugins. Apart from configuration it is the main point of interaction between any server using MinAuth and MinAuth/MinAuth plugins themselves.
The present implementation is notably basic, providing a fixed, non-customizable mode of interaction with the MinAuth plugin server, which is set up to receive requests at a specified URL.
The next development milestone is to improve the situation.


## Goals

The goal is to unlock the following:
- Simple setups where one can initialized and configure plugin and strategy to work together ad-hoc
- More complex strategies that use combination of plugins to establish a user role in the system.
- Retain the ability to use external plugin-server for hosting the and configuring the plugins.
- And lastly - to not be tied to the passport.js strategy - i.e. the strategy should be thin and merely use an abstraction that does not depend on express+passport stack.

The difficulties may come with the type-level machinery of plugins configuration and IO, but also with the fact that provers (client-side part of plugins) rely on the ability to communicate with the plugins over custom HTTP routes.

### Revocation

Additionally the server using MinAuth must be able to re-check the always up-to-date validity of the MinAuth plugins outputs.
The plugin can identify its own output and provide the validity guarantee, but passport.js strategy does not deal with this problem.
Previously it was the responsibility of the plugin server itself, but now it seems that it should be split between the two new entities.

## Proposed Solution

A possible solution would be to introduce two new entities:
- A `PluginHost` - generalization of the plugin server. This entity would be responsible for holding runtime instances of plugins and relay communication between its users and the plugins. Additionally it could aggregate all the custom routes of plugins and make them installable at one go. This would mean continued dependency on express.js but it does make it a little bit more centralized and easier to drop in the future.
- An `AuthMapper` - an entity that would map bidirectionally a combination of plugin outputs to the authentication response further made available through the minauthstrategy
- `MinAuthStrategy` will use `AuthMapper` to request authentication, the same `Authmapper` should be used for assessing validitity of the outputs / deciding if the outputs should be revoked.

This way the simplest way to set up MinAuth will become something akin to: 

```typescript

// -------- API example  / prototyping

const somePlugin = {} as unknown as IMinAuthPlugin<FpInterfaceType, unknown, unknown>;

const pluginHost = new InMemoryPluginHost({ plugins: [{ name: 'some-plugin-1', plugin: somePlugin }] });

const authMapper = await PluginToRoleMapper.initialize(
  pluginHost,
  { 'simple-preimage-1': (plugin_output) =>  ['user'] }
);

const strategy = new MinAuthStrategy(authMapper, logger);

```




### backward compatibility
- The pluginserver should implement the abstraction of the plugin host and it should use a strategy called `AnyPluginStrategy`.
