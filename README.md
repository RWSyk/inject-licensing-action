# Inject Licensing GitHub Action & CLI Tool

Automated SDK injection and release publishing for WordPress plugins and themes.

## Usage in GitHub Workflows

Add `.github/workflows/release.yml` to your plugin repository:

```yaml
name: Build & Release Licensed Plugin

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Create Plugin ZIP
        run: zip -r ./plugin.zip . -x "*.git*"

      - name: Inject SDK & Upload Release
        uses: RWSyk/inject-licensing-action@v1.0.0
        with:
          product-id: 'my-plugin-slug'
          api-key: ${{ secrets.DEVELOPER_API_KEY }}
          server-url: 'https://licensing.example.com'
          input-zip: './plugin.zip'
          output-zip: './licensed-plugin.zip'
          version: ${{ github.ref_name }}
```

## Local CLI Usage

```bash
npx licensing-injector --input=./plugin.zip --product-id=my-plugin-slug --server-url=https://example.com --api-key=dev_sec_xxx --upload
```
