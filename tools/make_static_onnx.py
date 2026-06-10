#!/usr/bin/env python3
"""
make_static_onnx.py — Replace dynamic ONNX shape annotations with static values.

NNStreamer reads dynamic dims (dim_param strings like 'batch', 'samples') as
their default value of 1, causing incorrect tensor buffer allocation.  Baking
in the real values lets NNStreamer allocate the right buffer without needing
explicit input=/output= properties on tensor_filter.

Usage:
    python3 make_static_onnx.py <input.onnx> <output.onnx>

For en_v5.onnx (Silero STT, English):
    input  'input'  [batch=1, samples=48000]
    output 'output' [batch=1, frames=38, vocab=999]

Tested with onnx >= 1.12.
"""

import sys
import onnx


def make_static(src, dst):
    model = onnx.load(src)

    # Input tensor: ['batch', 'samples']  →  [1, 48000]
    for inp in model.graph.input:
        if inp.name == "input":
            s = inp.type.tensor_type.shape
            s.dim[0].dim_value = 1;     s.dim[0].ClearField("dim_param")
            s.dim[1].dim_value = 48000; s.dim[1].ClearField("dim_param")

    # Output tensor: ['batch', 'frames', 999]  →  [1, 38, 999]
    for out in model.graph.output:
        if out.name == "output":
            s = out.type.tensor_type.shape
            s.dim[0].dim_value = 1;  s.dim[0].ClearField("dim_param")
            s.dim[1].dim_value = 38; s.dim[1].ClearField("dim_param")
            # dim[2] is already static (999)

    onnx.save(model, dst)
    print(f"Saved: {dst}")
    for t in list(model.graph.input) + list(model.graph.output):
        dims = [d.dim_value if d.dim_value else d.dim_param
                for d in t.type.tensor_type.shape.dim]
        print(f"  {t.name}: {dims}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.onnx> <output.onnx>", file=sys.stderr)
        sys.exit(1)
    make_static(sys.argv[1], sys.argv[2])
