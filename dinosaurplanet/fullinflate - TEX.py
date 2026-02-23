import zlib
import os
import struct

def extract_tex1(filename="TEX1", output_dir="uncompressed_textures"):
    os.makedirs(output_dir, exist_ok=True)
    try:
        with open(filename + ".tab", "rb") as f:
            tab_data = f.read()
        with open(filename + ".bin", "rb") as f:
            bin_data = f.read()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return

    # Parse 32-bit Tab Entries (8-bit numFrames, 24-bit offset)
    entries = []
    for i in range(0, len(tab_data), 4):
        val = struct.unpack(">I", tab_data[i:i+4])[0]
        if val == 0xFFFFFFFF: break
        numFrames = (val >> 24) & 0xFF
        offset = val & 0x00FFFFFF
        entries.append((numFrames, offset))

    ok, fail = 0, 0

    for i in range(len(entries) - 1):
        numFrames, start = entries[i]
        _, end = entries[i+1]
        
        if start >= len(bin_data) or end > len(bin_data) or start >= end:
            continue

        # If animated, skip the frame header array (0x8 bytes per frame + 1 extra header)
        if numFrames > 1:
            start += 8 * (numFrames + 1)
            
        chunk = bin_data[start:end]
        if len(chunk) < 5: continue

        comp_type = chunk[0]
        zlib_data = chunk[5:]

        try:
            # -15 forces raw DEFLATE decompression
            data = zlib.decompress(zlib_data, -15)
            with open(os.path.join(output_dir, f"tex_{i:03d}.bin"), "wb") as out:
                out.write(data)
            ok += 1
        except zlib.error:
            if len(zlib_data) > 0:
                with open(os.path.join(output_dir, f"tex_{i:03d}_raw.bin"), "wb") as out:
                    out.write(zlib_data)
            fail += 1

    print(f"Done. Extracted {ok} files, failed {fail}.")

extract_tex1()
