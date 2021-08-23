import json
import logging
import os
import platform
import subprocess
import stat
import threading
import zipfile
import notebook

from urllib.request import urlopen, urlretrieve
from urllib.error import HTTPError
from ._version import __version__

if platform.system() == "Windows":
    try:
        from colorama import init

        init(convert=True)
    except ImportError:
        try:
            import pip

            pip.main(["install", "--user", "colorama"])
            from colorama import init

            init(convert=True)
        except Exception:
            logger = logging.getLogger("ImportError")
            logger.error(
                "Install colorama failed. Install it manually to enjoy colourful log."
            )


logging.basicConfig(
    level=logging.INFO,
    format="\x1b[1m\x1b[33m[%(levelname)s %(asctime)s.%(msecs)03d %(name)s]\x1b[0m: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

_TABNINE_SERVER_URL = "https://update.tabnine.com/bundles"
_TABNINE_EXECUTABLE = "TabNine"


class TabnineDownloader(threading.Thread):
    def __init__(self, download_url, output_dir, tabnine):
        threading.Thread.__init__(self)
        self.download_url = download_url
        self.output_dir = output_dir
        self.logger = logging.getLogger(self.__class__.__name__)
        self.tabnine = tabnine

    def run(self):
        try:
            self.logger.info(
                "Begin to download Tabnine Binary from %s", self.download_url
            )
            if not os.path.isdir(self.output_dir):
                os.makedirs(self.output_dir)
            zip_path, _ = urlretrieve(self.download_url)
            with zipfile.ZipFile(zip_path, "r") as zf:
                for filename in zf.namelist():
                    zf.extract(filename, self.output_dir)
                    target = os.path.join(self.output_dir, filename)
                    add_execute_permission(target)
            self.logger.info("Finish download Tabnine Binary to %s", self.output_dir)
            sem_complete_on(self.tabnine)
        except Exception as e:
            self.logger.error("Download failed, error: %s", e)


def sem_complete_on(tabnine):
    SEM_ON_REQ_DATA = {
        "version": "1.0.7",
        "request": {
            "Autocomplete": {
                "filename": "test.py",
                "before": "tabnine::sem",
                "after": "",
                "region_includes_beginning": True,
                "region_includes_end": True,
                "max_num_results": 10,
            }
        },
    }
    res = tabnine.request(json.dumps(SEM_ON_REQ_DATA))
    try:
        tabnine.logger.info(
            f' {res["results"][0]["new_prefix"]}{res["results"][0]["new_suffix"]}'
        )
    except Exception:
        tabnine.logger.warning(" wrong response of turning on semantic completion")


class Tabnine(object):
    def __init__(self):
        self.name = "tabnine"
        self._proc = None
        self._response = None
        self.logger = logging.getLogger(self.__class__.__name__)
        self._install_dir = os.path.dirname(os.path.realpath(__file__))
        self._binary_dir = os.path.join(self._install_dir, "binaries")
        self.logger.info(" install dir: %s", self._install_dir)
        self.download_if_needed()

    def request(self, data):
        proc = self._get_running_tabnine()
        if proc is None:
            return
        try:
            proc.stdin.write((data + "\n").encode("utf8"))
            proc.stdin.flush()
        except BrokenPipeError:
            self._restart()
            return

        output = proc.stdout.readline().decode("utf8")
        try:
            return json.loads(output)
        except json.JSONDecodeError:
            self.logger.debug("Tabnine output is corrupted: " + output)

    def _restart(self):
        if self._proc is not None:
            self._proc.terminate()
            self._proc = None
        path = get_tabnine_path(self._binary_dir)
        if path is None:
            self.logger.error("no Tabnine binary found")
            return
        self._proc = subprocess.Popen(
            [
                path,
                "--client",
                "jupyter",
                "--log-file-path",
                os.path.join(self._install_dir, "tabnine.log"),
                "--client-metadata",
                "pluginVersion={}".format(__version__),
                "clientVersion={}".format(notebook.__version__),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

    def _get_running_tabnine(self):
        if self._proc is None:
            self._restart()
        if self._proc is not None and self._proc.poll():
            self.logger.error(
                "Tabnine exited with code {}".format(self._proc.returncode)
            )
            self._restart()
        return self._proc

    def download_if_needed(self):
        if os.path.isdir(self._binary_dir):
            tabnine_path = get_tabnine_path(self._binary_dir)
            if tabnine_path is not None:
                add_execute_permission(tabnine_path)
                self.logger.info(
                    "Tabnine binary already exists in %s ignore downloading",
                    tabnine_path,
                )
                sem_complete_on(self)
                return
        self._download()

    def _download(self):
        version = get_tabnine_version()
        distro = get_distribution_name()
        download_url = "{}/{}/{}/{}.zip".format(
            _TABNINE_SERVER_URL, version, distro, _TABNINE_EXECUTABLE
        )
        output_dir = os.path.join(self._binary_dir, version, distro)
        TabnineDownloader(download_url, output_dir, self).start()


def get_tabnine_version():
    version_url = "{}/{}".format(_TABNINE_SERVER_URL, "version")

    try:
        return urlopen(version_url).read().decode("UTF-8").strip()
    except HTTPError:
        return None


arch_translations = {
    "arm64": "aarch64",
    "AMD64": "x86_64",
}


def get_distribution_name():
    sysinfo = platform.uname()
    sys_architecture = sysinfo.machine

    if sys_architecture in arch_translations:
        sys_architecture = arch_translations[sys_architecture]

    if sysinfo.system == "Windows":
        sys_platform = "pc-windows-gnu"

    elif sysinfo.system == "Darwin":
        sys_platform = "apple-darwin"

    elif sysinfo.system == "Linux":
        sys_platform = "unknown-linux-musl"

    elif sysinfo.system == "FreeBSD":
        sys_platform = "unknown-freebsd"

    else:
        raise RuntimeError(
            "Platform was not recognized as any of " "Windows, macOS, Linux, FreeBSD"
        )

    return "{}-{}".format(sys_architecture, sys_platform)


def get_tabnine_path(binary_dir):
    distro = get_distribution_name()
    versions = os.listdir(binary_dir)
    versions.sort(key=parse_semver, reverse=True)
    for version in versions:
        path = os.path.join(
            binary_dir, version, distro, executable_name(_TABNINE_EXECUTABLE)
        )
        if os.path.isfile(path):
            return path


def parse_semver(s):
    try:
        return [int(x) for x in s.split(".")]
    except ValueError:
        return []


def add_execute_permission(path):
    st = os.stat(path)
    new_mode = st.st_mode | stat.S_IEXEC
    if new_mode != st.st_mode:
        os.chmod(path, new_mode)


def executable_name(name):
    if platform.system() == "Windows":
        return name + ".exe"
    else:
        return name
