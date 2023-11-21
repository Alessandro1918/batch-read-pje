require("dotenv").config()

const fs = require("fs")
const filePathParts = "./parts.txt"
const filePathDocs = "./docs.txt"

const baseUrl = "https://pje.trt2.jus.br/pje-comum-api/api"

// const listUrl = "/pericias?ordenar=prazoEntrega&ascendente=true&pagina=PAGENUMBER&tamanhoPagina=PAGESIZE&arquivadas=true"   //Arquivados
// const listUrl = "/pericias?ordenar=prazoEntrega&ascendente=true&pagina=PAGENUMBER&tamanhoPagina=PAGESIZE&situacao=F&situacao=N"   //Finalizados
// const listUrl = "/pericias?ordenar=prazoEntrega&ascendente=true&pagina=PAGENUMBER&tamanhoPagina=PAGESIZE&situacao=S"   //Aguardando esclarecimentos
// const listUrl = "/pericias?ordenar=prazoEntrega&ascendente=true&pagina=PAGENUMBER&tamanhoPagina=PAGESIZE&situacao=P"   //Laudo juntado
const listUrl = "/pericias?ordenar=prazoEntrega&ascendente=true&pagina=PAGENUMBER&tamanhoPagina=PAGESIZE&situacao=M&situacao=L&situacao=A"   //Aguardando laudo
const getPartsUrl = "/processos/id/PROCESSID/partes"
const getDocsUrl = "/processos/id/PROCESSID/timeline"

//10 pages, 1000 items per batch: i1: 1-1000  i2: 1001-2000   i3: 2001-3000, etc.
const total = 229               //i1: 1000    i2: 2000    i3: 3575
const pageStart = 1             //i1: 1       i2: 11      i3: 21
const pageSize = 100

//output stream -> files
const outputStreamParts = fs.createWriteStream(filePathParts, { encoding: "utf8" })
const outputStreamDocs = fs.createWriteStream(filePathDocs, { encoding: "utf8" })

//parts.txt -> copiedParts array, save only "Número do Processo" from each line
const copiedParts = []
var text = fs.readFileSync(filePathParts).toString()
text.split("\n").map(line => copiedParts.push(line.split(";")[0]))
outputStreamParts.write(text)   //TODO - fix bug that clears my file after read it

//docs.txt -> copiedDocs array, save only "Número do Processo" from each line
const copiedDocs = []
text = fs.readFileSync(filePathDocs).toString()
text.split("\n").map(line => copiedDocs.push(line.split(";")[0]))
outputStreamDocs.write(text)   //TODO - fix bug that clears my file after read it

//For all the pages:
for (var i = pageStart - 1; i < Math.ceil(total / pageSize); i++) {
  
  //get list of "Processos"
  fetch(
    baseUrl + listUrl
              .replace("PAGENUMBER", `${i+1}`)
              .replace("PAGESIZE", `${pageSize}`), {
    headers: new Headers({
      'Cookie': process.env.cookie
    })
  })
  .then(response => response.json())
  .then(response => {

    console.log(`Pág: ${response.pagina}/${Math.ceil(total / pageSize)}`)
    
    response.resultado.map(r => {
      // console.log(`${r.numeroProcesso}  ${r.idProcesso}`)        //100XXXX-XX.2019.5.02.XXXX  2633574

      //query only items not already copied
      if (!copiedParts.includes(r.numeroProcesso)) {

        //get Partes (Ativa (Recte) / Passiva (Recdas))
        fetch(baseUrl + getPartsUrl.replace("PROCESSID", `${r.idProcesso}`), {
          headers: new Headers({
            'Cookie': process.env.cookie
          })
        })
        .then(response => response.json())
        .then(response => {
          try {
            const recte = response.ATIVO[0].nome.trim()                 //"José"
            let recdas = response.PASSIVO[0].nome.trim()                //"Supermercado X"
            for (var i = 1; i < response.PASSIVO.length; i++) {
              recdas = recdas + "," + response.PASSIVO[i].nome.trim()   //"Supermercado X, Padaria Y"
            }
            // console.log(`${r.numeroProcesso};${recte};${recdas}`)
            outputStreamParts.write(`${r.numeroProcesso};${recte};${recdas}\n`)
          } catch (err) {                                               //user without record visibility
            // console.log(`${r.numeroProcesso};-;-`)
            outputStreamParts.write(`${r.numeroProcesso};-;-\n`)
          }
        })
      }

      //query only items not already copied
      if (!copiedDocs.includes(r.numeroProcesso)) {

        //get "Documentos" (only last "Sentença" or "Ata da Audiência")
        fetch(baseUrl + getDocsUrl.replace("PROCESSID", `${r.idProcesso}`), {
          headers: new Headers({
            'Cookie': process.env.cookie
          })
        })
        .then(response => response.json())
        .then(response => {
          try {
            let lastDoc = "..."
            response.map(doc => {
              if (lastDoc === "..." && 
                  doc.titulo === "Sentença" || 
                  doc.titulo === "Ata da Audiência"
              ) {
                const dataDoc = `${doc.data.split("T")[0].split("-")[2]}/${doc.data.split("T")[0].split("-")[1]}/${doc.data.split("T")[0].split("-")[0]}`  //YYYY-MM-DD -> DD/MM/YYYY
                lastDoc = `${doc.idUnicoDocumento} ${dataDoc} ${doc.titulo}`    //12e39d6 19/02/2023  Sentença
              }
            })
            // console.log(`${r.numeroProcesso};${lastDoc}`)
            outputStreamDocs.write(`${r.numeroProcesso};${lastDoc}\n`)
          } catch (err) {                                               //user without record visibility
            // console.log(`${r.numeroProcesso};-`)
            outputStreamParts.write(`${r.numeroProcesso};-\n`)
          }
        })
      }
    })
  })
}
