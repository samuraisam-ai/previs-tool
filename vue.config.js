// Production build settings: no source maps (smaller deploy), relative paths so the site works
// from any static host or subfolder.
module.exports = {
  productionSourceMap: false,
  publicPath: './',
  pages: { index: { entry: 'src/main.ts', title: 'Previs Tool by Leverage AI' } }
}
