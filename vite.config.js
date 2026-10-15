import { defineConfig } from 'vite';
import { minify } from 'html-minifier-terser';

function minifyHtml() {
  return {
    name: 'minify-html',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return minify(html, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true,
      });
    },
  };
}

export default defineConfig({
  root: 'src',
  plugins: [minifyHtml()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: true,
    cssMinify: true,
  },
});
