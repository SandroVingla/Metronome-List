# 🎵 Metronome List

Metrônomo online profissional e gratuito com múltiplas faixas simultâneas, pad contínuo, controle avançado de BPM e gerenciamento de setlists.

🔗 [metronome-list.netlify.app](https://metronome-list.netlify.app/)

## ✨ Features

- ✅ Múltiplos metrônomos simultâneos (até 10)
- ✅ Controle individual de BPM (40-300)
- ✅ Play/Pause independente por faixa
- ✅ 5 timbres profissionais de click
- ✅ Compasso personalizável (2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8, 12/8)
- ✅ Tap Tempo
- ✅ Controle estéreo L/R/C
- ✅ Salvar e carregar setlists
- ✅ Exportar/Importar setlists em JSON
- ✅ Biblioteca de cifras com pesquisa, aplicação e exclusão
- ✅ Exportar/Importar biblioteca de cifras em JSON
- ✅ Atalhos de teclado (1-9, 0, Espaço)
- ✅ **Pad Contínuo** com 12 tons (A, A#/Bb, B, C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab)
- ✅ **Mute do Click** — silencia o metrônomo mantendo o pad tocando
- ✅ Upload de pad personalizado (MP3/WAV próprio por faixa)

## 🎹 Pad Contínuo

Cada faixa possui um pad de fundo independente que toca em loop assim que o play é acionado.

### Como funciona

- O seletor de tom fica entre o botão ▶ e o compasso em cada faixa
- Escolha a nota (C, C#/Db, D... B) e ative com o botão **ON/OFF**
- O pad inicia junto com o click e para quando o metrônomo para
- O volume do pad é **independente** do volume do click
- O pad é sempre **stereo** — nunca segue a configuração L/R/C do click

### Arquivo personalizado

Clique em 🔊 para abrir o painel da faixa e carregue seu próprio arquivo de áudio (MP3, WAV, OGG). O arquivo toca em loop no lugar do pad padrão. Clique em ✕ para voltar ao pad padrão.

### Pasta de pads

Os arquivos padrão ficam em `pads/` na raiz do projeto:

```
pads/
├── Pad_-_A.mp3
├── Pad_-_Ab.mp3
├── Pad_-_Bb.mp3
├── Pad_-_B.mp3
├── Pad_-_C.mp3
├── Pad_-_Db.mp3
├── Pad_-_D.mp3
├── Pad_-_Eb.mp3
├── Pad_-_E.mp3
├── Pad_-_F.mp3
├── Pad_-_Gb.mp3
└── Pad_-_G.mp3
```

## 🔇 Mute do Click

O botão **🔊 Click** fica na barra de controles globais, ao lado do Tap Tempo.

- Clique para mutar o click — o pad continua tocando normalmente
- O botão fica roxo pulsando para indicar que o click está silenciado
- Ideal para usar o pad como fundo musical em pregações, palestras ou ensaios sem metrônomo audível
- Clique novamente para reativar o click

## 🎵 Biblioteca de Cifras

Cada metrônomo possui um painel de cifra para salvar letra, acordes e seções da música. O botão **📚 Biblioteca** permite pesquisar, aplicar e excluir cifras salvas.

### Importação e exportação

Dentro da biblioteca:

- **📥 Exportar** baixa todas as cifras em um arquivo JSON versionado
- **📤 Importar** adiciona cifras de um arquivo JSON à biblioteca atual
- Uma cifra com o mesmo nome normalizado atualiza a entrada existente
- Maiúsculas, acentos e pontuação não criam nomes duplicados
- Nomes diferentes com o mesmo conteúdo ainda são tratados como entradas distintas

Sem login, a biblioteca fica no `localStorage` deste navegador. Com login do Google, ela também é sincronizada com o Firebase. O arquivo JSON exportado pela web pode ser usado como base para compartilhar a biblioteca com o app; a compatibilidade exata com o formato nativo do app depende dos campos usados por ele.

## 🚀 Tecnologias

- **HTML5 + CSS3 + JavaScript** puro — zero dependências
- **Web Audio API** — síntese e roteamento de áudio em tempo real
- **localStorage** — persistência de setlists e configurações

## 📦 Instalação Local

```bash
# Clone o repositório
git clone https://github.com/SandroVingla/Metronome-List.git
cd Metronome-List

# Abra direto no navegador
open index.html

# Ou use um servidor local
python -m http.server 8000
# Acesse http://localhost:8000
```

## 🏗️ Estrutura do Projeto

```
metronome-list/
├── index.html          # Página principal
├── style.css           # Estilos globais
├── script.js           # Lógica principal (metrônomo + pad + mute)
├── pads/               # Arquivos MP3 dos pads por tom
│   ├── Pad_-_A.mp3
│   ├── Pad_-_Ab.mp3
│   └── ...
├── como-usar.html
├── sobre.html
├── faq.html
├── blog.html
├── privacy.html
├── robots.txt
├── sitemap.xml
└── assets/
    └── qrcodemercadopag.png
```

## 🎯 Roadmap

### Concluído ✅
- [x] Múltiplas faixas simultâneas
- [x] 5 timbres profissionais
- [x] Controle estéreo L/R/C
- [x] Tap Tempo
- [x] Salvar / exportar / importar setlists
- [x] Atalhos de teclado
- [x] **Pad contínuo por faixa com 12 tons**
- [x] **Mute do click independente do pad**
- [x] **Upload de pad personalizado por faixa**

### Planejado 🔜
- [ ] Modo escuro
- [ ] Polirritmos
- [ ] Sincronização em nuvem
- [ ] App mobile nativo (React Native / Expo)
- [ ] Integração MIDI
- [ ] Mais packs de pad

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit (`git commit -m 'feat: minha feature'`)
4. Push (`git push origin feature/minha-feature`)
5. Abra um Pull Request

## 💚 Apoie o Projeto

O Metronome List é 100% gratuito e open source. Se te ajudou:

- ⭐ Dê uma estrela no GitHub
- 📢 Compartilhe com outros músicos
- 💚 Contribua via PIX: `sanvingla@hotmail.com`

## 📄 Licença

MIT License — veja [license](license) para detalhes.

## 👤 Autor

**Sandro Vingla**
- GitHub: [@SandroVingla](https://github.com/SandroVingla)
- Website: [metronome-list.netlify.app](https://metronome-list.netlify.app/)