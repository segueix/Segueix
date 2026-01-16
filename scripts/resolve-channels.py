#!/usr/bin/env python3

"""
Script per resoldre handles de YouTube (@NomCanal) a IDs de canal

Ús: python3 scripts/resolve-channels.py <API_KEY>
"""

import sys
import json
import urllib.request
import csv
import io
import os
from datetime import datetime

# URL del CSV de Google Sheets
CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv'

def fetch_url(url):
    """Descarregar contingut d'una URL"""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return response.read().decode('utf-8')

def parse_csv(csv_text):
    """Parsejar CSV a llista de canals"""
    channels = []
    reader = csv.reader(io.StringIO(csv_text))

    # Saltar capçalera
    next(reader, None)

    for row in reader:
        if len(row) >= 3:
            handle, name, categories = row[0], row[1], row[2]
            channels.append({
                'handle': handle.strip(),
                'name': name.strip(),
                'categories': [c.strip().lower() for c in categories.split(';')]
            })

    return channels

def resolve_handle(handle, api_key):
    """Resoldre handle a ID de canal"""
    clean_handle = handle[1:] if handle.startswith('@') else handle
    url = f'https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle={clean_handle}&key={api_key}'

    try:
        response = fetch_url(url)
        data = json.loads(response)

        if data.get('items') and len(data['items']) > 0:
            item = data['items'][0]
            return {
                'id': item['id'],
                'thumbnail': item['snippet']['thumbnails']['default']['url'] if 'thumbnails' in item['snippet'] else None
            }
    except Exception as e:
        print(f'Error: {e}')

    return None

def main():
    if len(sys.argv) < 2:
        print('Error: Necessites proporcionar una API key de YouTube')
        print('Ús: python3 scripts/resolve-channels.py <API_KEY>')
        sys.exit(1)

    api_key = sys.argv[1]

    print('Descarregant CSV de Google Sheets...')
    csv_text = fetch_url(CSV_URL)
    channels = parse_csv(csv_text)

    print(f'Trobats {len(channels)} canals al CSV')
    print('Resolent handles a IDs...\n')

    resolved_channels = []
    errors = []

    for channel in channels:
        print(f"Resolent {channel['handle']}... ", end='', flush=True)

        result = resolve_handle(channel['handle'], api_key)

        if result:
            resolved_channels.append({
                'id': result['id'],
                'handle': channel['handle'],
                'name': channel['name'],
                'categories': channel['categories'],
                'thumbnail': result['thumbnail']
            })
            print(f"OK ({result['id']})")
        else:
            errors.append(channel['handle'])
            print('ERROR')

    # Crear directori data si no existeix
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, '..', 'data')
    os.makedirs(data_dir, exist_ok=True)

    # Guardar JSON
    output_path = os.path.join(data_dir, 'channels.json')
    output = {
        'lastUpdated': datetime.now().isoformat(),
        'source': CSV_URL,
        'totalChannels': len(resolved_channels),
        'channels': resolved_channels
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print('\n========================================')
    print(f'Canals resolts: {len(resolved_channels)}/{len(channels)}')
    if errors:
        print(f'Errors: {", ".join(errors)}')
    print(f'Guardat a: {output_path}')
    print('========================================')

if __name__ == '__main__':
    main()
