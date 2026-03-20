import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/ws/stt"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            while True:
                msg = await websocket.recv()
                print(f"Received: {msg}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
