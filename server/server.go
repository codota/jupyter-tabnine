package main

import (
	"bufio"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
)

type TabNinePipeHandler struct {
	PipeInWriter *io.PipeWriter
	PipeOutReader *bufio.Reader
	mux sync.Mutex
}


func (h *TabNinePipeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*") // fix cross-domain requst probelm
	body, _ := ioutil.ReadAll(r.Body)
	log.Printf("Received body: %s", string(body))
	h.mux.Lock()
	h.PipeInWriter.Write(body)
	h.PipeInWriter.Write([]byte("\n"))
	str, _ := h.PipeOutReader.ReadString('\n')
	h.mux.Unlock()
	fmt.Fprintln(w, str)
}

func main() {
	tabNineBinaryPath := os.Getenv("TABNINE_BINARY_PATH")
	if tabNineBinaryPath == "" {
		log.Fatal("TABNINE_BINARY_PATH is not set")
	}
	serverPort := os.Getenv("SERVER_PORT")
	if serverPort == "" {
		log.Fatal("SERVER_PORT is not set")
	}
	cmd := exec.Command(tabNineBinaryPath, "--client=vscode")
	inr, inw := io.Pipe()
	outr, outw := io.Pipe()
	cmd.Stdin = inr
	cmd.Stdout = outw
	if err := cmd.Start(); err != nil {
		panic(err)
	}
	go cmd.Wait()
	reader := bufio.NewReader(outr)
	http.Handle("/", &TabNinePipeHandler{PipeInWriter: inw, PipeOutReader: reader})
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", serverPort), nil))
	defer inr.Close()
	defer inw.Close()
	defer outr.Close()
	defer outw.Close()
}
