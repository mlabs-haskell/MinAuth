## Minauth dev scripts

In this directory you will find scripts that make it a little bit easier to develop MinaAuth and with MinAuth.

### install_deps

For seamless development in the monorepo one can use `install_deps` babashka script which will copy-over the built dependencies to the depending project and use them instead of npmjs dependencies.
Remember to update the paths to the project and then use it like this:

```
    $ ./devops/install_deps.bb
```

