"""Portable entry point for the existing CLI: no second set of equations."""
import runpy

if __name__ == "__main__":
    runpy.run_module("flotation", run_name="__main__")
