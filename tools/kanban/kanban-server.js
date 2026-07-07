// Servidor local do quadro Kanban das user stories (US-31).
// Node puro, zero dependências. Escuta só em 127.0.0.1.
// Lê e reescreve a linha **Status:** dos US-*.md em docs/sdlc/01-requisitos.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = 5051;
const HOST = '127.0.0.1';
const REQ_DIR = path.resolve(__dirname, '../../docs/sdlc/01-requisitos');
const HTML_FILE = path.join(__dirname, 'kanban.html');

// coluna -> texto canônico gravado na linha **Status:**
const CANONICO = {
  backlog: '🗂️ Backlog',
  todo: '📋 Planejada (não iniciada)',
  doing: '🚧 Em progresso',
  done: '✅ Implementada',
};

// status bruto -> coluna (case-insensitive, por includes; backlog é fallback)
function normalizar(statusBruto) {
  const s = (statusBruto || '').toLowerCase();
  if (s.includes('feito') || s.includes('implementada')) return 'done';
  if (s.includes('em progresso') || s.includes('em desenvolvimento') || s.includes('wip')) return 'doing';
  if (s.includes('planejada') || s.includes('pronta para desenvolvimento')) return 'todo';
  return 'backlog';
}

function campo(conteudo, regex) {
  const m = conteudo.match(regex);
  return m ? m[1].trim() : '';
}

function parseStory(arquivo, conteudo) {
  // Título usa em-dash — (ou hífen como fallback): "# US-31 — Título"
  const tituloLinha = conteudo.match(/^#\s+(US-[0-9]+[a-z]?)\s*[—-]\s*(.+)$/m);
  const codigoFilename = (arquivo.match(/^(US-[0-9]+[a-z]?)/i) || [])[1] || arquivo;
  const codigo = tituloLinha ? tituloLinha[1] : codigoFilename;
  const titulo = tituloLinha ? tituloLinha[2].trim() : arquivo.replace(/\.md$/, '');
  const statusBruto = campo(conteudo, /^\*\*Status:\*\*\s*(.+)$/m);
  const epico = campo(conteudo, /^\*\*Épico:\*\*\s*(.+)$/m);
  return { codigo, titulo, epico, statusBruto, coluna: normalizar(statusBruto), arquivo };
}

function listarStories() {
  return fs.readdirSync(REQ_DIR)
    .filter((f) => /^US-.*\.md$/.test(f) && f !== 'US-TEMPLATE.md')
    .map((f) => parseStory(f, fs.readFileSync(path.join(REQ_DIR, f), 'utf8')))
    .sort((a, b) => b.codigo.localeCompare(a.codigo, undefined, { numeric: true }));
}

// Acha o nome do .md cuja story tem esse codigo, ou null.
function acharArquivo(codigo) {
  return fs.readdirSync(REQ_DIR)
    .filter((f) => /^US-.*\.md$/.test(f) && f !== 'US-TEMPLATE.md')
    .find((f) => parseStory(f, fs.readFileSync(path.join(REQ_DIR, f), 'utf8')).codigo === codigo) || null;
}

// Abre o .md da story no app padrão do SO. Lança { code, msg } em erro tratável.
function abrirArquivo(codigo) {
  const arquivo = acharArquivo(codigo);
  if (!arquivo) throw { code: 404, msg: `story não encontrada: ${codigo}` };

  // Resolve e confirma que fica dentro de REQ_DIR (defesa contra path traversal).
  const full = path.resolve(REQ_DIR, arquivo);
  if (full !== path.join(REQ_DIR, arquivo) || !full.startsWith(REQ_DIR + path.sep)) {
    throw { code: 400, msg: `caminho inválido: ${arquivo}` };
  }

  // execFile (não shell) com o caminho como argumento — sem interpolação, sem injeção.
  if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', full]);
  else if (process.platform === 'darwin') execFile('open', [full]);
  else execFile('xdg-open', [full]);
}

// Reescreve só a linha **Status:** do .md da story. Devolve a story atualizada
// ou lança { code, msg } em erro tratável.
function gravarStatus(codigo, coluna) {
  if (!CANONICO[coluna]) throw { code: 400, msg: `coluna inválida: ${coluna}` };
  const arquivo = acharArquivo(codigo);
  if (!arquivo) throw { code: 404, msg: `story não encontrada: ${codigo}` };

  const full = path.join(REQ_DIR, arquivo);
  const conteudo = fs.readFileSync(full, 'utf8');
  if (!/^\*\*Status:\*\*.*$/m.test(conteudo)) throw { code: 422, msg: `sem linha **Status:** em ${arquivo}` };

  const novo = conteudo.replace(/^\*\*Status:\*\*.*$/m, `**Status:** ${CANONICO[coluna]}`);
  fs.writeFileSync(full, novo, 'utf8');
  return parseStory(arquivo, novo);
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(HTML_FILE, 'utf8'));
    }

    if (req.method === 'GET' && req.url === '/stories') {
      return json(res, 200, listarStories());
    }

    const open = req.method === 'GET' && req.url.match(/^\/open\/(US-[0-9]+[a-z]?)$/i);
    if (open) {
      try {
        abrirArquivo(open[1]);
        return json(res, 200, { ok: true });
      } catch (e) {
        return json(res, e.code || 500, { erro: e.msg || String(e) });
      }
    }

    const patch = req.method === 'PATCH' && req.url.match(/^\/stories\/(US-[0-9]+[a-z]?)$/i);
    if (patch) {
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > 1e4) req.destroy(); });
      req.on('end', () => {
        try {
          const { coluna } = JSON.parse(raw || '{}');
          json(res, 200, gravarStatus(patch[1], coluna));
        } catch (e) {
          json(res, e.code || 400, { erro: e.msg || 'body inválido' });
        }
      });
      return;
    }

    json(res, 404, { erro: 'rota não encontrada' });
  } catch (e) {
    json(res, 500, { erro: String(e && e.message || e) });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Já tem um Kanban rodando em http://${HOST}:${PORT} — abra essa URL no navegador.`);
    console.log('Se não for o Kanban, feche o que usa a porta ' + PORT + ' ou mude PORT no topo do arquivo.');
    process.exit(0);
  }
  throw e;
});

server.listen(PORT, HOST, () => {
  console.log(`Kanban US em http://${HOST}:${PORT}  (pasta: ${REQ_DIR})`);
  console.log('Ctrl+C para parar.');
});
