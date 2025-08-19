# hearenzo.github.io

This repository hosts the static site for Myungseok Oh.

## Link checking

A GitHub Actions workflow runs [Lychee](https://github.com/lycheeverse/lychee) to verify all links in the site's HTML files. This helps prevent broken internal or external links in pull requests.

### Running locally

1. Install the `lychee` CLI tool:
   ```bash
   cargo install lychee
   ```
2. From the project root, scan all HTML files:
   ```bash
   lychee --no-progress './**/*.html'
   ```

The command exits with a non-zero status if any links are unreachable.

## CSS build

To generate a minified stylesheet for production, run:

```bash
npm run build
```

The command writes the output to `assets/css/styles.min.css`.
