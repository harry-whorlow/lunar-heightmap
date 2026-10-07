# Lunar Heightmap

A test playground for my portfolio site, an interactive 3D lunar surface built
with Astro, TypeScript and Three.js, using real NASA elevation data.

## Getting started

The source height map is too large to store on GitHub. To run the project
locally, download it from NASA's Scientific Visualization Studio and save it
as `data/lunar-height-map.tif`:

```sh
curl -o data/lunar-height-map.tif https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_64.tif
```

Then install, sample the height map, and run:

```sh
npm install
npm run sample
npm run dev
```

Build the site with `npm run build` and preview the production build with
`npm run preview`. Run `npm run typecheck` to check the TypeScript source.
