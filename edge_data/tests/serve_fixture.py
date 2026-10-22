"""Ephemeral loopback fixture server for browser tests. No upstream network."""
import tempfile
from pathlib import Path

from edge_data.common import Config
from edge_data.fixtures import load_fixture
from edge_data.server import Application, make_server


if __name__ == '__main__':
    Path('var/test-sessions').mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='isolated-', dir='var/test-sessions') as root:
        app = Application(Config(data_dir=root, port=8091, allowed_origins=['http://127.0.0.1:5175']))
        load_fixture(app.store)
        server = make_server(app)
        print('ISOLATED SOFTWARE TEST DATA http://127.0.0.1:8091 ; NO UPSTREAM OR DEVICE CONTROL', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
