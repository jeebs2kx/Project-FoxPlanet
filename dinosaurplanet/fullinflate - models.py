import zlib
import os
import struct

def extract_dp_asset(filename, offset_skip, output_dir):
    if not os.path.exists(output_dir): os.makedirs(output_dir)
    with open(filename + ".tab", "rb") as f: tab_data = f.read()
    with open(filename + ".bin", "rb") as f: bin_data = f.read()

    for i in range(0, len(tab_data), 4):
        offset = struct.unpack(">I", tab_data[i:i+4])[0]
        if offset == 0xFFFFFFFF or offset == 0: continue

        next_offset = len(bin_data)
        for j in range(i + 4, len(tab_data), 4):
            candidate = struct.unpack(">I", tab_data[j:j+4])[0]
            if candidate != 0xFFFFFFFF and candidate != 0:
                next_offset = candidate
                break
        
        try:
            compressed_chunk = bin_data[offset + offset_skip : next_offset]
            uncompressed = zlib.decompress(compressed_chunk, -15)
            with open(f"{output_dir}/{i//4}.bin", "wb") as out: out.write(uncompressed)
        except: pass 

# Extract both using the correct skips (9 for BLOCKS, 13 for MODELS)

extract_dp_asset("MODELS", 13, "uncompressed_models")

print("Done! Copy 'uncompressed_blocks' and 'uncompressed_models' to your web data directory.")
