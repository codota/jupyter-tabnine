package tabnine

import (
	"archive/zip"
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	// "github.com/coreos/go-semver/semver"
)

type TabNine struct {
	baseDir       string
	cmd           *exec.Cmd
	outReader     *bufio.Reader
	mux           sync.Mutex
	inPipeWriter  *io.PipeWriter
	outPipeWriter *io.PipeWriter
	inPipeReader  *io.PipeReader
	outPipeReader *io.PipeReader
	completeRes   *AutocompleteResult
	emptyRes      []byte
}

type AutocompleteResult struct {
	OldPrefix   string         `json:"old_prefix"`
	Results     []*ResultEntry `json:"results"`
	UserMessage []string       `json:"user_message"`
}

type ResultEntry struct {
	NewPrefix string `json:"new_prefix"`
	OldSuffix string `json:"old_suffix"`
	NewSuffix string `json:"new_suffix"`
	Details   string `json:"detail"`
}

const (
	tabnineServerUrl = "https://update.tabnine.com/bundles"
	pluginVersion    = "1.2.3"
)

var systemMap = map[string]string{
	"darwin":  "apple-darwin",
	"linux":   "unknown-linux-gnu",
	"windows": "pc-windows-gnu",
}

func NewTabNine(baseDir string) (*TabNine, error) {
	empty := AutocompleteResult{}
	emptyRes, _ := json.Marshal(empty)
	tabnine := &TabNine{
		baseDir:     baseDir,
		completeRes: &empty,
		emptyRes:    emptyRes,
	}
	err := tabnine.init()
	return tabnine, err
}

func (t *TabNine) init() (err error) {
	log.Println("TabNine Initializing")
	// download if needed
	var binaryPath string
	var wg sync.WaitGroup
	wg.Add(1)
	go func(wg *sync.WaitGroup) {
		binaryPath, err = t.getBinaryPath()
		wg.Done()
	}(&wg)
	t.inPipeReader, t.inPipeWriter = io.Pipe()
	t.outPipeReader, t.outPipeWriter = io.Pipe()
	wg.Wait()
	if err == nil {
		t.cmd = exec.Command(
			binaryPath,
			"--client=jupyter",
			fmt.Sprintf("--log-file-path=%s/tabnine.log", filepath.Dir(binaryPath)),
			"--client-metadata",
			fmt.Sprintf("pluginVersion=%s", pluginVersion),
		)
		t.cmd.Stdin = t.inPipeReader
		t.cmd.Stdout = t.outPipeWriter
		t.outReader = bufio.NewReader(t.outPipeReader)
		err = t.cmd.Start()
		// go t.cmd.Wait()
	}
	log.Println("TabNine Initialized")
	return
}

func (t *TabNine) downloadBinary(url, binaryPath string) (err error) {
	binaryDir := filepath.Dir(binaryPath)
	isExist, isDir := checkDir(binaryDir)
	if isExist && !isDir {
		err = os.RemoveAll(binaryDir)
		if err != nil {
			return
		}
	}

	if !isExist {
		err = os.MkdirAll(binaryDir, os.ModePerm)
		if err != nil {
			return
		}
	}

	resp, err := http.Get(url)
	if err != nil {
		return
	}

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		err = fmt.Errorf("Request update version error: %s", resp.Status)
		return
	}
	defer resp.Body.Close()

	out, err := os.Create(binaryPath)
	if err != nil {
		return
	}
	defer out.Close()
	_, err = io.Copy(out, resp.Body)
	return
}

func (t *TabNine) getBinaryPath() (binaryPath string, err error) {
	binaryDir := t.baseDir + "/binaries"
	if err != nil {
		return
	}
	needCreateDir := true
	isExist, isDir := checkDir(binaryDir)
	if isExist && isDir {
		needCreateDir = false
	}
	if isExist && !isDir {
		err = os.RemoveAll(binaryDir)
		if err != nil {
			return
		}
	}

	if needCreateDir {
		os.MkdirAll(binaryDir, os.ModePerm)
	}

	// dirs, err := ioutil.ReadDir(binaryDir)
	// if err != nil {
	// 	return
	// }

	// var versions []*semver.Version

	// for _, d := range dirs {
	// 	versions = append(versions, semver.New(d.Name()))
	// }
	// semver.Sort(versions)
	versions := []string {"4.4.198",}
	arch := parseArch(runtime.GOARCH)
	sys := systemMap[strings.ToLower(runtime.GOOS)]
	exeName := "TabNine"
	if strings.ToLower(runtime.GOOS) == "windows" {
		exeName += ".exe"
	}
	triple := fmt.Sprintf("%s-%s", arch, sys)
	for _, v := range versions {
		// binaryPath = filepath.Join(binaryDir, v.String(), triple, exeName)
		binaryPath = filepath.Join(binaryDir, v, triple, exeName)
		if isFile(binaryPath) {
			err = os.Chmod(binaryPath, 0755)
			return
		}
	}
	// need download
	resp, err := http.Get(fmt.Sprintf("%s/version", tabnineServerUrl))
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		err = fmt.Errorf("Request update version error: %s", resp.Status)
		return
	}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return
	}
	log.Println("Binary doesn't exist, starting download.'")
	latestVersion := strings.TrimSpace(string(body))
	log.Printf("Latest version: %s\n", latestVersion)
	subPath := filepath.Join(latestVersion, triple, exeName)
	binaryPath = filepath.Join(binaryDir, subPath)
	zipFilePath := fmt.Sprintf("%s.zip", binaryPath)
	downloadUrl := fmt.Sprintf("%s/%s.zip", tabnineServerUrl, subPath)
	log.Printf("Download url: %s, Binary path: %s", downloadUrl, binaryPath)
	err = t.downloadBinary(downloadUrl, zipFilePath)
	if err != nil {
		log.Fatal("Download failed ", err)
		return
	}

	archive, err := zip.OpenReader(zipFilePath)
	if err != nil {
		panic(err)
	}

	defer archive.Close()

	outDir := filepath.Join(binaryDir, latestVersion, triple)
	for _, f := range archive.File {
		filePath := filepath.Join(outDir, f.Name)
		fmt.Println("unzipping file ", filePath)
		dstFile, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			panic(err)
		}
		defer dstFile.Close()

		fileInArchive, err := f.Open()
		if err != nil {
			panic(err)
		}
		defer fileInArchive.Close()

		if _, err := io.Copy(dstFile, fileInArchive); err != nil {
			panic(err)
		}
	}

	err = os.Remove(zipFilePath)
	if err != nil {
		panic(err)
	}

	err = os.Chmod(binaryPath, 0755)
	if err != nil {
		panic(err)
	}
	log.Println("Download finished.")
	return
}

func (t *TabNine) Request(data []byte) (res []byte) {
	t.mux.Lock()
	t.inPipeWriter.Write(data)
	t.inPipeWriter.Write([]byte("\n"))
	bytes, err := t.outReader.ReadBytes('\n')
	t.mux.Unlock()
	if err != nil {
		res = t.emptyRes
		return
	}
	// remove useless fields
	err = json.Unmarshal(bytes, t.completeRes)
	if err != nil {
		res = t.emptyRes
		return
	}
	res, err = json.Marshal(t.completeRes)
	return
}

func (t *TabNine) Close() {
	log.Println("tabnine closing... cleaning up...")
	t.cmd.Process.Kill()
	t.inPipeWriter.Close()
	t.outPipeWriter.Close()
	t.inPipeReader.Close()
	t.outPipeReader.Close()
}

func checkDir(path string) (isExist, isDir bool) {
	info, err := os.Stat(path)
	isExist = false
	if os.IsNotExist(err) {
		return
	}
	isExist = true
	isDir = info.IsDir()
	return
}

func isFile(path string) bool {
	isExist, isDir := checkDir(path)
	return isExist && !isDir
}

func isDir(path string) bool {
	isExist, isDir := checkDir(path)
	return isExist && isDir
}

func parseArch(arch string) string {
	if strings.ToLower(arch) == "amd64" {
		return "x86_64"
	}
	if strings.ToLower(arch) == "arm64" {
		return "aarch64"
	}
	return arch
}
