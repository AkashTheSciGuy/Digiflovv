"""Private JSON-lines worker with a persistent, certificate-verified HTTP session."""
import contextlib
import io
import json
import sys


class RainMaker:
    def __init__(self):
        import requests
        from rmaker_lib.session import Session
        from rmaker_lib import configmanager
        self.config = Session(profile_override="global").config
        self.http = requests.Session()
        self.http.verify = configmanager.CERT_FILE

    def request(self, method, path, **kwargs):
        token = self.config.get_access_token()
        if not token:
            raise ValueError("Authentication unavailable")
        response = self.http.request(
            method, self.config.get_host() + path,
            headers={"Authorization": token, "Content-Type": "application/json"},
            timeout=(3, 5), allow_redirects=False, **kwargs
        )
        if response.status_code != 200:
            raise ValueError("Cloud request failed")
        return response.json()

    def read(self):
        nodes = []
        seen = set()
        start = None
        for _ in range(100):
            query = {"node_details": "true"}
            if start:
                query["start_id"] = start
            page = self.request("GET", "user/nodes", params=query)
            if not isinstance(page, dict) or not isinstance(page.get("node_details"), list):
                raise ValueError("Invalid cloud response")
            nodes.extend(page["node_details"])
            start = page.get("next_id")
            if not start:
                return {"node_details": nodes}
            if not isinstance(start, str) or start in seen:
                raise ValueError("Invalid pagination")
            seen.add(start)
        raise ValueError("Pagination limit exceeded")

    def write(self, request):
        result = self.request("PUT", "user/nodes/params", json=[{
            "node_id": request["nodeId"], "payload": request["payload"]
        }])
        if isinstance(result, list):
            accepted = len(result) == 1 and result[0].get("node_id") == request["nodeId"] and result[0].get("status") == "success"
        else:
            accepted = isinstance(result, dict) and result.get("status") == "success"
        if not accepted:
            raise ValueError("Write not confirmed")
        return {"accepted": True}


def main():
    cloud = None
    for line in sys.stdin:
        request = {}
        try:
            if len(line) > 8192:
                raise ValueError("Request too large")
            request = json.loads(line)
            # Never let upstream login/refresh diagnostics enter the IPC channel.
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                if cloud is None:
                    cloud = RainMaker()
                if request["op"] == "read":
                    data = cloud.read()
                elif request["op"] == "write":
                    data = cloud.write(request["data"])
                else:
                    raise ValueError("Unknown operation")
            result = {"id": request["id"], "ok": True, "data": data}
        except Exception:
            result = {"id": request.get("id"), "ok": False}
        print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
