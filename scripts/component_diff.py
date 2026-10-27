"""Additional fixed-coordinate diagnostics. Does not alter the original full-frame metric."""
import json
from pathlib import Path
from PIL import Image, ImageChops

root = Path('.private/visual')
regions = {'ringkasan': {'sidebar': (0, 0, 236, 960), 'header': (285, 0, 1559, 75), 'hero_title': (280, 170, 841, 290)}, 'analisis': {'sidebar': (0, 0, 236, 960), 'sensor_controls': (285, 250, 1011, 294), 'chart_heading': (307, 338, 1140, 407)}, 'metode': {'sidebar': (0, 0, 236, 960), 'source_heading': (314, 296, 857, 376), 'source_card': (314, 405, 857, 531)}}
results = {}
for route, names in regions.items():
    ref = Image.open(root/f'figma-{route}.png').convert('RGB')
    actual = Image.open(root/f'actual-{route}.png').convert('RGB')
    results[route] = {}
    for name, box in names.items():
        a, b = ref.crop(box), actual.crop(box)
        difference = ImageChops.difference(a, b)
        pixels = list(difference.get_flattened_data())
        results[route][name] = {'bbox': box, 'different_pixels_over_16_rgb_percent': round(100*sum(max(p) > 16 for p in pixels)/len(pixels), 3), 'mean_absolute_channel_error': round(sum(sum(p) for p in pixels)/(len(pixels)*3), 3), 'purpose': 'diagnostic; not overall acceptance'}
        difference.save(root/f'component-diff-{route}-{name}.png')
(root/'component-comparison.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
