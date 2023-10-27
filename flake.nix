{
  description = "MinAuth";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    pre-commit-hooks-nix.url = "github:cachix/pre-commit-hooks.nix";
    gitignore = {
      url = "github:hercules-ci/gitignore.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs @ {
    flake-parts,
    pre-commit-hooks-nix,
    gitignore,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      imports = [
        inputs.pre-commit-hooks-nix.flakeModule
      ];
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      perSystem = {
        config,
        self',
        inputs',
        pkgs,
        system,
        ...
      }: let
        nodeMajorVersion = 18;
        runNode2Nix = pkgs.writeShellScriptBin "runNode2Nix" ''
          ${pkgs.node2nix}/bin/node2nix \
          -${builtins.toString nodeMajorVersion} \
          --input package.json \
          --lock package-lock.json \
          --node-env ./nix/node-env.nix \
          --composition ./nix/default.nix \
          --output ./nix/node-package.nix \
          --development \
          --include-peer-dependencies
        '';
        nodejs = pkgs."nodejs-${builtins.toString nodeMajorVersion}_x";
        node2nixOutput = import ./nix {inherit pkgs nodejs system;};
        nodeDependencies = node2nixOutput.nodeDependencies;
        minAuth = pkgs.stdenv.mkDerivation {
          name = "MinAuth";
          version = "0.1.0";
          src = gitignore.lib.gitignoreSource ./.;
          buildInputs = [nodejs];
          buildPhase = ''
            runHook preBuild
            ln -sf ${nodeDependencies}/lib/node_modules ./node_modules
            export PATH="${nodeDependencies}/bin:$PATH"
            npm run build
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp package.json $out/package.json
            cp -r dist $out/dist
            ln -sf ${nodeDependencies}/lib/node_modules $out/node_modules
            runHook postInstall
          '';
        };
        minAuthTests = pkgs.stdenv.mkDerivation {
          name = "MinAuth-tests";
          version = "0.1.0";
          src = gitignore.lib.gitignoreSource ./.;
          buildInputs = [
            nodejs
            # TODO: determine if this isreally required
            pkgs.nodePackages.ts-node
          ];
          buildPhase = ''
            runHook preBuild
            ln -sf ${nodeDependencies}/lib/node_modules ./node_modules
            export PATH="${nodeDependencies}/bin:$PATH"
            npm run test
            runHook postBuild
          '';
          installPhase = ''touch $out '';
        };
        eslintWithPlugins =
          pkgs.writeShellScriptBin "eslint-with-plugins"
          "NODE_PATH=${nodeDependencies}/lib/node_modules ${nodeDependencies}/lib/node_modules/.bin/eslint $@";

        combinedCheck = pkgs.symlinkJoin {
          name = "MinAuth-combined-check";
          paths = [
            minAuthTests
            self'.checks.pre-commit
          ];
        };
      in {
        pre-commit.settings.hooks = {
          eslint.enable = true;
          prettier.enable = true;
          alejandra.enable = true;
        };

        pre-commit.settings.settings.eslint.binPath = "${eslintWithPlugins}/bin/eslint-with-plugins";

        devShells.default = pkgs.mkShell {
          packages = [
            nodejs
            config.pre-commit.settings.package
            runNode2Nix
          ];
          shellHook = config.pre-commit.installationScript;
        };

        checks = {
          tests = minAuthTests;
          default = combinedCheck;
        };

        packages = {
          inherit minAuth;
          default = minAuth;
        };
      };
      flake = {
        herculesCI.ciSystems = ["x86_64-linux"];
      };
    };
}
