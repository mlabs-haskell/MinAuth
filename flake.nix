{
  description = "MinAuth";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    pre-commit-hooks-nix.url = "github:cachix/pre-commit-hooks.nix";
  };

  outputs = inputs @ {
    flake-parts,
    pre-commit-hooks-nix,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      imports = [
        inputs.pre-commit-hooks-nix.flakeModule
      ];
      systems = ["x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin"];
      perSystem = {
        config,
        self',
        inputs',
        pkgs,
        system,
        ...
      }: {
        pre-commit.settings.hooks = {
          eslint.enable = true;
          prettier.enable = true;
          alejandra.enable = true;
        };
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            nodePackages.typescript
            nodePackages.typescript-language-server
            config.pre-commit.settings.package
          ];
          shellHook = config.pre-commit.installationScript;
        };
      };
      flake = {
      };
    };
}
