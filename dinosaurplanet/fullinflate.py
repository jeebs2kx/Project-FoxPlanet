import zlib
import os
import struct

filename = "BLOCKS"
output_dir = "uncompressed_blocks"
if not os.path.exists(output_dir): os.makedirs(output_dir)

with open(filename + ".tab", "rb") as f:
    tab_data = f.read()
with open(filename + ".bin", "rb") as f:
    bin_data = f.read()

for i in range(0, len(tab_data), 4):
    offset = struct.unpack(">I", tab_data[i:i+4])[0]
    if offset == 0xFFFFFFFF: continue

    next_offset = len(bin_data)
    for j in range(i + 4, len(tab_data), 4):
        candidate = struct.unpack(">I", tab_data[j:j+4])[0]
        if candidate != 0xFFFFFFFF and candidate != 0:
            next_offset = candidate
            break
    
    try:
        # Match your working Python logic: skip 9 bytes and inflate raw
        compressed_chunk = bin_data[offset + 9 : next_offset]
        uncompressed = zlib.decompress(compressed_chunk, -15)
        
        # Save as block index (e.g. 0.bin, 1.bin)
        with open(f"{output_dir}/{i//4}.bin", "wb") as out:
            out.write(uncompressed)
    except:
        pass 

print("Done! Copy the 'uncompressed_blocks' folder to your web data directory.")
