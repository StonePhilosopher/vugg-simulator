#!/usr/bin/env python3
"""
Crystal Photo → ASCII Art Converter for Vugg Simulator

Designed for crystal photos shot on BLACK background.
Inverted mapping: bright areas (crystal faces, reflections) → dense characters.
Dark areas (background) → empty space.

Output: monochrome ASCII art where the text IS the light.
ANSI color can be applied as a presentation layer on top.

Usage:
    python3 photo-to-ascii.py <image_path> [options]

Options:
    --width N         Output width in characters (default: 60)
    --charset NAME    Character set: block, dense, classic, dots (default: block)
    --invert          Invert brightness (for light-on-dark photos, default ON)
    --no-invert       Don't invert (for dark-on-light photos)
    --color HEXRGB    ANSI color for the text (e.g., FFD700 for gold)
    --output PATH     Save to file instead of stdout
    --threshold N     Minimum brightness to render (0-255, default: 20)
    --preview         Show a compact preview at 40 columns
    --html            Output as HTML with color
"""

import argparse
import sys
from PIL import Image

# Character sets ordered from darkest (least dense) to brightest (most dense)
CHARSETS = {
    # Block elements — cleanest for terminal display
    'block': ' ·░▒▓█',
    # Dense ASCII — more gradation, works everywhere
    'dense': ' .:-=+*#%@█',
    # Classic ASCII art set
    'classic': ' .,:;i1tfLCG08@',
    # Dots only — minimalist
    'dots': ' ·•●⬤',
    # Light — for subtle rendering
    'light': ' ·:+*',
}

def load_and_resize(image_path, target_width):
    """Load image and resize to target width, preserving aspect ratio.
    Terminal characters are ~2:1 tall:wide, so we halve the height."""
    img = Image.open(image_path).convert('L')  # grayscale
    w, h = img.size
    aspect = h / w
    # Terminal chars are roughly twice as tall as wide
    target_height = int(target_width * aspect * 0.45)
    img = img.resize((target_width, target_height), Image.LANCZOS)
    return img


def image_to_ascii(img, charset='block', threshold=20, invert=True):
    """Convert grayscale image to ASCII string."""
    chars = CHARSETS.get(charset, CHARSETS['block'])
    width, height = img.size
    pixels = list(img.getdata())
    
    lines = []
    for y in range(height):
        line = []
        for x in range(width):
            brightness = pixels[y * width + x]
            
            if invert:
                # For black-background photos: bright pixels → dense chars
                if brightness < threshold:
                    line.append(' ')
                else:
                    # Map brightness (threshold-255) to character index
                    idx = int((brightness - threshold) / (255 - threshold) * (len(chars) - 1))
                    idx = min(idx, len(chars) - 1)
                    line.append(chars[idx])
            else:
                # Normal: dark pixels → dense chars
                if brightness > (255 - threshold):
                    line.append(' ')
                else:
                    idx = int((255 - brightness) / 255 * (len(chars) - 1))
                    idx = min(idx, len(chars) - 1)
                    line.append(chars[idx])
        
        # Strip trailing spaces
        lines.append(''.join(line).rstrip())
    
    # Strip leading/trailing empty lines
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    
    return '\n'.join(lines)


def colorize_ansi(ascii_art, hex_color):
    """Wrap ASCII art in ANSI 24-bit color codes."""
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    color_code = f'\033[38;2;{r};{g};{b}m'
    reset = '\033[0m'
    
    lines = ascii_art.split('\n')
    colored = []
    for line in lines:
        if line.strip():
            colored.append(f'{color_code}{line}{reset}')
        else:
            colored.append(line)
    return '\n'.join(colored)


def to_html(ascii_art, hex_color=None, bg_color='000000'):
    """Convert ASCII art to HTML with optional color."""
    fg = f'#{hex_color}' if hex_color else '#FFFFFF'
    import html
    escaped = html.escape(ascii_art)
    return f'''<!DOCTYPE html>
<html>
<head><style>
body {{ background: #{bg_color}; display: flex; justify-content: center; padding: 2em; }}
pre {{ 
    color: {fg}; 
    font-family: 'Courier New', monospace; 
    font-size: 10px; 
    line-height: 1.0;
    letter-spacing: 1px;
}}
</style></head>
<body><pre>{escaped}</pre></body>
</html>'''


# Mineral color map — ANSI hex colors for each species
# These map to typical specimen colors under white light
MINERAL_COLORS = {
    'quartz':       'E8E8E8',  # near-white, clean
    'calcite':      'FFD699',  # warm amber (Mn-activated)
    'fluorite':     'B088DD',  # purple (common)
    'pyrite':       'D4AF37',  # brassy gold
    'chalcopyrite': 'CDA434',  # golden, slightly greener than pyrite
    'galena':       'A8A8B0',  # lead-gray, metallic
    'hematite':     '8B1A1A',  # deep red-black
    'malachite':    '2E8B57',  # banded green
    'sphalerite':   'AA6C39',  # resinous brown
    'goethite':     '8B6914',  # earthy yellow-brown
    'wulfenite':    'FF8C00',  # orange tabular
    'adamite':      '98FB98',  # pale green
    'molybdenite':  '708090',  # steel-gray
}


def get_mineral_color(mineral_name):
    """Look up ANSI color for a mineral species."""
    return MINERAL_COLORS.get(mineral_name.lower(), 'FFFFFF')


def main():
    parser = argparse.ArgumentParser(
        description='Convert crystal photos to ASCII art for Vugg Simulator')
    parser.add_argument('image', help='Path to crystal photo')
    parser.add_argument('--width', type=int, default=60,
                       help='Output width in characters (default: 60)')
    parser.add_argument('--charset', choices=CHARSETS.keys(), default='block',
                       help='Character set (default: block)')
    parser.add_argument('--invert', action='store_true', default=True,
                       help='Bright areas → dense chars (default for black bg)')
    parser.add_argument('--no-invert', action='store_true',
                       help='Dark areas → dense chars')
    parser.add_argument('--color', type=str, default=None,
                       help='ANSI hex color (e.g., FFD700)')
    parser.add_argument('--mineral', type=str, default=None,
                       help='Mineral name for auto-color lookup')
    parser.add_argument('--threshold', type=int, default=20,
                       help='Min brightness to render, 0-255 (default: 20)')
    parser.add_argument('--output', type=str, default=None,
                       help='Save to file')
    parser.add_argument('--html', action='store_true',
                       help='Output as HTML')
    parser.add_argument('--preview', action='store_true',
                       help='Also show 40-column preview')
    
    args = parser.parse_args()
    
    if args.no_invert:
        args.invert = False
    
    # Resolve color
    color = args.color
    if not color and args.mineral:
        color = get_mineral_color(args.mineral)
    
    # Convert
    img = load_and_resize(args.image, args.width)
    ascii_art = image_to_ascii(img, args.charset, args.threshold, args.invert)
    
    # Output
    if args.html:
        result = to_html(ascii_art, color)
        if args.output:
            with open(args.output, 'w') as f:
                f.write(result)
            print(f'HTML saved to {args.output}')
        else:
            print(result)
    else:
        if color:
            result = colorize_ansi(ascii_art, color)
        else:
            result = ascii_art
        
        if args.output:
            # Save without ANSI codes
            with open(args.output, 'w') as f:
                f.write(ascii_art)
            print(f'Saved to {args.output}')
        else:
            print(result)
    
    # Preview
    if args.preview:
        print('\n--- Preview (40 col) ---')
        img_sm = load_and_resize(args.image, 40)
        preview = image_to_ascii(img_sm, args.charset, args.threshold, args.invert)
        if color:
            print(colorize_ansi(preview, color))
        else:
            print(preview)
    
    # Stats
    non_space = sum(1 for c in ascii_art if c not in ' \n')
    total = sum(1 for c in ascii_art if c != '\n')
    density = non_space / total * 100 if total > 0 else 0
    print(f'\n[{args.width}×{img.size[1]} chars, {density:.0f}% density, '
          f'charset={args.charset}, threshold={args.threshold}]', file=sys.stderr)


if __name__ == '__main__':
    main()
