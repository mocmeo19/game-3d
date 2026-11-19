"""Generate Vietnamese MP3 previews. Install: python3 -m pip install edge-tts.
Run: python3 scripts/generate-voices.py (requires internet only during generation).
"""
import asyncio
import json
import re
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/audio/voices'

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = (ROOT / 'src/constants/voices.ts').read_text()
    profiles = [('brave_f', '-8%', '-8Hz'), ('wind_f', '+5%', '+20Hz'),
                ('moon_f', '-15%', '-20Hz'), ('flame_f', '+15%', '+10Hz'),
                ('rock_m', '-15%', '-30Hz'), ('blade_m', '+5%', '-15Hz'),
                ('spring_m', '-5%', '+5Hz')]
    manifest = []
    for voice_id, rate, pitch in profiles:
        block = source.split("id: '" + voice_id + "'")[1].split('\n  }')[0]
        line = re.search(r"line: '([^']+)'", block).group(1)
        speaker = 'vi-VN-HoaiMyNeural' if voice_id.endswith('_f') else 'vi-VN-NamMinhNeural'
        for kind, text in [('line', line), ('normal', 'Hây!'), ('special', 'Hây! Đỡ chiêu này!')]:
            path = OUT / f'{voice_id}-{kind}.mp3'
            if not path.exists() or path.stat().st_size < 1000:
                temp = path.with_suffix('.tmp.mp3')
                await edge_tts.Communicate(text, speaker, rate=rate, pitch=pitch).save(str(temp))
                if temp.stat().st_size < 1000:
                    raise RuntimeError(f'Empty audio: {temp}')
                temp.replace(path)
            manifest.append(dict(file=path.name, text=text, speaker=speaker, rate=rate, pitch=pitch))
            print(path.name, flush=True)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    asyncio.run(main())
