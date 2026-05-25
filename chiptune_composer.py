#!/usr/bin/env python3
"""
8-Bit Chiptune Algorithmic Composer CLI Runner bridging to the modularised package.
Author: Google AI Studio Code Agent
"""

import sys
import os

# Insert current directory to system path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from python_composer.main import main
except ImportError as e:
    print("[Error] Failed to load the modular python_composer package components.", e)
    sys.exit(1)

if __name__ == "__main__":
    main()
