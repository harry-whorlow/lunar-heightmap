# Solar Heightmap

A test playground for my portfolio site, interactive 3D planetary surfaces built
with Astro, TypeScript and Three.js, using real NASA elevation data.

## Getting started

The source height maps are too large to store on GitHub. To run the project
locally, download them into `data/`:

Moon (NASA Scientific Visualization Studio, LRO LOLA):

```sh
curl -o data/lunar-height-map.tif https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_64.tif
```

Mars (USGS Astrogeology, MGS MOLA / HRSC):

```sh
curl -L -o data/mars-height-map.tif https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif
```

Then install, sample the height maps, and run:

```sh
npm install
npm run sample
npm run sample -- --body mars
npm run dev
```

Pass `--cols` and `--rows` to change the grid resolution (default 1024x512).

The site lives under the `/solar-heightmap` base path, matching the GitHub
Pages repo name. The index links to `/solar-heightmap/lunar-heightmap/` and
`/solar-heightmap/mars-heightmap/`.

Build the site with `npm run build` and preview the production build with
`npm run preview`. Run `npm run typecheck` to check the TypeScript source.
