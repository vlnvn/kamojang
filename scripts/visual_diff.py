"""Quantify FULL unmasked Figma comparison. Private inputs and output only."""
import json
from pathlib import Path
from PIL import Image, ImageChops

folder = Path('.private/visual')
results = {}
for route in ['ringkasan', 'analisis', 'metode']:
    reference = Image.open(folder/f'figma-{route}.png').convert('RGB')
    actual = Image.open(folder/f'actual-{route}.png').convert('RGB')
    assert reference.size == actual.size == (1600, 960)
    diff = ImageChops.difference(reference, actual)
    pixels = list(diff.getdata())
    mismatch = sum(max(pixel) > 16 for pixel in pixels)/len(pixels)
    error = sum(sum(pixel) for pixel in pixels)/(len(pixels)*3)
    diff.save(folder/f'diff-{route}.png')
    Image.blend(reference, actual, .5).save(folder/f'overlay-{route}.png')
    results[route] = {'different_pixels_over_16_rgb_percent': round(mismatch*100, 3), 'mean_absolute_channel_error': round(error, 3), 'mask': 'none', 'status': 'FAIL: does not pixel-match Figma'}
(folder/'comparison.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
