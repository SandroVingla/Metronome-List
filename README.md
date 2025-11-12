# 🎵 Metronome List

[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://metronome-list.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Metrônomo online profissional e gratuito com múltiplas faixas, 5 timbres de alta qualidade, controle avançado de canais e sistema completo de salvamento e compartilhamento de setlists.

🔗 **[Acesse o Metronome List](https://metronome-list.netlify.app/)**

![Metronome List Screenshot](https://via.placeholder.com/800x400/475569/ffffff?text=Metronome+List)

## ✨ Funcionalidades

### 🎹 Recursos Principais

- **Múltiplas Faixas**: Gerencie até 10 metrônomos simultâneos com configurações independentes
- **5 Timbres Profissionais**: Click Original, Soft Click, Electronic, Multitrack e Warm Tone
- **Controle Estéreo L/R/C**: Posicione o som no campo estéreo conforme necessário
- **BPM Ajustável**: Configure entre 60-200 BPM com precisão
- **Compassos Variados**: Suporte para 2/4, 3/4, 4/4 e 6/8
- **Atalhos de Teclado**: Use teclas 1-9 e 0 para controle rápido

### 💾 Salvamento e Compartilhamento

- **Salvamento Automático**: Última configuração salva automaticamente
- **Setlists Nomeados**: Salve múltiplos setlists com nomes personalizados
- **Compartilhamento Público**: Compartilhe setlists com outros usuários
- **Exportar/Importar JSON**: Backup e transferência de configurações
- **Gerenciador de Setlists**: Interface organizada para gerenciar seus setlists

### 🎨 Interface e Usabilidade

- **Design Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- **Menu de Navegação**: Acesso fácil a guias e documentação
- **Indicadores Visuais**: Acompanhe os beats em tempo real
- **Interface Intuitiva**: Fácil de usar, mesmo para iniciantes

## 🚀 Demo

Experimente online: **[metronome-list.netlify.app](https://metronome-list.netlify.app/)**

## 📸 Screenshots

| Tela Principal | Gerenciador de Setlists |
|---|---|
| ![Main](https://via.placeholder.com/400x250/475569/ffffff?text=Metronome+Main) | ![Manager](https://via.placeholder.com/400x250/334155/ffffff?text=Setlist+Manager) |

## 🛠️ Tecnologias

- **HTML5**: Estrutura semântica
- **CSS3**: Design moderno e responsivo
- **JavaScript (Vanilla)**: Zero dependências
- **Web Audio API**: Síntese de áudio em tempo real
- **localStorage/Claude Storage**: Persistência de dados

## 📦 Instalação

### Uso Online (Recomendado)

Simplesmente acesse: [https://metronome-list.netlify.app/](https://metronome-list.netlify.app/)

### Instalação Local

```bash
# Clone o repositório
git clone https://github.com/SandroVingla/Metronome-List.git

# Entre no diretório
cd Metronome-List

# Abra o index.html no navegador
# Ou use um servidor local
python -m http.server 8000
# Acesse http://localhost:8000
```

## 📚 Estrutura do Projeto

```
metronome-list/
├── index.html              # Página principal
├── como-usar.html          # Tutorial completo
├── guia-completo.html      # Guia avançado
├── sobre.html              # Sobre o projeto
├── faq.html                # Perguntas frequentes
├── style.css               # Estilos globais
├── script.js               # Lógica principal
└── README.md               # Este arquivo
```

## 🎯 Como Usar

### Básico

1. **Iniciar Metrônomo**: Clique no botão ▶ (play)
2. **Ajustar BPM**: Digite o valor desejado (60-200)
3. **Mudar Compasso**: Selecione 2/4, 3/4, 4/4 ou 6/8
4. **Trocar Timbre**: Escolha entre os 5 timbres disponíveis

### Salvamento

```javascript
// Salvar setlist
1. Configure seus metrônomos
2. Clique no botão 💾 (Salvar)
3. Digite um nome
4. Pronto! Setlist salvo localmente
```

### Compartilhamento

```javascript
// Compartilhar setlist (apenas no Claude.ai)
1. Configure seu setlist
2. Clique no botão 🌐 (Compartilhar)
3. Digite nome e autor
4. Setlist fica disponível para todos
```

### Exportar/Importar

```javascript
// Exportar
1. Clique no botão 📥 (Exportar)
2. Arquivo .json será baixado

// Importar
1. Clique no botão 📤 (Importar)
2. Selecione arquivo .json
3. Setlist será carregado
```

### Atalhos de Teclado

| Tecla | Ação |
|---|---|
| `1-9` | Play/Pause metrônomos 1-9 |
| `0` | Play/Pause metrônomo 10 |

## 🎨 Timbres Disponíveis

| Timbre | Descrição | Uso Ideal |
|---|---|---|
| **Click Original** | Som clássico de metrônomo mecânico | Prática geral, música clássica |
| **Soft Click** | Versão suavizada e confortável | Sessões longas de estudo |
| **Electronic** | Som moderno e profissional | Rock, pop, eletrônica |
| **Multitrack** | Desenvolvido para estúdio | Gravações profissionais |
| **Warm Tone** | Tom musical e orgânico | Prática expressiva |

## 💡 Casos de Uso

### 🎸 Para Bandas
- Crie setlist do show
- Compartilhe com todos os membros
- Todos praticam com mesmas configurações

### 🎓 Para Professores
- Organize exercícios por nível
- Exporte e envie para alunos
- Garanta prática no BPM correto

### 🎤 Para Shows
- Prepare setlist completo
- Faça backup em JSON
- Use atalhos para mudar rápido entre músicas

### 📚 Para Estudantes
- Organize repertório em setlists
- Acompanhe progresso com BPM crescente
- Salve configurações de cada peça

## 🤝 Contribuindo

Contribuições são bem-vindas! 

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### 🐛 Reportando Bugs

Encontrou um bug? [Abra uma issue](https://github.com/SandroVingla/Metronome-List/issues) com:
- Descrição clara do problema
- Passos para reproduzir
- Comportamento esperado vs atual
- Screenshots (se aplicável)
- Navegador e versão

## 🗺️ Roadmap

### Em Desenvolvimento
- [ ] Sincronização em nuvem com conta
- [ ] Modo escuro
- [ ] Mais timbres personalizáveis
- [ ] Padrões rítmicos complexos
- [ ] Polirritmos

### Planejado
- [ ] Aplicativo mobile nativo
- [ ] Integração MIDI
- [ ] Estatísticas de uso
- [ ] Categorias/tags para setlists
- [ ] Sistema de busca avançado
- [ ] Comentários em setlists compartilhados

## 📊 Especificações Técnicas

### Áudio
- **Precisão**: < 1ms de variação (Web Audio API)
- **Latência**: < 10ms (imperceptível)
- **Síntese**: Tempo real, sem samples
- **Frequências**: 330Hz - 2000Hz dependendo do timbre

### Armazenamento
- **Local**: localStorage (ilimitado*)
- **Compartilhado**: Claude Storage API (quando disponível)
- **Formato**: JSON compacto
- **Tamanho médio**: ~1KB por setlist

*_Limitado pelo navegador, geralmente 5-10MB_

## 🌐 Compatibilidade

| Navegador | Versão Mínima | Status |
|---|---|---|
| Chrome | 60+ | ✅ Totalmente suportado |
| Firefox | 55+ | ✅ Totalmente suportado |
| Safari | 14+ | ✅ Totalmente suportado |
| Edge | 79+ | ✅ Totalmente suportado |
| Opera | 47+ | ✅ Totalmente suportado |

### Dispositivos Móveis
- ✅ iOS Safari 14+
- ✅ Chrome Mobile
- ✅ Firefox Mobile
- ✅ Samsung Internet

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👨‍💻 Autor

**Sandro Vingla**

- GitHub: [@SandroVingla](https://github.com/SandroVingla)
- LinkedIn: [Sandro Vingla](https://linkedin.com/in/sandrovingla)

## 🙏 Agradecimentos

- Web Audio API por possibilitar síntese de áudio em tempo real
- Comunidade de músicos que testou e deu feedback
- Todos os contribuidores do projeto

## 📞 Suporte

- **Documentação**: [Como Usar](https://metronome-list.netlify.app/como-usar.html)
- **FAQ**: [Perguntas Frequentes](https://metronome-list.netlify.app/faq.html)
- **Issues**: [GitHub Issues](https://github.com/SandroVingla/Metronome-List/issues)
- **Email**: seu-email@exemplo.com

## 🌟 Mostre seu apoio

Se este projeto te ajudou, considere dar uma ⭐️ no GitHub!

---

<div align="center">

**[Website](https://metronome-list.netlify.app/)** • 
**[Documentação](https://metronome-list.netlify.app/como-usar.html)** • 
**[Guia Completo](https://metronome-list.netlify.app/guia-completo.html)** • 
**[FAQ](https://metronome-list.netlify.app/faq.html)**

Feito com ❤️ por [Sandro Vingla](https://github.com/SandroVingla)

</div>