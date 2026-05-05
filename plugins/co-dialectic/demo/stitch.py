import imageio.v3 as iio
import numpy as np
from PIL import Image
import os

frames_dir = os.path.dirname(os.path.abspath(__file__))
output = os.path.join(frames_dir, "codi-demo-v4.6.1.mp4")

hook_files = sorted([
    os.path.join(frames_dir, f)
    for f in os.listdir(frames_dir)
    if f.startswith("hook-") and f.endswith(".png")
])

demo_files = sorted([
    os.path.join(frames_dir, f)
    for f in os.listdir(frames_dir)
    if f.startswith("frame-") and f.endswith(".png")
])

all_files = hook_files + demo_files

print(f"Hook slides : {[os.path.basename(f) for f in hook_files]}")
print(f"Demo frames : {[os.path.basename(f) for f in demo_files]}")
print(f"Total       : {len(all_files)} slides")

# hook durations: 3s, 3s, 4s (punchy → punchy → reveal)
# demo durations: title=3s, features=4s each, last=5s
hook_durations = [3, 3, 4][:len(hook_files)]
demo_durations = ([3] + [4] * (len(demo_files) - 2) + [5]) if len(demo_files) >= 2 else [4] * len(demo_files)
all_durations = hook_durations + demo_durations

frames_expanded = []
for path, dur in zip(all_files, all_durations):
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    frames_expanded.extend([arr] * (dur * 24))

total_s = len(frames_expanded) / 24
print(f"Total runtime: {len(frames_expanded)} frames at 24fps = {total_s:.1f}s")

iio.imwrite(
    output,
    frames_expanded,
    fps=24,
    codec="libx264",
    quality=8,
    output_params=["-pix_fmt", "yuv420p"],
)

print(f"Written : {output}")
print(f"Size    : {os.path.getsize(output) / 1024:.0f} KB")
