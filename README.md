# 🎵 Metronome List

Um metrônomo web profissional com múltiplas faixas, controle de canais e diversos timbres de alta qualidade.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## ✨ Funcionalidades

- 🎼 **Até 10 metrônomos simultâneos** - Gerencie múltiplas faixas musicais
- 🎹 **Atalhos de teclado** - Teclas 1-9 e 0 para controle rápido
- 🔊 **5 Timbres profissionais** - Sons de alta qualidade para diferentes necessidades
- 🎚️ **Controle de canais** - L (Esquerda), R (Direita), C (Centro)
- ⚡ **BPM ajustável** - De 60 a 200 batidas por minuto
- 🎶 **Compassos variados** - 2/4, 3/4, 4/4, 6/8
- 📊 **Indicadores visuais** - Acompanhe cada batida em tempo real
- 🔇 **Controle de volume** - Ajuste fino do volume geral
- 💾 **Zero instalação** - Funciona direto no navegador
- 🎧 **Compatível com placas externas** - Use sua interface de áudio profissional

## 🎨 Timbres Disponíveis

| Timbre | Descrição | Uso Recomendado |
|--------|-----------|-----------------|
| **Click Original** | Som nítido e preciso | Prática geral, ensaios |
| **Soft Click** | Tom suave e confortável | Sessões longas, gravação |
| **Electronic** | Som eletrônico profissional | Música eletrônica, DJ sets |
| **Multitrack** | Tom aberto para gravações | Estúdio, multitracks |
| **Warm Tone** | Som quente e musical | Jazz, música acústica |

## 🚀 Como Usar

### Uso Online

1. Acesse: [https://github.com/SandroVingla/Metronome-List](https://seuusuario.github.io/metronome-list)
2. Configure sua placa de áudio como padrão no sistema
3. Ajuste o BPM e compasso desejado
4. Clique em **Play** (▶️) para iniciar

### Uso Local

1. Baixe o arquivo `index.html`
2. Abra no seu navegador preferido
3. Pronto para usar!

## ⌨️ Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `1-9` | Play/Pause dos metrônomos 1-9 |
| `0` | Play/Pause do metrônomo 10 |

> **Nota:** Atalhos funcionam apenas quando não estiver editando campos de texto

## 🎧 Configuração de Áudio

### Para usar com placa de áudio externa:

**Windows:**
1. Clique direito no ícone de volume
2. Sons → Reprodução
3. Defina sua placa como "Dispositivo Padrão"

**macOS:**
1. Preferências do Sistema → Som
2. Saída → Selecione sua placa

**Linux:**
1. Configurações de Som
2. Saída → Selecione seu dispositivo

## 🛠️ Tecnologias Utilizadas

- **HTML5** - Estrutura
- **CSS3** - Estilização
- **JavaScript (ES5+)** - Lógica
- **Web Audio API** - Geração de áudio em tempo real

## 💡 Recursos Técnicos

- ✅ **Pure JavaScript** - Sem dependências externas
- ✅ **Web Audio API** - Síntese de áudio nativa
- ✅ **Responsive Design** - Funciona em qualquer tela
- ✅ **Cross-browser** - Chrome, Firefox, Safari, Edge
- ✅ **Lightweight** - Menos de 100KB
- ✅ **Offline Ready** - Funciona sem internet

## 📱 Compatibilidade

| Navegador | Versão Mínima | Status |
|-----------|---------------|--------|
| Chrome | 88+ | ✅ Suportado |
| Firefox | 85+ | ✅ Suportado |
| Safari | 14+ | ✅ Suportado |
| Edge | 88+ | ✅ Suportado |
| Opera | 74+ | ✅ Suportado |

## 🎯 Casos de Uso

- 🎸 **Músicos** - Prática individual e ensaios
- 🎙️ **Gravação** - Referência de tempo em estúdio
- 🎼 **Professores** - Aulas de música
- 🎧 **DJs** - Mixagem e sincronização
- 🥁 **Bateristas** - Treino de ritmo e coordenação
- 🎹 **Produtores** - Composição e arranjos

## 📋 Funcionalidades Detalhadas

### Controle Individual por Metrônomo

Cada metrônomo possui:
- Campo de nome personalizável
- BPM independente (60-200)
- Seleção de compasso (2/4, 3/4, 4/4, 6/8)
- Botão Play/Pause individual
- Indicadores visuais de batida
- Botão de remoção

### Controles Globais

- **Canais de Áudio**: Direcione o som para L/R/Center
- **Seletor de Timbre**: 5 sons profissionais
- **Volume Global**: Controle fino do volume geral
- **Adicionar Metrônomo**: Até 10 simultâneos

## 🔧 Instalação para Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/SandroVingla/Metronome-List.git

# Entre na pasta
cd metronome-list

# Abra o index.html no navegador
# Ou use um servidor local:
python -m http.server 8000
# Acesse: http://localhost:8000
```

## 📦 Deploy

### GitHub Pages

1. Faça push para o GitHub
2. Vá em **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** → **/ (root)**
5. Save

### Netlify

1. Acesse [netlify.com](https://netlify.com)
2. Arraste a pasta do projeto
3. Deploy automático!

### Vercel

```bash
npm i -g vercel
vercel --prod
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um Fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abrir um Pull Request

## 📝 Roadmap

Funcionalidades planejadas para futuras versões:

- [ ] Tap Tempo - Detectar BPM por cliques manuais
- [ ] Salvar presets - Configurações personalizadas
- [ ] Modo escuro/claro
- [ ] Exportar configurações (JSON)
- [ ] Suporte PWA - Instalar como app
- [ ] Subdivisões rítmicas avançadas
- [ ] Acentos personalizados

## 🐛 Reportar Bugs

Encontrou um bug? [Abra uma issue](https://github.com/SandroVingla/Metronome-List/issues)

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👨‍💻 Autor

Desenvolvido por [Alexsandro Vingla de Souza](https://github.com/SandroVingla)

## 🌟 Agradecimentos

- Web Audio API pela incrível tecnologia
- Comunidade open-source
- Músicos que testaram e deram feedback

## 📞 Contato

- GitHub: [@sandrovingla](https://github.com/SandroVingla)
- Email: sanvingla@hotmail.com

---

⭐ Se este projeto te ajudou, considere dar uma estrela no repositório!

**Feito com ❤️ para músicos**