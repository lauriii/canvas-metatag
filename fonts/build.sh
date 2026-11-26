#!/usr/bin/env bash
# Rebuilds the fonts the share cards are drawn with, and their coverage files.
#
# Downloads each family from its upstream release, checks the archive against
# the checksum below, subsets or instances it, and writes one coverage file per
# font: the code point ranges it draws, as JSON, so that nothing parses a font
# at runtime (ShareText::covers()). FontsTest::testCoverageIsCurrent() reads
# the fonts again and compares.
#
# Needs curl, unzip, shasum and Python 3 with fonttools 4.60 or later:
#   python3 -m venv /tmp/fonts-venv && /tmp/fonts-venv/bin/pip install fonttools
#   EMOJI_TTF=/path/to/NotoEmoji[wght].ttf PYTHON=/tmp/fonts-venv/bin/python fonts/build.sh
#
# Every family is SIL Open Font License 1.1 without a reserved font name, so
# subsets keep their names. Each family's licence, with its own copyright
# notice, sits beside its fonts as <Family>-OFL.txt. Those files are kept
# verbatim: the licence requires each notice to stay with its font, so they are
# the one place in the module where a copyright holder's company name appears,
# and a publishing-hygiene sweep must leave them alone.
# cspell:ignore cmap fonttools instancer notdef pathlib unicodes venv wght
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
python=${PYTHON:-python3}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fetch() {
  curl -fsSL -o "$work/$2" "$1"
  echo "$3  $work/$2" | shasum -a 256 -c - >/dev/null
}

fetch https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip \
  inter.zip 9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e
fetch https://github.com/notofonts/arabic/releases/download/NotoSansArabic-v2.013/NotoSansArabic-v2.013.zip \
  arabic.zip 1301aceaea84c501cf2e6dcfb3182e2328c8eae5725817fcb239672bda7154f1
fetch https://github.com/notofonts/hebrew/releases/download/NotoSansHebrew-v3.001/NotoSansHebrew-v3.001.zip \
  hebrew.zip df0a71814b4e63644cf40fcc4529111b61266b7a2dafbe95068b29a7520cc3cb
# The monochrome variable Noto Emoji font, NotoEmoji[wght].ttf as the Noto
# project publishes it in its font library, given by path: EMOJI_TTF.
# Its licence is the committed NotoEmoji-OFL.txt.
cp "${EMOJI_TTF:?Set EMOJI_TTF to the downloaded NotoEmoji[wght].ttf}" "$work/emoji.ttf"
echo "de6c18832938afc99caf132b39d6a30a19bac7f2e812e28db2535b4608d27551  $work/emoji.ttf" | shasum -a 256 -c - >/dev/null

for archive in inter arabic hebrew; do
  unzip -q "$work/$archive.zip" -d "$work/$archive"
done

# Latin, Greek and Cyrillic with their punctuation, marks and symbols. Layout
# tables go: GD draws glyph by glyph and reads neither. Hinting stays.
latin='U+0000-024F,U+0250-036F,U+0370-03FF,U+0400-052F,U+1C80-1C8F,U+1D00-1DBF,U+1E00-1FFF,U+2000-2BFF,U+2C60-2C7F,U+2DE0-2DFF,U+A640-A69F,U+A720-A7FF,U+AB30-AB6F,U+FB00-FB06'
for face in InterDisplay-SemiBold Inter-SemiBold Inter-Regular; do
  "$python" -m fontTools.subset "$work/inter/extras/ttf/$face.ttf" \
    --unicodes="$latin" --layout-features= --no-layout-closure \
    --name-IDs='*' --name-languages='*' --notdef-outline \
    --output-file="$here/$face.ttf"
done
cp "$work/inter/LICENSE.txt" "$here/Inter-OFL.txt"

# The full builds carry the presentation forms GD needs (it does no shaping).
cp "$work/arabic/NotoSansArabic/full/ttf/NotoSansArabic-SemiBold.ttf" "$here/"
cp "$work/arabic/OFL.txt" "$here/NotoSansArabic-OFL.txt"
cp "$work/hebrew/NotoSansHebrew/full/ttf/NotoSansHebrew-SemiBold.ttf" "$here/"
cp "$work/hebrew/OFL.txt" "$here/NotoSansHebrew-OFL.txt"

# Symbols in the basic plane at the title's weight: GD reads UTF-8 only up to
# three bytes, so nothing above U+FFFF can be drawn anyway.
"$python" -m fontTools.varLib.instancer "$work/emoji.ttf" wght=600 \
  --output="$work/emoji-600.ttf" --quiet
"$python" -m fontTools.subset "$work/emoji-600.ttf" \
  --unicodes='U+2000-FFFF' --layout-features= --no-layout-closure \
  --name-IDs='*' --notdef-outline \
  --output-file="$here/NotoEmoji-SemiBold-BMP.ttf"

# One coverage file per font: sorted, merged [first, last] code point ranges.
"$python" -I - "$here" <<'PY'
import json, pathlib, sys
from fontTools.ttLib import TTFont

for font in sorted(pathlib.Path(sys.argv[1]).glob('*.ttf')):
    ranges = []
    for cp in sorted(TTFont(font).getBestCmap()):
        if ranges and ranges[-1][1] == cp - 1:
            ranges[-1][1] = cp
        else:
            ranges.append([cp, cp])
    font.with_suffix('.json').write_text(json.dumps(ranges, separators=(',', ':')) + '\n')
PY
