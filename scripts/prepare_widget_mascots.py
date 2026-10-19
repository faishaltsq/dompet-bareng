"""Prepare opaque white-matted Otter exports without changing their artwork.

Requires Pillow only. Run from any directory::

    python scripts/prepare_widget_mascots.py --contact-sheet PATH.png

Only edge-connected near-white pixels are erased; enclosed white eyes/muzzles
stay opaque. A narrow exterior fringe is unmatted against nearby outline color
so antialiased edges do not carry a white halo onto colored cards. Artwork is
fitted into a transparent 1024 canvas (92% longest side, bottom aligned).

Already-transparent inputs are not unmatted again. Identical PNGs are grouped
by SHA-256, processed sequentially once, then copied to all original filenames.
No images, models, or product dependencies are downloaded.
"""
from __future__ import annotations

import argparse
from array import array
from collections import defaultdict
import hashlib
from io import BytesIO
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def remove_white_background(image: Image.Image, threshold: int = 240) -> Image.Image:
    """Remove exterior near-white and undo white matte in a 3px fringe.

    This is deliberately conservative: isolated white components are artwork,
    not background. RGB unmatting preserves appearance on white to rounding
    accuracy; local dark outline samples estimate coverage on other colors.
    Fully transparent RGB is zeroed. Existing alpha is returned unchanged.
    """
    rgba = image.convert('RGBA')
    if rgba.getchannel('A').getextrema()[0] < 255:
        return rgba
    width, height = rgba.size
    source = rgba.tobytes()
    # Compact byte mask + integer queue, rather than sets of Python tuples.
    eligible = bytearray(width * height)
    for index in range(width * height):
        offset = index * 4
        r, g, b = source[offset:offset + 3]
        eligible[index] = min(r, g, b) >= threshold and max(r, g, b) - min(r, g, b) <= 18
    exterior = bytearray(width * height)
    queue = array('I')

    def enqueue(index: int) -> None:
        if eligible[index] and not exterior[index]:
            exterior[index] = 255
            queue.append(index)

    for x in range(width):
        enqueue(x)
        enqueue((height - 1) * width + x)
    for y in range(height):
        enqueue(y * width)
        enqueue(y * width + width - 1)
    cursor = 0
    while cursor < len(queue):
        index = queue[cursor]
        cursor += 1
        x = index % width
        if x:
            enqueue(index - 1)
        if x + 1 < width:
            enqueue(index + 1)
        if index >= width:
            enqueue(index - width)
        if index + width < width * height:
            enqueue(index + width)
    del queue
    background = Image.frombytes('L', rgba.size, bytes(exterior))
    fringe = background.filter(ImageFilter.MaxFilter(7)).tobytes()
    # Channel-wise local minimum approximates the dark brown outline beneath
    # the export's white-matted fringe. Only the exterior 3px band uses it.
    anchors = rgba.convert('RGB').filter(ImageFilter.MinFilter(7)).tobytes()
    output = bytearray(source)
    for index in range(width * height):
        offset = index * 4
        if exterior[index]:
            output[offset:offset + 4] = b'\0\0\0\0'
        elif fringe[index] and not eligible[index]:
            color = source[offset:offset + 3]
            anchor = anchors[index * 3:index * 3 + 3]
            coverage = min(1.0, max((255 - c) / max(1, 255 - f) for c, f in zip(color, anchor)))
            if 0 < coverage < 1:
                alpha = max(1, round(coverage * 255))
                # Use quantized alpha in inverse compositing, minimizing error.
                for channel in range(3):
                    output[offset + channel] = max(0, min(255, round(255 + (color[channel] - 255) * 255 / alpha)))
                output[offset + 3] = alpha
    return Image.frombytes('RGBA', rgba.size, bytes(output))


def prepare_image(image: Image.Image, canvas_size: int = 1024) -> Image.Image:
    """Crop excess margin, fit 92%, center horizontally and align bottoms."""
    if canvas_size < 16:
        raise ValueError('Canvas must be at least 16 pixels')
    transparent = remove_white_background(image)
    box = transparent.getchannel('A').getbbox()
    if box is None:
        raise ValueError('No mascot artwork remains')
    target = round(canvas_size * 0.92)
    margin = (canvas_size - target) // 2
    width, height = box[2] - box[0], box[3] - box[1]
    if (transparent.size == (canvas_size, canvas_size)
            and max(width, height) == target
            and box[0] == (canvas_size - width) // 2
            and box[3] == canvas_size - margin):
        return transparent
    scale = target / max(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    artwork = transparent.crop(box).resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (canvas_size, canvas_size))
    canvas.alpha_composite(artwork, ((canvas_size - size[0]) // 2, canvas_size - margin - size[1]))
    return canvas


def process_directory(directory: Path) -> dict:
    """Hash all inputs first, then process unique images with bounded memory."""
    groups = defaultdict(list)
    for path in sorted(Path(directory).glob('*.png')):
        with path.open('rb') as stream:
            groups[hashlib.file_digest(stream, 'sha256').hexdigest()].append(path)
    if not groups:
        raise ValueError(f'No PNG files found in {directory}')
    report = {'files': 0, 'unique_images': len(groups), 'groups': []}
    for paths in groups.values():
        with Image.open(paths[0]) as image:
            prepared = prepare_image(image)
        buffer = BytesIO()
        prepared.save(buffer, format='PNG', optimize=True)
        data = buffer.getvalue()
        for path in paths:
            if path.read_bytes() != data:
                path.write_bytes(data)
            report['files'] += 1
        report['groups'].append({'names': [p.name for p in paths], 'sha256': hashlib.sha256(data).hexdigest()})
        prepared.close()
    return report


def create_contact_sheet(directory: Path, destination: Path) -> None:
    """One column per mood over cream/mint/amber/rose plus dark checkerboard proof."""
    moods = ('happy', 'idle', 'warning', 'panic',
             'welcome', 'thinking', 'rich', 'reminder')
    backgrounds = (('cream', '#FFF7E6'), ('mint', '#DCFCE7'), ('amber', '#FEF3C7'), ('rose', '#FFE4E6'), ('checkerboard', None))
    tile, header = 260, 28
    sheet = Image.new('RGB', (tile * len(moods), (tile + header) * len(backgrounds)), '#F1F5F9')
    draw = ImageDraw.Draw(sheet)
    for column, mood in enumerate(moods):
        with Image.open(directory / f'otter-{mood}.png') as image:
            art = image.convert('RGBA').resize((tile, tile), Image.Resampling.LANCZOS)
        for row, (name, color) in enumerate(backgrounds):
            left, top = column * tile, row * (tile + header)
            draw.text((left + 10, top + 8), f'{mood} / {name}', fill='#334155')
            if color:
                draw.rectangle((left, top + header, left + tile - 1, top + header + tile - 1), fill=color)
            else:
                for y in range(0, tile, 20):
                    for x in range(0, tile, 20):
                        fill = '#CBD5E1' if (x // 20 + y // 20) % 2 else '#64748B'
                        draw.rectangle((left + x, top + header + y, left + min(x + 19, tile - 1), top + header + min(y + 19, tile - 1)), fill=fill)
            sheet.paste(art, (left, top + header), art)
        art.close()
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, format='PNG')
    sheet.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'mascot')
    parser.add_argument('--contact-sheet', type=Path)
    args = parser.parse_args()
    report = process_directory(args.directory)
    if args.contact_sheet:
        create_contact_sheet(args.directory, args.contact_sheet)
        report['contact_sheet'] = str(args.contact_sheet.resolve())
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
