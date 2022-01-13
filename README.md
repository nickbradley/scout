# Scout README

To package the extension:

1. Build the ui by running `yarn build` in the ui directory.
2. Run `vsce package --yarn` in the vscode directory.

## Publishing

This only needs to be done once (until the token expires):
`vsce login ncbradley`