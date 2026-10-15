// Photo filters: CSS filter strings for the preview and canvas, plus pixel-level
// equivalents for browsers without CanvasRenderingContext2D.filter (e.g. iOS Safari).
// Matrices follow https://drafts.fxtf.org/filter-effects/#ShorthandEquivalents

// blur radius in CSS px of the preview
var blurRadius = 5;

var cssFilters = {
  none: 'none',
  blackandwhite: 'grayscale(1)',
  huerotate: 'hue-rotate(90deg)',
  sepia: 'sepia()',
  invert: 'invert()',
  contrast: 'contrast(200%)',
  brightness: 'brightness(0.5)',
  saturate: 'saturate()'
};

// m is a 3x4 row-major matrix: [r, g, b, offset] per output channel, offsets in 0..255
function colorMatrix(m) {
  return function (data) {
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      // Uint8ClampedArray rounds and clamps on assignment
      data[i] = m[0] * r + m[1] * g + m[2] * b + m[3];
      data[i + 1] = m[4] * r + m[5] * g + m[6] * b + m[7];
      data[i + 2] = m[8] * r + m[9] * g + m[10] * b + m[11];
    }
  };
}

function linear(slope, intercept) {
  return [
    slope, 0, 0, intercept,
    0, slope, 0, intercept,
    0, 0, slope, intercept
  ];
}

function grayscale() {
  return [
    0.2126, 0.7152, 0.0722, 0,
    0.2126, 0.7152, 0.0722, 0,
    0.2126, 0.7152, 0.0722, 0
  ];
}

function sepia() {
  return [
    0.393, 0.769, 0.189, 0,
    0.349, 0.686, 0.168, 0,
    0.272, 0.534, 0.131, 0
  ];
}

function saturate(s) {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0
  ];
}

function hueRotate(deg) {
  var rad = deg * Math.PI / 180,
    cos = Math.cos(rad),
    sin = Math.sin(rad);
  return [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928, 0,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283, 0,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072, 0
  ];
}

// one box blur pass along a line of pixels; `step` is the distance between neighbours in the array
function boxBlurLine(src, dst, start, count, step, radius) {
  var size = radius * 2 + 1,
    last = start + (count - 1) * step;
  for (var c = 0; c < 3; c++) {
    var sum = 0,
      i;
    for (i = -radius; i <= radius; i++) {
      sum += src[Math.min(Math.max(start + i * step, start), last) + c];
    }
    for (i = 0; i < count; i++) {
      var pos = start + i * step;
      dst[pos + c] = sum / size;
      sum += src[Math.min(pos + (radius + 1) * step, last) + c] - src[Math.max(pos - radius * step, start) + c];
    }
  }
}

// approximates a gaussian blur with standard deviation `sigma` by three box blurs
function blur(sigma) {
  var radius = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  return function (data, width, height) {
    var tmp = new Uint8ClampedArray(data),
      x, y, pass;
    for (pass = 0; pass < 3; pass++) {
      for (y = 0; y < height; y++) {
        boxBlurLine(data, tmp, y * width * 4, width, 4, radius);
      }
      for (x = 0; x < width; x++) {
        boxBlurLine(tmp, data, x * 4, height, width * 4, radius);
      }
    }
  };
}

// keys match cssFilters, blur is handled separately because its size depends on scale
var pixelFilters = {
  blackandwhite: colorMatrix(grayscale()),
  huerotate: colorMatrix(hueRotate(90)),
  sepia: colorMatrix(sepia()),
  invert: colorMatrix(linear(-1, 255)),
  contrast: colorMatrix(linear(2, 255 * (0.5 - 0.5 * 2))),
  brightness: colorMatrix(linear(0.5, 0)),
  saturate: colorMatrix(saturate(1))
};

export var canvasFilterSupported = 'filter' in CanvasRenderingContext2D.prototype;

// `scale` is image px per CSS px of the preview, so a captured photo is blurred
// as much as the (downscaled) preview looks
export function cssFilter(name, scale) {
  if (name === 'blur') {
    return 'blur(' + blurRadius * (scale || 1) + 'px)';
  }
  return cssFilters[name] || 'none';
}

export function applyPixelFilter(context, name, scale) {
  var filter = name === 'blur' ? blur(blurRadius * (scale || 1)) : pixelFilters[name],
    canvas = context.canvas,
    image;
  if (!filter) {
    return;
  }
  image = context.getImageData(0, 0, canvas.width, canvas.height);
  filter(image.data, canvas.width, canvas.height);
  context.putImageData(image, 0, 0);
}
