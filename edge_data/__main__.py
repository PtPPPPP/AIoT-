"""Run with python -m edge_data; defaults are loopback-only and no acquisition."""
import argparse
import os
import sqlite3
from contextlib import closing
from pathlib import Path

from .common import Config, DATASETS
from .fixtures import load_fixture
from .server import Application, make_server
from .store import Store


class ProcessLock:
    """An OS-released lock prevents competing collectors for the same data directory."""
    def __init__(self, root):
        Path(root).mkdir(parents=True, exist_ok=True)
        self.file = open(Path(root) / '.service.lock', 'a+b')
        if self.file.tell() == 0:
            self.file.write(b'0'); self.file.flush()
        self.file.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            self.file.close()
            raise ValueError('该数据目录已有服务占用，拒绝启动第二个采集者') from error

    def close(self):
        self.file.close()


def restore(source, root, kind):
    target = Path(root) / (kind + '.sqlite3')
    if target.exists():
        raise ValueError('恢复只能写入新的数据目录／不存在的目标数据库，禁止覆盖')
    source = Path(source).resolve()
    if not source.is_file():
        raise ValueError('备份文件不存在')
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as incoming:
        if incoming.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or incoming.execute('PRAGMA user_version').fetchone()[0] != 1:
            raise ValueError('备份格式、版本或完整性无效')
        partition = incoming.execute("SELECT value FROM metadata WHERE key='dataset'").fetchone()
        if not partition or partition[0] != kind:
            raise ValueError('备份数据库分区身份不匹配，拒绝跨分区恢复')
        source_kinds = [row[0] for row in incoming.execute("SELECT json_extract(payload,'$.sourceKind') FROM samples GROUP BY 1")]
        event_kinds = [row[0] for row in incoming.execute("SELECT json_extract(payload,'$.sourceKind') FROM events GROUP BY 1")]
        if any(origin != kind for origin in source_kinds + event_kinds):
            raise ValueError('备份来源与目标分区不一致，拒绝混入其他来源')
        target.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(target)) as destination:
            incoming.backup(destination)
    return target


def main():
    parser = argparse.ArgumentParser(description='AIoT 只读采集与数据分析服务（无设备控制接口）')
    parser.add_argument('--config')
    parser.add_argument('--data-dir')
    parser.add_argument('--port', type=int)
    parser.add_argument('--load-test-fixture', action='store_true', help='仅写入 simulation 分区的确定性测试样例')
    parser.add_argument('--backup', metavar='NEW_FILE')
    parser.add_argument('--restore', metavar='BACKUP_FILE')
    parser.add_argument('--dataset', choices=DATASETS, default='simulation')
    args = parser.parse_args()
    config = Config.load(args.config)
    if args.data_dir:
        config.data_dir = args.data_dir
    if args.port:
        config.port = args.port
    config.validate()
    if args.restore:
        with_lock = ProcessLock(config.data_dir)
        try:
            print('Restored to', restore(args.restore, config.data_dir, args.dataset))
        finally:
            with_lock.close()
        return
    if args.backup:
        print('Backup created:', Store(config.data_dir).backup(args.dataset, args.backup))
        return
    lock = ProcessLock(config.data_dir)
    app = None
    try:
        app = Application(config)
        if args.load_test_fixture:
            load_fixture(app.store)
        server = make_server(app)
        app.collector.start()
        print('AIoT data service http://127.0.0.1:' + str(config.port) + ' ; collector=' + config.collector_mode + ' ; NO DEVICE CONTROL', flush=True)
        try:
            server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
    finally:
        if app:
            app.collector.stop()
        lock.close()


if __name__ == '__main__':
    main()
