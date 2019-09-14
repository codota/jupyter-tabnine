import json
import logging
import os
import platform
import subprocess
from urllib.request import urlopen
from urllib.error import HTTPError


logging.basicConfig(level=logging.INFO)

_TABNINE_UPDATE_VERSION_URL = "https://update.tabnine.com/version"
_TABNINE_DOWNLOAD_URL_FORMAT = "https://update.tabnine.com/{}"
_SYSTEM_MAPPING = {
    "Darwin": "apple-darwin",
    "Linux": "unknown-linux-gnu",
    "Windows": "pc-windows-gnu",
}


class TabNine(object):
    """
    TabNine python wrapper
    """

    def __init__(self):
        self.name = "tabnine"
        self._proc = None
        self._response = None
        self.logger = logging.getLogger(__name__)
        self._install_dir = os.path.dirname(os.path.realpath(__file__))
        self.logger.info(" install dir: %s", self._install_dir)
        self._download()

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
        binary_dir = os.path.join(self._install_dir, "binaries")
        path = get_tabnine_path(binary_dir)
        if path is None:
            self.logger.error("no TabNine binary found")
            return
        self._proc = subprocess.Popen(
            [
                path,
                "--client",
                "sublime",
                "--log-file-path",
                os.path.join(self._install_dir, "tabnine.log"),
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
                "TabNine exited with code {}".format(self._proc.returncode)
            )
            self._restart()
        return self._proc

    def _download(self):
        binary_dir = os.path.join(self._install_dir, "binaries")
        if not os.path.isdir(binary_dir):
            os.makedirs(binary_dir)
        if os.path.isdir(binary_dir) and get_tabnine_path(binary_dir):
            os.chmod(get_tabnine_path(binary_dir), 0o777) # to make sure the bianry is executable
            self.logger.info("Binary already exists, skip download")
            return
        tabnine_sub_path = get_tabnine_sub_path()
        try:
            binary_path = os.path.join(binary_dir, tabnine_sub_path)
            binary_dir = os.path.dirname(binary_path)
            download_url = _TABNINE_DOWNLOAD_URL_FORMAT.format(tabnine_sub_path)
            self.logger.info("binary path: %s", binary_path)
            self.logger.info("download url: %s", download_url)
            if not os.path.isdir(binary_dir):
                os.makedirs(binary_dir)
            with urlopen(download_url) as res, open(binary_path, "wb") as binary:
                binary.write(res.read())
            os.chmod(binary_path, 0o777)
        except Exception as e:
            self.logger.error("Download failed, error: %s", e)


def get_tabnine_sub_path():
    version = get_tabnine_version()
    architect = parse_architecture(platform.machine())
    system = _SYSTEM_MAPPING[platform.system()]
    execute_name = executable_name("TabNine")
    return "{}/{}-{}/{}".format(version, architect, system, execute_name)


def get_tabnine_version():
    try:
        version = urlopen(_TABNINE_UPDATE_VERSION_URL).read().decode("UTF-8").strip()
        return version
    except HTTPError:
        return None


def get_tabnine_path(binary_dir):
    versions = os.listdir(binary_dir)
    versions.sort(key=parse_semver, reverse=True)
    for version in versions:
        triple = "{}-{}".format(
            parse_architecture(platform.machine()), _SYSTEM_MAPPING[platform.system()]
        )
        path = os.path.join(binary_dir, version, triple, executable_name("TabNine"))
        if os.path.isfile(path):
            return path


# Adapted from the sublime plugin
def parse_semver(s):
    try:
        return [int(x) for x in s.split(".")]
    except ValueError:
        return []


def parse_architecture(arch):
    if arch == "AMD64":
        return "x86_64"
    else:
        return arch


def executable_name(name):
    if platform.system() == "Windows":
        return name + ".exe"
    else:
        return name
