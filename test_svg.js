const fs = require('fs');
const svgson = require('svgson');
const path = 'D:/workspace/svg_movie_maker/svg_movie_editor_next/public/assets/template/MS_70007_1/MS_70007_1.svg';
const svgString = fs.readFileSync(path, 'utf8');

const { SVGPathData } = require('svg-pathdata');

svgson.parse(svgString).then(ast => {
  const layer = ast.children.find(c => c.name === 'g' && c.attributes.class === 'layer');
  console.log(layer.children.filter(c => c.name === 'g').map(c => c.attributes.id));
});
