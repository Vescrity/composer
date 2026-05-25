# JSON-RPC MCP Sync Engine client for interfacing with local Ardour DAW instances
import urllib.request
import json
import time

def call_mcp(mcp_url, method, params):
    """
    Initiates standard JSON-RPC request to the Model Context Protocol endpoint.
    """
    payload = {
        "jsonrpc": "2.0", 
        "id": int(time.time() * 1000), 
        "method": "tools/call", 
        "params": {
            "name": method, 
            "arguments": params
        }
    }
    req = urllib.request.Request(
        mcp_url, 
        data=json.dumps(payload).encode('utf-8'), 
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode('utf-8')).get("result", {})
    except Exception as e:
        print("[Error] Connection issue with Ardour MCP Server:", e)
        return None
