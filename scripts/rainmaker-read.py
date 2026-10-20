"""Local read-only adapter. Session credentials never leave this process."""
import contextlib
import io
import json
import sys


def main():
    try:
        # The upstream library may print login diagnostics. Never send those to HTTP.
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            from rmaker_lib.session import Session
            result = Session(profile_override="global").get_node_details()
        print(json.dumps(result))
    except Exception:
        print("RainMaker read unavailable", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
