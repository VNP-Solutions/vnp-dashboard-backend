# VNP Backend Documentation

Developer documentation for VNP Dashboard Backend, built with [Docusaurus](https://docusaurus.io/).

Served at **`/docs`** on the same Nest process as the API (static files in `public/docs/`).

Swagger remains at **`/api/docs`**.

## Commands

From the **project root**:

```bash
yarn docs:install
yarn docs:dev      # http://localhost:3002/docs/
yarn docs:build    # → public/docs/
yarn build         # docs + nest build
```

## Production

`ServeStaticModule` serves `public/docs` at `/docs` (public, no JWT).

```bash
yarn build
node dist/main
# open http://localhost:<port>/docs
```
